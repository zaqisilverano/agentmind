import { KINDS, KIND_COLORS, type IdeaNode, type Kind } from '@/engine/types';
import { childId } from '@/lib/ids';
import type { Agent } from '@/lib/agents/roster';

export function makeKids(target: IdeaNode, kids: { name: string; note: string }[], agent: Agent, ink: string, stamp?: string): IdeaNode[] {
  return kids
    .filter(c => c && c.name)
    .slice(0, 4)
    .map((c, k) => {
      const kind: Kind = agent.critic ? 'Risk' : target.depth === 0 ? KINDS[k % KINDS.length] : target.kind;
      return {
        id: childId(target.id, k, stamp),
        name: c.name,
        note: c.note || '',
        userNote: '',
        kind,
        parent: target.id,
        depth: target.depth + 1,
        color: kind === 'Core' ? ink : KIND_COLORS[kind],
        by: agent.id,
        critic: agent.critic,
        position: k,
      };
    });
}
