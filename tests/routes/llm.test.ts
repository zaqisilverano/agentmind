import { describe, it, expect, beforeAll } from 'vitest';
import { makeTestDb } from './_harness';
import { MapReplySchema } from '@/lib/llm/schemas';

process.env.COOKIE_SECRET = 's'.repeat(32);
process.env.DATABASE_URL = 'postgres://unused';
process.env.LLM_BASE_URL = 'http://x';
process.env.LLM_MODEL = 'm';
process.env.LLM_API_KEY = '';
process.env.RATE_LIMIT_PER_HOUR = '1';

const map = await import('@/app/api/llm/map/route');

const post = (idea: string, headers: Record<string, string> = {}) =>
  map.POST(new Request('http://t/api/llm/map', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ idea }) }));

describe('POST /api/llm/map', () => {
  beforeAll(async () => {
    await makeTestDb();
  });

  it('returns fallback data and meta without a key, then rate limits the same user', async () => {
    const res = await post('A tool library', { 'x-forwarded-for': '1.1.1.1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.source).toBe('fallback');
    expect(MapReplySchema.safeParse(body.data).success).toBe(true);

    const cookie = res.headers.get('set-cookie')!.split(';')[0];
    const again = await map.POST(
      new Request('http://t/api/llm/map', { method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': '2.2.2.2' }, body: JSON.stringify({ idea: 'A tool library' }) }),
    );
    expect(again.status).toBe(429);
    expect(Number(again.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('rate limits by client IP so dropping the cookie does not reset the budget', async () => {
    const h = { 'x-forwarded-for': '3.3.3.3, 10.0.0.1' };
    expect((await post('A tool library', h)).status).toBe(200);
    const second = await post('A tool library', h);
    expect(second.status).toBe(429);
    expect(Number(second.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
