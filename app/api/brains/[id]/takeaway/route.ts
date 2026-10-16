import { getDb } from '@/db/client';
import { json, readBody, withUser } from '@/lib/api';
import { setTakeaway } from '@/lib/brains/repoNodes';
import { TakeawayBody } from '@/lib/brains/schemas';

export const POST = withUser(async (req, { userId, params }) => json(await setTakeaway(getDb(), userId, params.id, await readBody(req, TakeawayBody))));
