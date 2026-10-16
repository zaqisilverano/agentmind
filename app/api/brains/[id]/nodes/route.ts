import { getDb } from '@/db/client';
import { json, readBody, withUser } from '@/lib/api';
import { addNodes, deleteSubtree, patchNode } from '@/lib/brains/repoNodes';
import { AddNodesBody, DeleteNodeBody, PatchNodeBody } from '@/lib/brains/schemas';

export const POST = withUser(async (req, { userId, params }) => json(await addNodes(getDb(), userId, params.id, (await readBody(req, AddNodesBody)).nodes)));

export const PATCH = withUser(async (req, { userId, params }) => json(await patchNode(getDb(), userId, params.id, await readBody(req, PatchNodeBody))));

export const DELETE = withUser(async (req, { userId, params }) => json(await deleteSubtree(getDb(), userId, params.id, (await readBody(req, DeleteNodeBody)).id)));
