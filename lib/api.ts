import { ZodError } from 'zod';
import { requireUser } from '@/lib/identity';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const json = (data: unknown, init?: ResponseInit): Response => Response.json({ data }, init);
export const fail = (status: number, message: string): Response => Response.json({ error: message }, { status });

/** CSRF guard for JSON POST routes: JSON content type, and same origin when an Origin header is sent. Throws HttpError. */
export function requireJsonSameOrigin(req: Request): void {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'expected application/json');
  const origin = req.headers.get('origin');
  if (origin !== null && origin !== new URL(req.url).origin) throw new HttpError(403, 'bad origin');
}

type Params = Record<string, string>;
type Ctx = { params?: Promise<Params> };
type Handler = (req: Request, ctx: { userId: string; params: Params }) => Promise<Response>;

/** Maps thrown ZodError / HttpError / anything else onto JSON error responses. */
export async function guard(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ZodError) return fail(400, e.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; '));
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, 'internal error');
  }
}

export function withUser(handler: Handler) {
  return (req: Request, ctx?: Ctx): Promise<Response> =>
    guard(async () => {
      const { userId, setCookie } = await requireUser(req);
      const params = (await ctx?.params) ?? {};
      const res = await handler(req, { userId, params });
      if (!setCookie) return res;
      const headers = new Headers(res.headers);
      headers.append('Set-Cookie', setCookie);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    });
}

/** Parses a JSON request body with a Zod schema, after the CSRF guard. Throws HttpError / ZodError. */
export async function readBody<T>(req: Request, schema: { parse(v: unknown): T }): Promise<T> {
  requireJsonSameOrigin(req);
  const raw: unknown = await req.json().catch(() => {
    throw new HttpError(400, 'invalid JSON body');
  });
  return schema.parse(raw);
}
