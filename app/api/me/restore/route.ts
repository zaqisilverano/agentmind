import { z } from 'zod';
import { getDb } from '@/db/client';
import { fail, guard, HttpError, json, requireJsonSameOrigin } from '@/lib/api';
import { getUser } from '@/lib/brains/repo';
import { getEnv } from '@/lib/env';
import { cookieHeader } from '@/lib/identity';

const body = z.object({ id: z.string().uuid() });

export const POST = (req: Request): Promise<Response> =>
  guard(async () => {
    requireJsonSameOrigin(req);
    const raw: unknown = await req.json().catch(() => {
      throw new HttpError(400, 'invalid JSON body');
    });
    const { id } = body.parse(raw);
    const user = await getUser(getDb(), id);
    if (!user) return fail(404, 'unknown id');
    const res = json({ ok: true });
    res.headers.append('Set-Cookie', cookieHeader(user.id, { secure: getEnv().NODE_ENV === 'production' }));
    return res;
  });
