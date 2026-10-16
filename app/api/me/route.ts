import { getDb } from '@/db/client';
import { json, withUser } from '@/lib/api';
import { getUser, listBrains } from '@/lib/brains/repo';

export const GET = withUser(async (_req, { userId }) => {
  const db = getDb();
  const user = await getUser(db, userId);
  return json({ user: { id: userId, createdAt: user?.createdAt }, brains: await listBrains(db, userId) });
});
