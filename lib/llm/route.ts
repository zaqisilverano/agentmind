import { fail, withUser } from '@/lib/api';
import { getLlmLimiter } from '@/lib/rateLimit';
import type { GenerateMeta } from './generate';

type Handler = (req: Request) => Promise<{ data: unknown; meta: GenerateMeta }>;

/** Shared shell for the LLM routes: identity, per-user rate limit, then `{ data, meta }` at the top level. */
export const llmRoute = (handler: Handler) =>
  withUser(async (req, { userId }) => {
    const limit = getLlmLimiter().take(userId);
    if (!limit.ok) {
      const res = fail(429, 'rate limit exceeded');
      res.headers.set('Retry-After', String(limit.retryAfter));
      return res;
    }
    const { data, meta } = await handler(req);
    return Response.json({ data, meta });
  });
