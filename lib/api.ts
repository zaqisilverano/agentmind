import { ZodError } from 'zod';
import { requireUser } from '@/lib/identity';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const json = (data: unknown, init?: ResponseInit): Response => Response.json({ data }, init);
export const fail = (status: number, message: string): Response => Response.json({ error: message }, { status });

/** Host of an Origin header value; null when it does not parse (including the literal `null`). */
function safeHost(origin: string): string | null {
  try {
    return new URL(origin).host || null;
  } catch {
    return null;
  }
}

/** The host the browser addressed. Behind a proxy (or in the standalone server, where req.url carries the bind address) the Host / X-Forwarded-Host headers are authoritative. */
function requestHost(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('host') || new URL(req.url).host;
}

/** CSRF guard for JSON POST routes: JSON content type, and same host when an Origin header is sent. Throws HttpError. */
export function requireJsonSameOrigin(req: Request): void {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'expected application/json');
  const origin = req.headers.get('origin');
  if (origin !== null && safeHost(origin) !== requestHost(req)) throw new HttpError(403, 'bad origin');
}

type Params = Record<string, string>;
type Ctx = { params: Promise<Params> };
type Handler = (req: Request, ctx: { userId: string; params: Params }) => Promise<Response>;

/** Maps thrown ZodError / HttpError / anything else onto JSON error responses. */
export async function guard(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ZodError) return fail(400, e.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; '));
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, 'internal error');
  }
}

export function withUser(handler: Handler): { (req: Request): Promise<Response>; (req: Request, ctx: Ctx): Promise<Response> } {
  return (req: Request, ctx?: Ctx): Promise<Response> =>
    guard(async () => {
      const { userId, setCookie } = await requireUser(req);
      const params = ctx?.params ? await ctx.params : {};
      const res = await handler(req, { userId, params });
      if (!setCookie) return res;
      const headers = new Headers(res.headers);
      headers.append('Set-Cookie', setCookie);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    });
}

export const MAX_BODY_BYTES = 262144;

/** Parses a JSON request body (capped at MAX_BODY_BYTES) with a Zod schema, after the CSRF guard. Throws HttpError / ZodError. */
export async function readBody<T>(req: Request, schema: { parse(v: unknown): T }): Promise<T> {
  requireJsonSameOrigin(req);
  const declared = Number(req.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'body too large');
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new HttpError(413, 'body too large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
  return schema.parse(raw);
}
