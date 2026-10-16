import { z } from 'zod';
import { KINDS } from '@/engine/types';

const Child = z.object({ name: z.string().min(1).max(60), note: z.string().max(300).default('') });

export const MapReplySchema = z.object({
  title: z.string().min(1).max(80),
  summary: z.string().max(400).default(''),
  branches: z.array(z.object({
    name: z.string().min(1).max(60),
    kind: z.enum(KINDS),
    note: z.string().max(300).default(''),
    children: z.array(Child).min(2).max(4),
  })).min(5).max(6),
}).superRefine((m, ctx) => {
  const ks = m.branches.map(b => b.kind);
  if (new Set(ks).size !== ks.length) ctx.addIssue({ code: 'custom', message: 'each kind at most once' });
});

export const ExpandReplySchema = z.object({ children: z.array(Child).min(1).max(5) });

export const AgentRoundReplySchema = z.object({
  thought: z.string().min(1).max(300),
  children: z.array(Child).min(1).max(3),
  links: z.array(z.object({ a: z.string(), b: z.string(), why: z.string().max(120).default('') })).max(1).default([]),
});

export const TakeawayReplySchema = z.object({
  leaf: z.string().min(1),
  verdict: z.string().min(1).max(300),
  brief: z.string().min(1).max(900),
});

export type MapReplyOut = z.infer<typeof MapReplySchema>;
export type ExpandReplyOut = z.infer<typeof ExpandReplySchema>;
export type AgentRoundReplyOut = z.infer<typeof AgentRoundReplySchema>;
export type TakeawayReplyOut = z.infer<typeof TakeawayReplySchema>;
