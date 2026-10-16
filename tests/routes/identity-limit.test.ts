import { describe, it, expect, beforeAll } from 'vitest';
import { makeTestDb } from './_harness';

process.env.COOKIE_SECRET = 's'.repeat(32);
process.env.DATABASE_URL = 'postgres://unused';
process.env.LLM_BASE_URL = 'http://x';
process.env.LLM_MODEL = 'm';
process.env.RATE_LIMIT_PER_HOUR = '20'; // identity budget: max(10, 20 / 2) = 10 new users per IP per hour

const { GET } = await import('@/app/api/me/route');

const visit = (ip: string, cookie?: string) =>
  GET(new Request('http://t/api/me', { headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) } }));

describe('new-session limiter', () => {
  beforeAll(async () => {
    await makeTestDb();
  });

  it('429s new users past the per-IP budget but still serves existing cookies and other IPs', async () => {
    let cookie = '';
    for (let i = 0; i < 10; i++) {
      const res = await visit('9.9.9.9');
      expect(res.status).toBe(200);
      cookie = res.headers.get('set-cookie')!.split(';')[0];
    }
    const blocked = await visit('9.9.9.9');
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'too many new sessions' });
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(blocked.headers.get('set-cookie')).toBeNull();

    const known = await visit('9.9.9.9', cookie);
    expect(known.status).toBe(200);
    expect(known.headers.get('set-cookie')).toBeNull();
    expect((await visit('8.8.8.8')).status).toBe(200);
  });
});
