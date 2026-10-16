import { readBody } from '@/lib/api';
import { TakeawayBody } from '@/lib/llm/bodies';
import { fallback } from '@/lib/llm/fallback';
import { generate } from '@/lib/llm/generate';
import { PROMPTS } from '@/lib/llm/prompts';
import { llmRoute } from '@/lib/llm/route';
import { TakeawayReplySchema } from '@/lib/llm/schemas';

export const POST = llmRoute(async (req) => {
  const body = await readBody(req, TakeawayBody);
  const result = await generate(
    TakeawayReplySchema,
    PROMPTS.takeaway.system,
    PROMPTS.takeaway.user({ idea: body.idea, mapLines: body.mapLines, links: body.links }),
    () => fallback.takeaway(body.nodes, body.links),
  );
  if (body.nodes.some((n) => n.id === result.data.leaf)) return result;
  return { data: fallback.takeaway(body.nodes, body.links), meta: { ...result.meta, source: 'fallback' as const, error: 'unknown leaf' } };
});
