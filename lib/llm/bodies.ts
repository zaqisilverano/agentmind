import { z } from 'zod';
import { CrossLinkSchema, IdeaNodeSchema } from '@/lib/brains/schemas';
import { FOCUS_MAX, cleanFocus } from '@/lib/llm/prompts';

const AgentId = z.enum(['researcher', 'builder', 'customer', 'skeptic', 'strategist']);
const Idea = z.object({ title: z.string().min(1).max(80), summary: z.string().max(400) });
// 300 nodes (MAX_NODES_PER_BRAIN) at ~80 characters a line fit with room to spare.
const MapLines = z.string().max(40000);
const Links = z.array(CrossLinkSchema).max(400);
const Nodes = z.array(IdeaNodeSchema).max(400);

export const MapBody = z.object({ idea: z.string().min(3).max(2000) });

export const ExpandBody = z.object({
  title: z.string().min(1).max(80),
  summary: z.string().max(400),
  path: z.array(z.string().min(1).max(60)).min(1).max(20),
  existing: z.array(z.string().max(60)).max(60),
  question: z.string().max(300).optional(),
});

export const AgentRoundBody = z.object({
  agent: AgentId,
  idea: Idea,
  mapLines: MapLines,
  links: Links,
  target: IdeaNodeSchema,
  nodes: Nodes,
  /** The user's note for a scoped run ("Expand with agents" with text in the input); cleaned to one line (see `cleanFocus`). */
  focus: z.string().max(FOCUS_MAX).optional().transform(cleanFocus),
});

export const TakeawayBody = z.object({ idea: Idea, mapLines: MapLines, links: Links, nodes: Nodes.min(1) });
