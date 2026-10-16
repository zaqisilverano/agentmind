import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generate } from '@/lib/llm/generate';

const S = z.object({ a: z.number() });
const fetchWith = (replies: string[]) => {
  let i = 0;
  return (async () => new Response(JSON.stringify({ choices: [{ message: { content: replies[i++] } }] }), { status: 200 })) as unknown as typeof fetch;
};
const envOk = { LLM_API_KEY: 'k', LLM_BASE_URL: 'http://x', LLM_MODEL: 'm' };

describe('generate', () => {
  it('returns model data on first valid reply', async () => {
    const r = await generate(S, 's', 'u', () => ({ a: 0 }), { fetch: fetchWith(['{"a":1}']), env: envOk });
    expect(r.data).toEqual({ a: 1 });
    expect(r.meta).toMatchObject({ source: 'model', attempts: 1 });
  });

  it('retries once with the errors, then falls back', async () => {
    const r = await generate(S, 's', 'u', () => ({ a: 0 }), { fetch: fetchWith(['{"a":"x"}', 'not json']), env: envOk });
    expect(r.data).toEqual({ a: 0 });
    expect(r.meta.source).toBe('fallback');
    expect(r.meta.attempts).toBe(2);
  });

  it('falls back immediately without a key', async () => {
    const r = await generate(S, 's', 'u', () => ({ a: 0 }), { fetch: fetchWith([]), env: { ...envOk, LLM_API_KEY: '' } });
    expect(r.meta).toMatchObject({ source: 'fallback', attempts: 0 });
  });

  it('falls back with an error when fetch rejects', async () => {
    const boom = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const r = await generate(S, 's', 'u', () => ({ a: 0 }), { fetch: boom, env: envOk });
    expect(r.data).toEqual({ a: 0 });
    expect(r.meta).toMatchObject({ source: 'fallback', attempts: 1 });
    expect(r.meta.error).toContain('network down');
  });

  it('sends the issues in the retry message and the documented request shape', async () => {
    const bodies: { messages: { role: string; content: string }[]; [k: string]: unknown }[] = [];
    let i = 0;
    const replies = ['{"a":"x"}', '{"a":2}'];
    const f = (async (url: string, init: RequestInit) => {
      expect(url).toBe('http://x/chat/completions');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
      bodies.push(JSON.parse(init.body as string));
      return new Response(JSON.stringify({ choices: [{ message: { content: replies[i++] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await generate(S, 'sys', 'usr', () => ({ a: 0 }), { fetch: f, env: { ...envOk, LLM_REASONING_EFFORT: 'low' } });
    expect(r.data).toEqual({ a: 2 });
    expect(r.meta).toMatchObject({ source: 'model', attempts: 2, model: 'm' });
    expect(bodies[0]).toMatchObject({ temperature: 0.4, max_tokens: 4000, response_format: { type: 'json_object' }, chat_template_kwargs: { reasoning_effort: 'low' } });
    expect(bodies[1].messages[1].content).toMatch(/^usr\n\nYour previous output was invalid: a: .+\nReturn corrected JSON only\.$/);
  });

  it('omits chat_template_kwargs when no reasoning effort is set and falls back on a non-2xx status', async () => {
    let body: Record<string, unknown> = {};
    const f = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response('nope', { status: 500 });
    }) as unknown as typeof fetch;
    const r = await generate(S, 's', 'u', () => ({ a: 0 }), { fetch: f, env: envOk });
    expect(body).not.toHaveProperty('chat_template_kwargs');
    expect(r.meta).toMatchObject({ source: 'fallback', attempts: 1 });
    expect(r.meta.error).toContain('500');
  });
});
