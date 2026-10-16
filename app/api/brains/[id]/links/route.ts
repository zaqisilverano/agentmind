import { getDb } from '@/db/client';
import { json, readBody, withUser } from '@/lib/api';
import { addLinks } from '@/lib/brains/repoNodes';
import { AddLinksBody } from '@/lib/brains/schemas';

export const POST = withUser(async (req, { userId, params }) => json(await addLinks(getDb(), userId, params.id, (await readBody(req, AddLinksBody)).links)));
