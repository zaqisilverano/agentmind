import { getDb } from '@/db/client';
import { json, readBody, withUser } from '@/lib/api';
import { deleteBrain, getBrain, patchBrain } from '@/lib/brains/repo';
import { PatchBrainBody } from '@/lib/brains/schemas';

export const GET = withUser(async (_req, { userId, params }) => json(await getBrain(getDb(), userId, params.id)));

export const PATCH = withUser(async (req, { userId, params }) => json(await patchBrain(getDb(), userId, params.id, await readBody(req, PatchBrainBody))));

export const DELETE = withUser(async (_req, { userId, params }) => {
  await deleteBrain(getDb(), userId, params.id);
  return json({ ok: true });
});
