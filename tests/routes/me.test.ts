import { describe, it, expect, beforeAll } from 'vitest';
import { makeTestDb } from './_harness';
import { users } from '@/db/schema';

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

  it('first visit sets cookie and seeds the sample brain', async () => {
    const res = await GET(new Request('http://t/api/me'));
    expect(res.headers.get('set-cookie')).toMatch(/^ab_uid=.*HttpOnly/);
    const body = await res.json();
    expect(body.data.brains).toHaveLength(1);
    expect(body.data.brains[0]).toMatchObject({ number: 1, title: 'Tool Library', nodeCount: 24 });
  });

  it('second visit with the cookie reuses identity and does not reseed', async () => {
    const first = await GET(new Request('http://t/api/me'));
    const cookie = first.headers.get('set-cookie')!.split(';')[0];
    const second = await GET(new Request('http://t/api/me', { headers: { cookie } }));
    expect(second.headers.get('set-cookie')).toBeNull();
    const body1 = await first.json();
    const body2 = await second.json();
    expect(body1.data.user.id).toBe(body2.data.user.id);
    expect(body2.data.brains).toHaveLength(1);
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
  const post = (body: unknown) =>
    POST(new Request('http://t/api/me/restore', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));

  it('sets the cookie for an existing user', async () => {
    const [u] = await db.select().from(users).limit(1);
    const res = await post({ id: u.id });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { ok: true } });
    const { verify } = await import('@/lib/identity');
    const value = res.headers.get('set-cookie')!.split(';')[0].slice('ab_uid='.length);
    expect(verify(value, process.env.COOKIE_SECRET!)).toBe(u.id);
  });

  it('404s for an unknown id', async () => {
    const res = await post({ id: '123e4567-e89b-12d3-a456-426614174998' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown id' });
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
    expect(await res.json()).toEqual({ ok: true, db: true });
  });
});
