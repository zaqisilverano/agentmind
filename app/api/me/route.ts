import { getDb } from '@/db/client';
import { json, withUser } from '@/lib/api';
import { getUser, listBrains } from '@/lib/brains/repo';
import { getEnv } from '@/lib/env';
import { providerLabel } from '@/lib/llm/providerLabel';

export const GET = withUser(async (_req, { userId }) => {
  const db = getDb();
  const user = await getUser(db, userId);
  // The configured LLM as a display label only: never the key or the base URL.
  const { LLM_API_KEY, LLM_MODEL } = getEnv();
  const configured = LLM_API_KEY !== '';
  const provider = { configured, label: providerLabel(LLM_MODEL, configured) };
  return json({ user: { id: userId, createdAt: user?.createdAt }, brains: await listBrains(db, userId), provider });
});
