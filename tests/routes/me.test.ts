import { describe, it, expect, beforeAll, vi } from 'vitest';
import { makeTestDb } from './_harness';
import { brains, users } from '@/db/schema';

process.env.COOKIE_SECRET = 's'.repeat(32);
process.env.DATABASE_URL = 'postgres://unused';
process.env.LLM_BASE_URL = 'http://x';
process.env.LLM_MODEL = 'm';

const { GET } = await import('@/app/api/me/route');
const { POST } = await import('@/app/api/me/restore/route');
const { GET: HEALTH } = await import('@/app/api/health/route');

let db: Awaited<ReturnType<typeof makeTestDb>>;

describe('GET /api/me', () => {
  beforeAll(async () => {
    db = await makeTestDb();
  });

  it('first visit sets cookie and starts with no brains', async () => {
    const res = await GET(new Request('http://t/api/me'));
    expect(res.headers.get('set-cookie')).toMatch(/^ab_uid=.*HttpOnly/);
    const body = await res.json();
    expect(body.data.user.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.data.brains).toEqual([]);
    expect(await db.select().from(brains)).toHaveLength(0);
  });

  it('second visit with the cookie reuses identity and still has no brains', async () => {
    const first = await GET(new Request('http://t/api/me'));
    const cookie = first.headers.get('set-cookie')!.split(';')[0];
    const second = await GET(new Request('http://t/api/me', { headers: { cookie } }));
    expect(second.headers.get('set-cookie')).toBeNull();
    const body1 = await first.json();
    const body2 = await second.json();
    expect(body1.data.user.id).toBe(body2.data.user.id);
    expect(body2.data.brains).toEqual([]);
  });

  it('treats a validly signed cookie for an unknown user as missing', async () => {
    const { sign } = await import('@/lib/identity');
    const cookie = `ab_uid=${sign('123e4567-e89b-12d3-a456-426614174999', process.env.COOKIE_SECRET!)}`;
    const res = await GET(new Request('http://t/api/me', { headers: { cookie } }));
    expect(res.headers.get('set-cookie')).toMatch(/^ab_uid=/);
    const body = await res.json();
    expect(body.data.user.id).not.toBe('123e4567-e89b-12d3-a456-426614174999');
  });
});

describe('POST /api/me/restore', () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    POST(new Request('http://t/api/me/restore', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }));

  it('sets the cookie for an existing user', async () => {
    const [u] = await db.select().from(users).limit(1);
    const res = await post({ id: u.id }, { origin: 'http://t' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { ok: true } });
    const { verify } = await import('@/lib/identity');
    const value = res.headers.get('set-cookie')!.split(';')[0].slice('ab_uid='.length);
    expect(verify(value, process.env.COOKIE_SECRET!)).toBe(u.id);
  });

  it('415s without a JSON content type and sets no cookie', async () => {
    const [u] = await db.select().from(users).limit(1);
    const res = await POST(new Request('http://t/api/me/restore', { method: 'POST', body: JSON.stringify({ id: u.id }), headers: { 'content-type': 'text/plain' } }));
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: 'expected application/json' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('403s on a cross-origin request and sets no cookie', async () => {
    const [u] = await db.select().from(users).limit(1);
    const res = await post({ id: u.id }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'bad origin' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('404s for an unknown id', async () => {
    const res = await post({ id: '123e4567-e89b-12d3-a456-426614174998' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown id' });
  });

  it('413s an oversized body (same cap as every other JSON route) and sets no cookie', async () => {
    const res = await post({ id: 'x'.repeat(300_000) }, { origin: 'http://t' });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'body too large' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('400s for invalid JSON', async () => {
    const res = await POST(new Request('http://t/api/me/restore', { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid JSON' });
  });

  it('400s for a malformed body', async () => {
    const res = await post({ id: 'nope' });
    expect(res.status).toBe(400);
    expect(typeof (await res.json()).error).toBe('string');
  });
});

describe('GET /api/health', () => {
  it('reports db reachability', async () => {
    const res = await HEALTH();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  it('503s with db: false when the database is unreachable', async () => {
    const { setTestDb } = await import('@/db/client');
    setTestDb({ execute: async () => { throw new Error('connection refused'); } } as never);
    try {
      const res = await HEALTH();
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: true, db: false });
    } finally {
      setTestDb(db);
    }
  });
});

describe('GET /api/me provider', () => {
  // getEnv() caches the environment, so each case loads the route (and a test db) in a fresh module graph.
  const meWith = async (env: Record<string, string>) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    vi.resetModules();
    try {
      await (await import('./_harness')).makeTestDb();
      const { GET: get } = await import('@/app/api/me/route');
      return (await (await get(new Request('http://t/api/me'))).json()).data;
    } finally {
      process.env = saved;
      vi.resetModules();
    }
  };

  it('without a key: not configured, "Offline fallback"', async () => {
    const data = await meWith({ LLM_API_KEY: '', LLM_MODEL: 'IFM/K2-Horizon-375B-A23B' });
    expect(data.provider).toEqual({ configured: false, label: 'Offline fallback' });
  });

  it('with a key: configured, the model label, and never the key or base URL', async () => {
    const data = await meWith({ LLM_API_KEY: 'placeholder-not-a-real-key', LLM_MODEL: 'IFM/K2-Horizon-375B-A23B', LLM_BASE_URL: 'https://llm.example.test/v1' });
    expect(data.provider).toEqual({ configured: true, label: 'K2 Horizon 375B' });
    const raw = JSON.stringify(data);
    expect(raw).not.toContain('placeholder-not-a-real-key');
    expect(raw).not.toContain('llm.example.test');
  });
});

