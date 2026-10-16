import { readBody } from '@/lib/api';
import { MapBody } from '@/lib/llm/bodies';
import { fallback } from '@/lib/llm/fallback';
import { generate } from '@/lib/llm/generate';
import { PROMPTS } from '@/lib/llm/prompts';
import { llmRoute } from '@/lib/llm/route';
import { MapReplySchema } from '@/lib/llm/schemas';

export const POST = llmRoute(async (req) => {
  const { idea } = await readBody(req, MapBody);
  return generate(MapReplySchema, PROMPTS.map.system, PROMPTS.map.user(idea), () => fallback.map(idea));
});
