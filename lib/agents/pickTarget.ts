import type { IdeaNode } from '@/engine/types';
import type { Agent } from '@/lib/agents/roster';

const ok = (n: IdeaNode) => n.depth >= 1 && n.depth <= 3;

export function pickTarget(agent: Agent, nodes: IdeaNode[], hits: Record<string, number>, rand: () => number = Math.random): IdeaNode {
  const kids = (id: string) => nodes.filter(n => n.parent === id).length;
  let pool = nodes.filter(n => ok(n) && agent.kinds.includes(n.kind));
  if (agent.critic && rand() < 0.5) pool = nodes.filter(n => ok(n) && n.kind !== 'Risk');
  if (!pool.length) pool = nodes.filter(ok);
  if (!pool.length) return nodes[0];
  return pool
    .map(n => ({ n, s: n.depth * 1.2 + kids(n.id) * 1.6 + (hits[n.id] || 0) * 2.5 + rand() * 1.5 }))
    .sort((a, b) => a.s - b.s)[0].n;
}
