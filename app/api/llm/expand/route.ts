import { readBody } from '@/lib/api';
import { ExpandBody } from '@/lib/llm/bodies';
import { fallback } from '@/lib/llm/fallback';
import { generate } from '@/lib/llm/generate';
import { PROMPTS } from '@/lib/llm/prompts';
import { llmRoute } from '@/lib/llm/route';
import { ExpandReplySchema } from '@/lib/llm/schemas';

export const POST = llmRoute(async (req) => {
  const body = await readBody(req, ExpandBody);
  return generate(ExpandReplySchema, PROMPTS.expand.system, PROMPTS.expand.user(body), () => fallback.expand(body.path, body.question));
});
