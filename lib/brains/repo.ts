import { count, desc, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { brains, nodes, users } from '@/db/schema';
import { sampleBrain } from '@/lib/sample/toolLibrary';

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
