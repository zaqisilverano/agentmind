import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from './_harness';
import { brains, links, logEntries, nodes } from '@/db/schema';

process.env.COOKIE_SECRET = 's'.repeat(32);
process.env.DATABASE_URL = 'postgres://unused';
process.env.LLM_BASE_URL = 'http://x';
process.env.LLM_MODEL = 'm';

const me = await import('@/app/api/me/route');
const list = await import('@/app/api/brains/route');
const one = await import('@/app/api/brains/[id]/route');
const nodesRoute = await import('@/app/api/brains/[id]/nodes/route');
const linksRoute = await import('@/app/api/brains/[id]/links/route');
const rounds = await import('@/app/api/brains/[id]/rounds/route');
const takeaway = await import('@/app/api/brains/[id]/takeaway/route');

type Handler = (req: Request, ctx?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

let db: Awaited<ReturnType<typeof makeTestDb>>;

async function asUser(): Promise<string> {
  const res = await me.GET(new Request('http://t/api/me'));
  return res.headers.get('set-cookie')!.split(';')[0];
}

async function call(handler: Handler, method: string, path: string, body?: unknown, cookie?: string, id?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  const res = await handler(new Request(`http://t${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), {
    params: Promise.resolve<Record<string, string>>(id ? { id } : {}),
  });
  return { status: res.status, body: await res.json() };
}

const node = (id: string, parent: string | null, depth: number, extra: Record<string, unknown> = {}) => ({
  id, name: id, note: '', kind: parent === null ? 'Core' : 'Problem', parent, depth, color: '#E0482B', position: 0, ...extra,
});

async function sampleId(cookie: string): Promise<string> {
  const { body } = await call(me.GET as Handler, 'GET', '/api/me', undefined, cookie);
  return body.data.brains[0].id;
}

const countNodes = async (brainId: string) => (await db.select().from(nodes).where(eq(nodes.brainId, brainId))).length;

describe('brain routes', () => {
  beforeAll(async () => {
    db = await makeTestDb();
  });

  it('(a) create assigns the next number after the sample', async () => {
    const cookie = await asUser();
    await sampleId(cookie);
    const mk = (title: string) => call(list.POST, 'POST', '/api/brains', { title, nodes: [node('n0', null, 0)] }, cookie);
    const one2 = await mk('Two');
    const one3 = await mk('Three');
    expect(one2.status).toBe(200);
    expect(one2.body.data).toMatchObject({ number: 2, title: 'Two', round: 0, synth: null, links: [], log: [] });
    expect(one2.body.data.nodes).toHaveLength(1);
    expect(one3.body.data.number).toBe(3);
    const listed = await call(list.GET, 'GET', '/api/brains', undefined, cookie);
    expect(listed.body.data.map((b: { number: number }) => b.number)).toEqual([3, 2, 1]);
  });

  it('rejects a create without exactly one n0 root', async () => {
    const cookie = await asUser();
    const res = await call(list.POST, 'POST', '/api/brains', { title: 'x', nodes: [node('a', null, 0)] }, cookie);
    expect(res.status).toBe(400);
  });

  it('(b) another user gets 404 on read, write and delete', async () => {
    const a = await asUser();
    const b = await asUser();
    const id = await sampleId(a);
    expect((await call(one.GET, 'GET', `/api/brains/${id}`, undefined, a, id)).status).toBe(200);
    expect((await call(one.GET, 'GET', `/api/brains/${id}`, undefined, b, id)).status).toBe(404);
    expect((await call(one.PATCH, 'PATCH', `/api/brains/${id}`, { title: 'x' }, b, id)).status).toBe(404);
    expect((await call(one.DELETE, 'DELETE', `/api/brains/${id}`, undefined, b, id)).status).toBe(404);
    expect((await call(nodesRoute.PATCH, 'PATCH', `/api/brains/${id}/nodes`, { id: 'b0', name: 'x' }, b, id)).status).toBe(404);
    expect((await call(rounds.POST, 'POST', `/api/brains/${id}/rounds`, { round: 1, nodes: [], log: { seq: 1, agent: 'skeptic', text: 't', node: 'n0', tag: 'x' } }, b, id)).status).toBe(404);
    expect((await call(one.GET, 'GET', '/api/brains/not-a-uuid', undefined, a, 'not-a-uuid')).status).toBe(404);
  });

  it('PATCH brain updates fields', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    const res = await call(one.PATCH, 'PATCH', `/api/brains/${id}`, { title: 'Renamed', round: 2 }, cookie, id);
    expect(res.body.data).toMatchObject({ title: 'Renamed', round: 2 });
  });

  it('(c) PATCH node userNote persists', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    const res = await call(nodesRoute.PATCH, 'PATCH', `/api/brains/${id}/nodes`, { id: 'b0', userNote: 'my thought' }, cookie, id);
    expect(res.status).toBe(200);
    const fetched = await call(one.GET, 'GET', `/api/brains/${id}`, undefined, cookie, id);
    expect(fetched.body.data.nodes.find((n: { id: string }) => n.id === 'b0').userNote).toBe('my thought');
    const missing = await call(nodesRoute.PATCH, 'PATCH', `/api/brains/${id}/nodes`, { id: 'zzz', name: 'x' }, cookie, id);
    expect(missing.status).toBe(404);
  });

  it('POST nodes inserts and ignores ids that already exist', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    const before = await countNodes(id);
    const res = await call(nodesRoute.POST, 'POST', `/api/brains/${id}/nodes`, { nodes: [node('b0cx1', 'b0', 2), node('b0c0', 'b0', 2, { name: 'dup' })] }, cookie, id);
    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(before + 1);
    expect(res.body.data.nodes.find((n: { id: string }) => n.id === 'b0c0').name).not.toBe('dup');
    const orphan = await call(nodesRoute.POST, 'POST', `/api/brains/${id}/nodes`, { nodes: [node('q1', 'nope', 2)] }, cookie, id);
    expect(orphan.status).toBe(400);
  });

  it('(d) DELETE subtree removes descendants and links, refuses n0', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    await call(linksRoute.POST, 'POST', `/api/brains/${id}/links`, { links: [{ a: 'b0c0', b: 'b1', why: 'w', by: 'builder' }, { a: 'b1', b: 'b2', by: 'builder' }] }, cookie, id);
    const res = await call(nodesRoute.DELETE, 'DELETE', `/api/brains/${id}/nodes`, { id: 'b0' }, cookie, id);
    expect(res.status).toBe(200);
    const ids = res.body.data.nodes.map((n: { id: string }) => n.id);
    expect(ids.some((i: string) => i === 'b0' || i.startsWith('b0c'))).toBe(false);
    expect(ids).toContain('b1');
    expect(res.body.data.links).toEqual([{ a: 'b1', b: 'b2', why: '', by: 'builder' }]);
    const core = await call(nodesRoute.DELETE, 'DELETE', `/api/brains/${id}/nodes`, { id: 'n0' }, cookie, id);
    expect(core.status).toBe(400);
    expect(core.body.error).toBe('cannot delete the core');
  });

  it('POST links upserts and rejects unknown node ids', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    const mk = (why: string) => call(linksRoute.POST, 'POST', `/api/brains/${id}/links`, { links: [{ a: 'b0', b: 'b3', why, by: 'skeptic' }] }, cookie, id);
    await mk('first');
    const res = await mk('second');
    expect(res.body.data.links).toEqual([{ a: 'b0', b: 'b3', why: 'second', by: 'skeptic' }]);
    const bad = await call(linksRoute.POST, 'POST', `/api/brains/${id}/links`, { links: [{ a: 'b0', b: 'nope', by: 'skeptic' }] }, cookie, id);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('link references unknown node');
  });

  it('(e) rounds apply nodes, links and log atomically', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    const log = { seq: 99, agent: 'builder', text: 'added things', node: 'b0', tag: 'Diverge' };
    const ok = await call(rounds.POST, 'POST', `/api/brains/${id}/rounds`, {
      round: 1,
      nodes: [node('r1', 'b0', 2, { by: 'builder' })],
      links: [{ a: 'r1', b: 'b1', why: 'x', by: 'builder' }],
      log,
    }, cookie, id);
    expect(ok.status).toBe(200);
    expect(ok.body.data.round).toBe(1);
    expect(ok.body.data.nodes.some((n: { id: string }) => n.id === 'r1')).toBe(true);
    expect(ok.body.data.links).toHaveLength(1);
    expect(ok.body.data.log).toEqual([{ ...log, seq: 1 }]);

    const before = await countNodes(id);
    const bad = await call(rounds.POST, 'POST', `/api/brains/${id}/rounds`, {
      round: 2,
      nodes: [node('r2', 'b0', 2)],
      links: [{ a: 'r2', b: 'missing', why: '', by: 'builder' }],
      log,
    }, cookie, id);
    expect(bad.status).toBe(400);
    expect(await countNodes(id)).toBe(before);
    expect((await db.select().from(logEntries).where(eq(logEntries.brainId, id))).length).toBe(1);
    const [row] = await db.select().from(brains).where(eq(brains.id, id));
    expect(row.round).toBe(1);

    const again = await call(rounds.POST, 'POST', `/api/brains/${id}/rounds`, { round: 2, nodes: [], links: [], log }, cookie, id);
    expect(again.body.data.log.map((l: { seq: number }) => l.seq)).toEqual([1, 2]);
  });

  it('(f) takeaway sets synth and appends a Takeaway log entry', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    const synth = { path: ['n0', 'b0'], verdict: 'Go', brief: 'Do it.' };
    const res = await call(takeaway.POST, 'POST', `/api/brains/${id}/takeaway`, {
      synth,
      log: { seq: 5, agent: 'strategist', text: 'Takeaway ready', node: 'n0', tag: 'ignored' },
    }, cookie, id);
    expect(res.status).toBe(200);
    expect(res.body.data.synth).toEqual(synth);
    expect(res.body.data.log).toHaveLength(1);
    expect(res.body.data.log[0]).toMatchObject({ seq: 1, tag: 'Takeaway', agent: 'strategist' });
  });

  it('(g) DELETE brain cascades', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    await call(linksRoute.POST, 'POST', `/api/brains/${id}/links`, { links: [{ a: 'b0', b: 'b1', by: 'builder' }] }, cookie, id);
    const res = await call(one.DELETE, 'DELETE', `/api/brains/${id}`, undefined, cookie, id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { ok: true } });
    expect(await countNodes(id)).toBe(0);
    expect((await db.select().from(links).where(eq(links.brainId, id))).length).toBe(0);
    expect((await call(one.GET, 'GET', `/api/brains/${id}`, undefined, cookie, id)).status).toBe(404);
  });

  it('rejects non-JSON content type and malformed bodies', async () => {
    const cookie = await asUser();
    const id = await sampleId(cookie);
    const res = await one.PATCH(new Request('http://t/x', { method: 'PATCH', headers: { cookie, 'content-type': 'text/plain' }, body: '{}' }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(415);
    expect((await call(one.PATCH, 'PATCH', `/api/brains/${id}`, { title: '' }, cookie, id)).status).toBe(400);
  });
});
