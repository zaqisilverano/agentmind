import { and, eq, inArray, max, or, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { brains, links, logEntries, nodes } from '@/db/schema';
import type { Brain } from '@/engine/types';
import { HttpError } from '@/lib/api';
import type { LinkInput, NodeInput, PatchNodeInput, RoundInput, TakeawayInput } from '@/lib/brains/schemas';
import { assertOwned, checkParents, getBrain, nodeRow, type Tx } from '@/lib/brains/repo';

const sqlExcluded = (col: string) => sql.raw(`excluded."${col}"`);

const touch = (tx: Tx, brainId: string, extra: Partial<typeof brains.$inferInsert> = {}) =>
  tx.update(brains).set({ ...extra, updatedAt: new Date() }).where(eq(brains.id, brainId));

async function brainNodeIds(tx: Tx, brainId: string): Promise<Set<string>> {
  const rows = await tx.select({ id: nodes.id }).from(nodes).where(eq(nodes.brainId, brainId));
  return new Set(rows.map((r) => r.id));
}

/** Inserts nodes whose ids are new; existing ids are ignored. Parents must already exist or come earlier in the batch. */
async function insertNodes(tx: Tx, brainId: string, batch: NodeInput[]): Promise<void> {
  if (batch.length === 0) return;
  const existing = await brainNodeIds(tx, brainId);
  const fresh = batch.filter((n) => !existing.has(n.id));
  checkParents(existing, fresh);
  if (fresh.length > 0) await tx.insert(nodes).values(fresh.map((n) => nodeRow(brainId, n))).onConflictDoNothing();
}

/** Upserts links on (brain, a, b) after checking both ends exist (counting nodes inserted earlier in the same transaction). */
async function upsertLinks(tx: Tx, brainId: string, batch: LinkInput[]): Promise<void> {
  if (batch.length === 0) return;
  const ids = await brainNodeIds(tx, brainId);
  for (const l of batch) if (!ids.has(l.a) || !ids.has(l.b)) throw new HttpError(400, 'link references unknown node');
  const unique = [...new Map(batch.map((l) => [`${l.a}\u0000${l.b}`, l])).values()];
  await tx
    .insert(links)
    .values(unique.map((l) => ({ brainId, a: l.a, b: l.b, why: l.why, by: l.by })))
    .onConflictDoUpdate({ target: [links.brainId, links.a, links.b], set: { why: sqlExcluded('why'), by: sqlExcluded('by') } });
}

async function appendLog(tx: Tx, brainId: string, entry: RoundInput['log'], tag: string): Promise<void> {
  const [{ top }] = await tx.select({ top: max(logEntries.seq) }).from(logEntries).where(eq(logEntries.brainId, brainId));
  await tx.insert(logEntries).values({ brainId, seq: (top ?? 0) + 1, agent: entry.agent, text: entry.text, nodeId: entry.node, tag });
}

export async function addNodes(db: Db, userId: string, brainId: string, batch: NodeInput[]): Promise<Brain> {
  await db.transaction(async (tx) => {
    await assertOwned(tx, userId, brainId, true);
    await insertNodes(tx, brainId, batch);
    await touch(tx, brainId);
  });
  return getBrain(db, userId, brainId);
}

export async function patchNode(db: Db, userId: string, brainId: string, patch: PatchNodeInput): Promise<Brain> {
  const { id, ...fields } = patch;
  const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  await db.transaction(async (tx) => {
    await assertOwned(tx, userId, brainId, true);
    if (Object.keys(set).length > 0) {
      const res = await tx.update(nodes).set(set).where(and(eq(nodes.brainId, brainId), eq(nodes.id, id))).returning({ id: nodes.id });
      if (res.length === 0) throw new HttpError(404, 'node not found');
    } else if (!(await brainNodeIds(tx, brainId)).has(id)) throw new HttpError(404, 'node not found');
    await touch(tx, brainId);
  });
  return getBrain(db, userId, brainId);
}

/** Deletes a node, all its descendants and every link touching them. The core (n0) cannot be deleted. */
export async function deleteSubtree(db: Db, userId: string, brainId: string, nodeId: string): Promise<Brain> {
  await db.transaction(async (tx) => {
    await assertOwned(tx, userId, brainId, true); // ownership first (404 beats 400), and hold the lock across read-compute-delete
    if (nodeId === 'n0') throw new HttpError(400, 'cannot delete the core');
    const rows = await tx.select({ id: nodes.id, parentId: nodes.parentId }).from(nodes).where(eq(nodes.brainId, brainId));
    if (!rows.some((r) => r.id === nodeId)) throw new HttpError(404, 'node not found');
    const doomed = new Set([nodeId]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const r of rows) {
        if (r.parentId !== null && doomed.has(r.parentId) && !doomed.has(r.id)) {
          doomed.add(r.id);
          grew = true;
        }
      }
    }
    const ids = [...doomed];
    await tx.delete(links).where(and(eq(links.brainId, brainId), or(inArray(links.a, ids), inArray(links.b, ids))));
    await tx.delete(nodes).where(and(eq(nodes.brainId, brainId), inArray(nodes.id, ids)));
    await touch(tx, brainId);
  });
  return getBrain(db, userId, brainId);
}

export async function addLinks(db: Db, userId: string, brainId: string, batch: LinkInput[]): Promise<Brain> {
  await db.transaction(async (tx) => {
    await assertOwned(tx, userId, brainId, true);
    await upsertLinks(tx, brainId, batch);
    await touch(tx, brainId);
  });
  return getBrain(db, userId, brainId);
}

/** One transaction: nodes, links, a log entry (server-assigned seq) and the round counter. Any failure persists nothing. */
export async function applyRound(db: Db, userId: string, brainId: string, body: RoundInput): Promise<Brain> {
  await db.transaction(async (tx) => {
    await assertOwned(tx, userId, brainId, true);
    await insertNodes(tx, brainId, body.nodes);
    await upsertLinks(tx, brainId, body.links);
    await appendLog(tx, brainId, body.log, body.log.tag);
    await touch(tx, brainId, { round: body.round });
  });
  return getBrain(db, userId, brainId);
}

/** One transaction: set the takeaway and append its log entry (tag forced to 'Takeaway'). */
export async function setTakeaway(db: Db, userId: string, brainId: string, body: TakeawayInput): Promise<Brain> {
  await db.transaction(async (tx) => {
    await assertOwned(tx, userId, brainId, true);
    await appendLog(tx, brainId, body.log, 'Takeaway');
    await touch(tx, brainId, { synth: body.synth });
  });
  return getBrain(db, userId, brainId);
}
