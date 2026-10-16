import { getDb } from '@/db/client';
import { json, withUser } from '@/lib/api';
import { ensureSample, getUser, listBrains } from '@/lib/brains/repo';

export const GET = withUser(async (_req, { userId }) => {
  const db = getDb();
  await ensureSample(db, userId);
  const user = await getUser(db, userId);
  return json({ user: { id: userId, createdAt: user?.createdAt }, brains: await listBrains(db, userId) });
});
