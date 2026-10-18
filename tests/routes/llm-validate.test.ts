import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { makeTestDb } from './_harness';
import { sampleBrain } from '@/lib/sample/toolLibrary';
import { mapLines } from '@/lib/llm/prompts';

process.env.COOKIE_SECRET = 's'.repeat(32);
process.env.DATABASE_URL = 'postgres://unused';
process.env.LLM_BASE_URL = 'http://x';
process.env.LLM_MODEL = 'm';
process.env.LLM_API_KEY = 'k';
process.env.RATE_LIMIT_PER_HOUR = '1000';

const agentRound = await import('@/app/api/llm/agent-round/route');
const takeaway = await import('@/app/api/llm/takeaway/route');
const expand = await import('@/app/api/llm/expand/route');

const { nodes } = sampleBrain('#111111');
const idea = { title: 'Tool Library', summary: 'Borrow tools.' };
const post = (h: (r: Request) => Promise<Response>, body: unknown) =>
  h(new Request('http://t/api/llm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const modelSays = (content: unknown) =>
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 }));

beforeAll(async () => {
  await makeTestDb();
});
afterEach(() => vi.unstubAllGlobals());

describe('LLM route post-validation', () => {
  it('agent-round drops links to unknown nodes and self links', async () => {
    modelSays({
      thought: 'I looked.',
      children: [{ name: 'A', note: '' }],
      links: [{ a: 'b0', b: 'ghost', why: '' }],
    });
    const res = await post(agentRound.POST, { agent: 'researcher', idea, mapLines: mapLines(nodes), links: [], target: nodes.find((n) => n.id === 'b0'), nodes });
    const body = await res.json();
    expect(body.meta.source).toBe('model');
    expect(body.data.links).toEqual([]);
  });

  it('agent-round keeps valid links', async () => {
    modelSays({ thought: 'I looked.', children: [{ name: 'A', note: '' }], links: [{ a: 'b0', b: 'b3', why: 'x' }] });
    const res = await post(agentRound.POST, { agent: 'researcher', idea, mapLines: mapLines(nodes), links: [], target: nodes.find((n) => n.id === 'b0'), nodes });
    expect((await res.json()).data.links).toHaveLength(1);
  });

  it('agent-round puts the focus note in the prompt, and refuses one over 300 characters', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent.push(String(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ thought: 'I looked.', children: [{ name: 'A', note: '' }], links: [] }) } }] }), { status: 200 });
    });
    const body = { agent: 'researcher', idea, mapLines: mapLines(nodes), links: [], target: nodes.find((n) => n.id === 'b0'), nodes };
    expect((await post(agentRound.POST, { ...body, focus: 'pricing for students' })).status).toBe(200);
    expect(sent.at(-1)).toContain('The user wants you to focus on: pricing for students');
    expect((await post(agentRound.POST, body)).status).toBe(200);
    expect(sent.at(-1)).not.toContain('focus on');
    expect((await post(agentRound.POST, { ...body, focus: 'x'.repeat(301) })).status).toBe(400);
  });

  it('takeaway with an unknown leaf is replaced by the fallback', async () => {
    modelSays({ leaf: 'nope', verdict: 'Do it.', brief: 'Because.' });
    const res = await post(takeaway.POST, { idea, mapLines: mapLines(nodes), links: [], nodes });
    const body = await res.json();
    expect(body.meta).toMatchObject({ source: 'fallback', error: 'unknown leaf' });
    expect(nodes.some((n) => n.id === body.data.leaf)).toBe(true);
  });

  it('takeaway with a known leaf is passed through', async () => {
    modelSays({ leaf: 'b0c0', verdict: 'Do it.', brief: 'Because.' });
    const res = await post(takeaway.POST, { idea, mapLines: mapLines(nodes), links: [], nodes });
    const body = await res.json();
    expect(body.meta.source).toBe('model');
    expect(body.data.leaf).toBe('b0c0');
  });

  it('expand validates its body', async () => {
    const res = await post(expand.POST, { title: 'x', summary: '', path: [], existing: [] });
    expect(res.status).toBe(400);
  });
});
