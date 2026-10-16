import { fail, withUser } from '@/lib/api';
import { clientIp } from '@/lib/clientIp';
import { getIpLimiter, getLlmLimiter } from '@/lib/rateLimit';
import type { GenerateMeta } from '@/lib/llm/generate';

type Handler = (req: Request) => Promise<{ data: unknown; meta: GenerateMeta }>;

const limited = (retryAfter: number): Response => {
  const res = fail(429, 'rate limit exceeded');
  res.headers.set('Retry-After', String(retryAfter));
  return res;
};

/**
 * Shared shell for the LLM routes: identity, per-IP then per-user rate limits, then `{ data, meta }` at the top level.
 * The user budget is only spent once the IP check passed.
 */
export const llmRoute = (handler: Handler) =>
  withUser(async (req, { userId }) => {
    const byIp = getIpLimiter().take(clientIp(req));
    if (!byIp.ok) return limited(byIp.retryAfter);
    const byUser = getLlmLimiter().take(userId);
    if (!byUser.ok) return limited(byUser.retryAfter);
    const { data, meta } = await handler(req);
    return Response.json({ data, meta });
  });
