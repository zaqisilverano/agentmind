import { readBody } from '@/lib/api';
import { AGENTS } from '@/lib/agents/roster';
import { AgentRoundBody } from '@/lib/llm/bodies';
import { fallback } from '@/lib/llm/fallback';
import { generate } from '@/lib/llm/generate';
import { PROMPTS } from '@/lib/llm/prompts';
import { llmRoute } from '@/lib/llmRoute';
import { AgentRoundReplySchema } from '@/lib/llm/schemas';

export const POST = llmRoute(async (req) => {
  const body = await readBody(req, AgentRoundBody);
  const agent = AGENTS.find((a) => a.id === body.agent)!;
  const { data, meta } = await generate(
    AgentRoundReplySchema,
    PROMPTS.agentRound.system(agent),
    PROMPTS.agentRound.user({ idea: body.idea, mapLines: body.mapLines, links: body.links, target: body.target, critic: agent.critic, focus: body.focus?.trim() || undefined }),
    () => fallback.agentRound(body.agent, body.target, body.nodes),
  );
  const ids = new Set(body.nodes.map((n) => n.id));
  return { data: { ...data, links: data.links.filter((l) => l.a !== l.b && ids.has(l.a) && ids.has(l.b)) }, meta };
});
