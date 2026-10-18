import type { IdeaNode } from '@/engine/types';
import type { Agent } from '@/lib/agents/roster';

const ok = (n: IdeaNode) => n.depth >= 1 && n.depth <= 3;

/** The ids of `rootId` and all its descendants (empty when `rootId` is not in `nodes`). */
export function subtreeIds(nodes: IdeaNode[], rootId: string): Set<string> {
  const out = new Set<string>();
  if (!nodes.some(n => n.id === rootId)) return out;
  out.add(rootId);
  // Parents can follow their children in the array, so repeat until nothing new joins.
  for (let grew = true; grew;) {
    grew = false;
    for (const n of nodes) {
      if (n.parent !== null && out.has(n.parent) && !out.has(n.id)) {
        out.add(n.id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * The node an agent works on this round: the thinnest, shallowest, least-visited node among the agent's own kinds
 * (the Skeptic half the time any non-Risk node), else any node at depth 1–3, else the core.
 *
 * With `scope` (a node and its descendants, see `subtreeIds`) the pool is the scoped nodes only, at any depth; the
 * core counts only when it is in the scope (i.e. the scope node is the core). Within the scope the agent's own kinds
 * are preferred when any match, otherwise any scoped node. A scoped pick never leaves the scope; it is undefined when
 * no scoped node exists.
 */
export function pickTarget(agent: Agent, nodes: IdeaNode[], hits: Record<string, number>, rand: () => number = Math.random, scope?: Set<string>): IdeaNode | undefined {
  const kids = (id: string) => nodes.filter(n => n.parent === id).length;
  const eligible = scope ? (n: IdeaNode) => scope.has(n.id) : ok;
  let pool = nodes.filter(n => eligible(n) && agent.kinds.includes(n.kind));
  if (agent.critic && rand() < 0.5) pool = nodes.filter(n => eligible(n) && n.kind !== 'Risk');
  if (!pool.length) pool = nodes.filter(eligible);
  if (!pool.length) return scope ? undefined : nodes[0];
  return pool
    .map(n => ({ n, s: n.depth * 1.2 + kids(n.id) * 1.6 + (hits[n.id] || 0) * 2.5 + rand() * 1.5 }))
    .sort((a, b) => a.s - b.s)[0].n;
}
