import { and, asc, count, desc, eq, max } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { brains, links, logEntries, nodes, users } from '@/db/schema';
import type { AgentId, Brain, IdeaNode, Kind } from '@/engine/types';
import { HttpError } from '@/lib/api';
import { MAX_BRAINS_PER_USER } from '@/lib/brains/limits';
import type { CreateBrainInput, PatchBrainInput } from '@/lib/brains/schemas';
import { sampleBrain } from '@/lib/sample/toolLibrary';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Exec = Db | Tx;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new HttpError(404, 'not found');

/** Throws 404 unless the brain exists and belongs to userId. With lock, also takes a row lock for the rest of the transaction. */
export async function assertOwned(db: Exec, userId: string, brainId: string, lock = false): Promise<void> {
  if (!UUID.test(brainId)) throw notFound();
  const q = db.select({ id: brains.id }).from(brains).where(and(eq(brains.id, brainId), eq(brains.userId, userId)));
  const [row] = lock ? await q.for('update') : await q;
  if (!row) throw notFound();
}

export const nodeRow = (brainId: string, n: IdeaNode) => ({
  brainId, id: n.id, name: n.name, note: n.note, userNote: n.userNote, kind: n.kind, parentId: n.parent, depth: n.depth, color: n.color, by: n.by, critic: n.critic, position: n.position,
});

export interface BrainSummary { id: string; number: number; title: string; nodeCount: number; updatedAt: Date }

export async function getUser(db: Db, id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u ?? null;
}

export async function listBrains(db: Db, userId: string): Promise<BrainSummary[]> {
  return db
    .select({ id: brains.id, number: brains.number, title: brains.title, nodeCount: count(nodes.id), updatedAt: brains.updatedAt })
    .from(brains)
    .leftJoin(nodes, eq(nodes.brainId, brains.id))
    .where(eq(brains.userId, userId))
    .groupBy(brains.id)
    .orderBy(desc(brains.number));
}

/** Gives a user with no brains the sample brain as number 1. Safe under concurrent calls. */
export async function ensureSample(db: Db, userId: string): Promise<void> {
  const existing = await db.select({ id: brains.id }).from(brains).where(eq(brains.userId, userId)).limit(1);
  if (existing.length > 0) return;
  const sample = sampleBrain('#1B1A17');
  await db.transaction(async (tx) => {
    const [brain] = await tx
      .insert(brains)
      .values({ userId, number: 1, title: sample.title, summary: sample.summary })
      .onConflictDoNothing()
      .returning({ id: brains.id });
    if (!brain) return;
    await tx.insert(nodes).values(
      sample.nodes.map((n) => ({
        brainId: brain.id,
        id: n.id,
        name: n.name,
        note: n.note,
        userNote: n.userNote,
        kind: n.kind,
        parentId: n.parent,
        depth: n.depth,
        color: n.color,
        by: n.by,
        critic: n.critic,
        position: n.position,
      })),
    );
  });
}

/** Throws 400 unless every node's parent is non-null and exists (in the brain already, or earlier in the same batch). */
export function checkParents(known: Set<string>, batch: IdeaNode[]): void {
  const ids = new Set(known);
  for (const n of batch) ids.add(n.id);
  for (const n of batch) if (n.parent === null || !ids.has(n.parent)) throw new HttpError(400, 'node references unknown parent');
}

export async function getBrain(db: Exec, userId: string, id: string): Promise<Brain> {
  if (!UUID.test(id)) throw notFound();
  const [b] = await db.select().from(brains).where(and(eq(brains.id, id), eq(brains.userId, userId)));
  if (!b) throw notFound();
  const [ns, ls, log] = await Promise.all([
    db.select().from(nodes).where(eq(nodes.brainId, id)).orderBy(asc(nodes.depth), asc(nodes.position), asc(nodes.id)),
    db.select().from(links).where(eq(links.brainId, id)).orderBy(asc(links.a), asc(links.b)),
    db.select().from(logEntries).where(eq(logEntries.brainId, id)).orderBy(asc(logEntries.seq)),
  ]);
  return {
    id: b.id,
    number: b.number,
    title: b.title,
    summary: b.summary,
    round: b.round,
    synth: b.synth ?? null,
    nodes: ns.map((n) => ({
      id: n.id, name: n.name, note: n.note, userNote: n.userNote, kind: n.kind as Kind, parent: n.parentId, depth: n.depth, color: n.color, by: n.by as AgentId | null, critic: n.critic, position: n.position,
    })),
    links: ls.map((l) => ({ a: l.a, b: l.b, why: l.why, by: l.by as AgentId })),
    log: log.map((e) => ({ seq: e.seq, agent: e.agent as AgentId, text: e.text, node: e.nodeId, tag: e.tag })),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function createBrain(db: Db, userId: string, body: CreateBrainInput): Promise<Brain> {
  const id = await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update'); // serialises number assignment per user
    const [{ top, total }] = await tx.select({ top: max(brains.number), total: count() }).from(brains).where(eq(brains.userId, userId));
    if (total >= MAX_BRAINS_PER_USER) throw new HttpError(400, 'brain limit reached');
    const ids = new Set(body.nodes.map((n) => n.id));
    if (ids.size !== body.nodes.length) throw new HttpError(400, 'duplicate node ids');
    for (const n of body.nodes) if (n.parent !== null && !ids.has(n.parent)) throw new HttpError(400, 'node references unknown parent');
    for (const l of body.links) if (!ids.has(l.a) || !ids.has(l.b)) throw new HttpError(400, 'link references unknown node');
    const [row] = await tx.insert(brains).values({ userId, number: (top ?? 0) + 1, title: body.title, summary: body.summary }).returning({ id: brains.id });
    await tx.insert(nodes).values(body.nodes.map((n) => nodeRow(row.id, n)));
    if (body.links.length > 0) {
      const unique = [...new Map(body.links.map((l) => [`${l.a}\u0000${l.b}`, l])).values()];
      await tx.insert(links).values(unique.map((l) => ({ brainId: row.id, a: l.a, b: l.b, why: l.why, by: l.by })));
    }
    return row.id;
  });
  return getBrain(db, userId, id);
}

export async function patchBrain(db: Db, userId: string, id: string, body: PatchBrainInput): Promise<Brain> {
  await assertOwned(db, userId, id);
  await db.update(brains).set({ ...body, updatedAt: new Date() }).where(eq(brains.id, id));
  return getBrain(db, userId, id);
}

export async function deleteBrain(db: Db, userId: string, id: string): Promise<void> {
  await assertOwned(db, userId, id);
  await db.delete(brains).where(eq(brains.id, id));
}
