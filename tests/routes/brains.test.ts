import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from './_harness';
import { brains, links, logEntries, nodes } from '@/db/schema';
import { nodeRow } from '@/lib/brains/repo';
import { sampleBrain } from '@/lib/sample/toolLibrary';

process.env.COOKIE_SECRET = 's'.repeat(32);
process.env.DATABASE_URL = 'postgres://unused';
process.env.LLM_BASE_URL = 'http://x';
process.env.LLM_MODEL = 'm';
// Every asUser() mints a user from the same (unknown) IP; keep the new-session limiter out of the way.
process.env.RATE_LIMIT_PER_HOUR = '1000';

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

/** A first visit starts empty, so tests that need a populated brain create the Tool Library sample through the API. */
async function sampleId(cookie: string): Promise<string> {
  const { title, summary, nodes: sampleNodes } = sampleBrain('#1B1A17');
  const { status, body } = await call(list.POST, 'POST', '/api/brains', { title, summary, nodes: sampleNodes }, cookie);
  if (status !== 200) throw new Error(`could not create the sample brain: ${JSON.stringify(body)}`);
  return body.data.id;
}

const countNodes = async (brainId: string) => (await db.select().from(nodes).where(eq(nodes.brainId, brainId))).length;

describe('brain routes', () => {
  beforeAll(async () => {
    db = await makeTestDb();
  });

  it('(a) a new user has no brains; the first create is number 1, then 2', async () => {
    const cookie = await asUser();
    expect((await call(list.GET, 'GET', '/api/brains', undefined, cookie)).body.data).toEqual([]);
    const mk = (title: string) => call(list.POST, 'POST', '/api/brains', { title, nodes: [node('n0', null, 0)] }, cookie);
    const first = await mk('One');
    const second = await mk('Two');
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ number: 1, title: 'One', round: 0, synth: null, links: [], log: [] });
    expect(first.body.data.nodes).toHaveLength(1);
    expect(second.body.data.number).toBe(2);
    const listed = await call(list.GET, 'GET', '/api/brains', undefined, cookie);
    expect(listed.body.data.map((b: { number: number }) => b.number)).toEqual([2, 1]);
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

  describe('caps', () => {
    const fill = async (brainId: string, upTo: number) => {
      const have = await countNodes(brainId);
      const rows = Array.from({ length: upTo - have }, (_, i) => nodeRow(brainId, { ...node(`f${i}`, 'n0', 1), userNote: '', by: null, critic: false } as never));
      if (rows.length > 0) await db.insert(nodes).values(rows);
    };

    it('400s a create once the user has 100 brains', async () => {
      const cookie = await asUser();
      await sampleId(cookie);
      const { body } = await call(me.GET as Handler, 'GET', '/api/me', undefined, cookie);
      const userId = body.data.user.id;
      await db.insert(brains).values(Array.from({ length: 99 }, (_, i) => ({ userId, number: i + 2, title: `B${i + 2}` })));
      const res = await call(list.POST, 'POST', '/api/brains', { title: 'One too many', nodes: [node('n0', null, 0)] }, cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'brain limit reached' });
    });

    it('400s nodes and rounds that would take a brain past 300 nodes, and allows filling it to exactly 300', async () => {
      const cookie = await asUser();
      const id = await sampleId(cookie);
      await fill(id, 298);
      const log = { seq: 1, agent: 'builder', text: 't', node: 'n0', tag: 'x' };
      const over = await call(rounds.POST, 'POST', `/api/brains/${id}/rounds`, { round: 1, nodes: [node('o1', 'b0', 2), node('o2', 'b0', 2), node('o3', 'b0', 2)], log }, cookie, id);
      expect(over.status).toBe(400);
      expect(over.body).toEqual({ error: 'this brain is full (300 nodes)' });
      expect(await countNodes(id)).toBe(298);
      const fits = await call(nodesRoute.POST, 'POST', `/api/brains/${id}/nodes`, { nodes: [node('o1', 'b0', 2), node('o2', 'b0', 2)] }, cookie, id);
      expect(fits.status).toBe(200);
      expect(await countNodes(id)).toBe(300);
      const full = await call(nodesRoute.POST, 'POST', `/api/brains/${id}/nodes`, { nodes: [node('o3', 'b0', 2)] }, cookie, id);
      expect(full.status).toBe(400);
      expect(full.body).toEqual({ error: 'this brain is full (300 nodes)' });
      // A round that only re-sends existing nodes still saves its log on a full brain.
      const empty = await call(rounds.POST, 'POST', `/api/brains/${id}/rounds`, { round: 1, nodes: [node('o1', 'b0', 2)], log }, cookie, id);
      expect(empty.status).toBe(200);
    });
  });

  describe('same-origin check behind a proxy / standalone bind address', () => {
    const create = (cookie: string, headers: Record<string, string>) =>
      list.POST(new Request('http://0.0.0.0:3000/api/brains', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, ...headers },
        body: JSON.stringify({ title: 'Proxied', nodes: [node('n0', null, 0)] }),
      }));

    it('accepts an Origin that matches the Host header even when req.url carries the bind address', async () => {
      const cookie = await asUser();
      const res = await create(cookie, { host: 'brainstorm.example.com', origin: 'https://brainstorm.example.com' });
      expect(res.status).toBe(200);
      expect((await res.json()).data.title).toBe('Proxied');
    });

    it('prefers X-Forwarded-Host over Host', async () => {
      const cookie = await asUser();
      const ok = await create(cookie, { host: 'app:3000', 'x-forwarded-host': 'brainstorm.example.com', origin: 'https://brainstorm.example.com' });
      expect(ok.status).toBe(200);
      const bad = await create(cookie, { host: 'brainstorm.example.com', 'x-forwarded-host': 'other.example.com', origin: 'https://brainstorm.example.com' });
      expect(bad.status).toBe(403);
    });

    it('403s a mismatched host, an Origin of null and an unparsable Origin', async () => {
      const cookie = await asUser();
      for (const origin of ['https://evil.example', 'null', 'not a url']) {
        const res = await create(cookie, { host: 'brainstorm.example.com', origin });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'bad origin' });
      }
    });
  });

  it('413s a body over 256 KB and 400s a round with more than 200 nodes', async () => {
    const cookie = await asUser();
    const big = await call(list.POST, 'POST', '/api/brains', { title: 'x', summary: 'y'.repeat(300_000), nodes: [node('n0', null, 0)] }, cookie);
    expect(big.status).toBe(413);
    expect(big.body).toEqual({ error: 'body too large' });
    const id = await sampleId(cookie);
    const many = Array.from({ length: 201 }, (_, i) => node(`m${i}`, 'b0', 2));
    const res = await call(rounds.POST, 'POST', `/api/brains/${id}/rounds`, { round: 1, nodes: many, log: { seq: 1, agent: 'skeptic', text: 't', node: 'n0', tag: 'x' } }, cookie, id);
    expect(res.status).toBe(400);
  });

  it('413s a chunked body over 256 KB that sends no Content-Length', async () => {
    const cookie = await asUser();
    const chunk = new TextEncoder().encode('x'.repeat(32 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 100) return controller.close(); // 3.2 MB in all
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    const req = new Request('http://t/api/brains', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit);
    expect(req.headers.get('content-length')).toBeNull();
    const res = await list.POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'body too large' });
    expect(sent).toBeLessThan(20); // stopped reading soon after passing the cap
  });
});
