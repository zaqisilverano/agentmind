import { getDb } from '@/db/client';
import { json, readBody, withUser } from '@/lib/api';
import { applyRound } from '@/lib/brains/repoNodes';
import { RoundBody } from '@/lib/brains/schemas';

export const POST = withUser(async (req, { userId, params }) => json(await applyRound(getDb(), userId, params.id, await readBody(req, RoundBody))));
