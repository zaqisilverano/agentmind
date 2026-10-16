import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from './_harness';
import { users, brains, nodes, links, logEntries } from '@/db/schema';

const node = (brainId: string, id: string, name = 'T') => ({ brainId, id, name, note: '', kind: 'Core', parentId: null, depth: 0, color: '#000', position: 0 });

describe('schema', () => {
  let db: Awaited<ReturnType<typeof makeTestDb>>;
  beforeAll(async () => { db = await makeTestDb(); });

  it('inserts a user, brain and node with composite key', async () => {
    const [u] = await db.insert(users).values({}).returning();
    const [b] = await db.insert(brains).values({ userId: u.id, number: 1, title: 'T', summary: '' }).returning();
    await db.insert(nodes).values(node(b.id, 'n0'));
    await expect(db.insert(nodes).values(node(b.id, 'n0', 'dup'))).rejects.toThrow();
  });

  it('applies column defaults', async () => {
    const [u] = await db.insert(users).values({}).returning();
    const [b] = await db.insert(brains).values({ userId: u.id, number: 1, title: 'D' }).returning();
    expect(b.summary).toBe('');
    expect(b.round).toBe(0);
    expect(b.synth).toBeNull();
    expect(b.createdAt).toBeInstanceOf(Date);
    const [n] = await db.insert(nodes).values(node(b.id, 'n0')).returning();
    expect(n.userNote).toBe('');
    expect(n.critic).toBe(false);
    expect(n.by).toBeNull();
  });

  it('enforces unique (user, number)', async () => {
    const [u] = await db.insert(users).values({}).returning();
    await db.insert(brains).values({ userId: u.id, number: 1, title: 'A' });
    await expect(db.insert(brains).values({ userId: u.id, number: 1, title: 'B' })).rejects.toThrow();
    await db.insert(brains).values({ userId: u.id, number: 2, title: 'B' });
  });

  it('round-trips synth jsonb', async () => {
    const [u] = await db.insert(users).values({}).returning();
    const synth = { path: ['n0', 'b0'], verdict: 'v', brief: 'b' };
    const [b] = await db.insert(brains).values({ userId: u.id, number: 1, title: 'S', synth }).returning();
    expect(b.synth).toEqual(synth);
  });

  it('cascades deletes from brain to children and from user to brains', async () => {
    const [u] = await db.insert(users).values({}).returning();
    const [b] = await db.insert(brains).values({ userId: u.id, number: 1, title: 'C' }).returning();
    await db.insert(nodes).values([node(b.id, 'n0'), node(b.id, 'b0')]);
    await db.insert(links).values({ brainId: b.id, a: 'n0', b: 'b0', why: '', by: 'builder' });
    await db.insert(logEntries).values({ brainId: b.id, seq: 1, agent: 'builder', text: 't', nodeId: 'n0', tag: 'x' });
    await db.delete(users).where(eq(users.id, u.id));
    expect(await db.select().from(brains).where(eq(brains.id, b.id))).toHaveLength(0);
    expect(await db.select().from(nodes).where(eq(nodes.brainId, b.id))).toHaveLength(0);
    expect(await db.select().from(links).where(eq(links.brainId, b.id))).toHaveLength(0);
    expect(await db.select().from(logEntries).where(eq(logEntries.brainId, b.id))).toHaveLength(0);
  });
});
