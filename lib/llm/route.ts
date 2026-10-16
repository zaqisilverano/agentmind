import { fail, withUser } from '@/lib/api';
import { getIpLimiter, getLlmLimiter } from '@/lib/rateLimit';
import type { GenerateMeta } from './generate';

type Handler = (req: Request) => Promise<{ data: unknown; meta: GenerateMeta }>;

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Shared shell for the LLM routes: identity, per-user and per-IP rate limits, then `{ data, meta }` at the top level. */
export const llmRoute = (handler: Handler) =>
  withUser(async (req, { userId }) => {
    const byUser = getLlmLimiter().take(userId);
    const byIp = getIpLimiter().take(clientIp(req));
    if (!byUser.ok || !byIp.ok) {
      const res = fail(429, 'rate limit exceeded');
      res.headers.set('Retry-After', String(Math.max(byUser.retryAfter, byIp.retryAfter)));
      return res;
    }
    const { data, meta } = await handler(req);
    return Response.json({ data, meta });
  });
