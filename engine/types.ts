export type Kind = 'Core' | 'Problem' | 'People' | 'Mechanism' | 'Value' | 'Risk' | 'Next step';
export type AgentId = 'researcher' | 'builder' | 'customer' | 'skeptic' | 'strategist';
export type Mode = 'constellation' | 'orbit' | 'terrain';
export type ThemeId = 'atlas' | 'observatory' | 'blueprint';

export interface IdeaNode { id: string; name: string; note: string; userNote: string; kind: Kind; parent: string | null; depth: number; color: string; by: AgentId | null; critic: boolean; position: number; }
export interface CrossLink { a: string; b: string; why: string; by: AgentId; }
export interface LogEntry { seq: number; agent: AgentId; text: string; node: string; tag: string; }
export interface Takeaway { path: string[]; verdict: string; brief: string; }
export interface Brain { id: string; number: number; title: string; summary: string; round: number; synth: Takeaway | null; nodes: IdeaNode[]; links: CrossLink[]; log: LogEntry[]; createdAt: string; updatedAt: string; }

export const KINDS = ['Problem', 'People', 'Mechanism', 'Value', 'Risk', 'Next step'] as const;
export const KIND_COLORS: Record<(typeof KINDS)[number], string> = { Problem: '#E0482B', People: '#2F5BD8', Mechanism: '#3E8E5A', Value: '#D49A1E', Risk: '#9B3FB5', 'Next step': '#1A8C8C' };

export interface MapReply { title: string; summary: string; branches: { name: string; kind: string; note: string; children: { name: string; note: string }[] }[] }

/** Choreography events the agent runner sends to `AtlasScene.agent()`; each returns a promise the runner awaits. */
export type AgentEvent =
  | { type: 'plan'; agent: AgentId; target: string }
  | { type: 'travel'; agent: AgentId; path: string[] }
  | { type: 'think'; agent: AgentId; target: string; verb: string }
  | { type: 'spawn'; agent: AgentId; target: string }
  | { type: 'link'; agent: AgentId; a: string; b: string }
  | { type: 'done'; agent: AgentId };
