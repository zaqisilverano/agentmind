import { z } from 'zod';
import { KINDS } from '@/engine/types';

const AGENTS = ['researcher', 'builder', 'customer', 'skeptic', 'strategist'] as const;
const Agent = z.enum(AGENTS);

export const IdeaNodeSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(1).max(60),
  note: z.string().max(300).default(''),
  userNote: z.string().max(2000).default(''),
  kind: z.enum(['Core', ...KINDS]),
  parent: z.string().min(1).max(64).nullable(),
  depth: z.number().int().min(0),
  color: z.string().min(1).max(32),
  by: Agent.nullable().default(null),
  critic: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
});

export const CrossLinkSchema = z.object({
  a: z.string().min(1).max(64),
  b: z.string().min(1).max(64),
  why: z.string().max(120).default(''),
  by: Agent,
});

export const LogEntrySchema = z.object({
  seq: z.number().int(),
  agent: Agent,
  text: z.string().max(300),
  node: z.string().max(64),
  tag: z.string().max(40),
});

export const TakeawaySchema = z.object({
  path: z.array(z.string()),
  verdict: z.string().max(300),
  brief: z.string().max(900),
});

export const CreateBrainBody = z
  .object({
    title: z.string().min(1).max(80),
    summary: z.string().max(400).default(''),
    nodes: z.array(IdeaNodeSchema).min(1),
    links: z.array(CrossLinkSchema).default([]),
  })
  .refine((b) => b.nodes.filter((n) => n.parent === null).length === 1 && b.nodes.some((n) => n.id === 'n0' && n.parent === null), {
    message: 'nodes must contain exactly one root, with id n0',
    path: ['nodes'],
  });

export const PatchBrainBody = z.object({
  title: z.string().min(1).max(80).optional(),
  summary: z.string().max(400).optional(),
  round: z.number().int().min(0).optional(),
  synth: TakeawaySchema.nullable().optional(),
});

export const AddNodesBody = z.object({ nodes: z.array(IdeaNodeSchema).min(1) });
export const PatchNodeBody = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60).optional(),
  note: z.string().max(300).optional(),
  userNote: z.string().max(2000).optional(),
});
export const DeleteNodeBody = z.object({ id: z.string().min(1).max(64) });
export const AddLinksBody = z.object({ links: z.array(CrossLinkSchema).min(1) });
export const RoundBody = z.object({
  round: z.number().int().min(1),
  nodes: z.array(IdeaNodeSchema),
  links: z.array(CrossLinkSchema).default([]),
  log: LogEntrySchema,
});
export const TakeawayBody = z.object({ synth: TakeawaySchema, log: LogEntrySchema });

export type CreateBrainInput = z.infer<typeof CreateBrainBody>;
export type PatchBrainInput = z.infer<typeof PatchBrainBody>;
export type PatchNodeInput = z.infer<typeof PatchNodeBody>;
export type RoundInput = z.infer<typeof RoundBody>;
export type TakeawayInput = z.infer<typeof TakeawayBody>;
export type NodeInput = z.infer<typeof IdeaNodeSchema>;
export type LinkInput = z.infer<typeof CrossLinkSchema>;
