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

const post = (idea: string) =>
  map.POST(new Request('http://t/api/llm/map', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea }) }));

describe('POST /api/llm/map', () => {
  beforeAll(async () => {
    await makeTestDb();
  });

  it('returns fallback data and meta without a key, then rate limits the same user', async () => {
    const res = await post('A tool library');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.source).toBe('fallback');
    expect(MapReplySchema.safeParse(body.data).success).toBe(true);

    const cookie = res.headers.get('set-cookie')!.split(';')[0];
    const again = await map.POST(
      new Request('http://t/api/llm/map', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ idea: 'A tool library' }) }),
    );
    expect(again.status).toBe(429);
    expect(Number(again.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
