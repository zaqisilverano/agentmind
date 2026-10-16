import { z } from 'zod';
import { getDb } from '@/db/client';
import { fail, guard, HttpError, json } from '@/lib/api';
import { getUser } from '@/lib/brains/repo';
import { getEnv } from '@/lib/env';
import { cookieHeader } from '@/lib/identity';

const body = z.object({ id: z.string().uuid() });

export const POST = (req: Request): Promise<Response> =>
  guard(async () => {
    const raw: unknown = await req.json().catch(() => {
      throw new HttpError(400, 'invalid JSON body');
    });
    const { id } = body.parse(raw);
    if (!(await getUser(getDb(), id))) return fail(404, 'unknown id');
    const res = json({ ok: true });
    res.headers.append('Set-Cookie', cookieHeader(id, { secure: getEnv().NODE_ENV === 'production' }));
    return res;
  });
