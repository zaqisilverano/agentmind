import { getDb } from '@/db/client';
import { json, readBody, withUser } from '@/lib/api';
import { createBrain, listBrains } from '@/lib/brains/repo';
import { CreateBrainBody } from '@/lib/brains/schemas';

export const GET = withUser(async (_req, { userId }) => json(await listBrains(getDb(), userId)));

export const POST = withUser(async (req, { userId }) => json(await createBrain(getDb(), userId, await readBody(req, CreateBrainBody))));
