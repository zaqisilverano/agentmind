import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { clientIp } from '@/lib/clientIp';
import { getEnv } from '@/lib/env';
import { HttpError } from '@/lib/httpError';
import { getIdentityLimiter } from '@/lib/rateLimit';

export const COOKIE_NAME = 'ab_uid';
const MAX_AGE_SECONDS = 31536000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mac = (uuid: string, secret: string): string => createHmac('sha256', secret).update(uuid).digest('hex');

export function sign(uuid: string, secret: string): string {
  return `${uuid}.${mac(uuid, secret)}`;
}

/** Returns the uuid when the signature is valid, otherwise null. */
export function verify(value: string, secret: string): string | null {
  const dot = value.indexOf('.');
  if (dot === -1) return null;
  const uuid = value.slice(0, dot);
  if (!UUID_RE.test(uuid)) return null;
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(mac(uuid, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return uuid;
}

export function cookieHeader(uuid: string, opts: { secure: boolean }): string {
  const base = `${COOKIE_NAME}=${sign(uuid, getEnv().COOKIE_SECRET)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
  return opts.secure ? `${base}; Secure` : base;
}

const isSecure = (): boolean => getEnv().NODE_ENV === 'production';

function readCookie(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const p = part.trim();
    if (p.startsWith(`${COOKIE_NAME}=`)) return p.slice(COOKIE_NAME.length + 1);
  }
  return null;
}

/**
 * Resolves the caller's user, creating one (and a Set-Cookie value) when the cookie is missing or unknown.
 * Creating a user costs a token from the per-IP identity limiter; when it is spent this throws 429 with Retry-After.
 */
export async function requireUser(req: Request): Promise<{ userId: string; setCookie?: string }> {
  const db = getDb();
  const raw = readCookie(req);
  const existing = raw ? verify(raw, getEnv().COOKIE_SECRET) : null;
  if (existing) {
    const touched = await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, existing)).returning({ id: users.id });
    if (touched.length > 0) return { userId: existing };
  }
  const budget = getIdentityLimiter().take(clientIp(req));
  if (!budget.ok) throw new HttpError(429, 'too many new sessions', { 'Retry-After': String(budget.retryAfter) });
  const [created] = await db.insert(users).values({}).returning({ id: users.id });
  return { userId: created.id, setCookie: cookieHeader(created.id, { secure: isSecure() }) };
}
