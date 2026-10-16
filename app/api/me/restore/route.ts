import { z } from 'zod';
import { getDb } from '@/db/client';
import { fail, guard, json, readBody } from '@/lib/api';
import { getUser } from '@/lib/brains/repo';
import { getEnv } from '@/lib/env';
import { cookieHeader } from '@/lib/identity';

const RestoreBody = z.object({ id: z.string().uuid() });

export const POST = (req: Request): Promise<Response> =>
  guard(async () => {
    const { id } = await readBody(req, RestoreBody);
    const user = await getUser(getDb(), id);
    if (!user) return fail(404, 'unknown id');
    const res = json({ ok: true });
    res.headers.append('Set-Cookie', cookieHeader(user.id, { secure: getEnv().NODE_ENV === 'production' }));
    return res;
  });
