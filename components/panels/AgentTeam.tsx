'use client';

import { AGENTS, type Agent } from '@/lib/agents/roster';
import { useStore, type Phase, type RunState } from '@/lib/store';
import { AgentIcon } from '@/components/ui/AgentIcon';

const PHASES: [Phase, string][] = [['plan', 'Plan'], ['diverge', 'Diverge'], ['connect', 'Connect'], ['takeaway', 'Takeaway']];

/** Fallback verbs (AGENTS-SPEC §7 name tags) when the status line does not name the agent. */
const VERBS: Record<Phase, string> = { plan: 'eyeing', diverge: 'sprouting ideas on', connect: 'linking from', takeaway: 'pondering' };

/** "eyeing Pickup lockers" for the agent whose turn it is (from the runner's "<Name> is …" status), else null. */
function activity(agent: Agent, run: RunState): string | null {
  if (run.agent !== agent.id || run.phase === null) return null;
  const prefix = `${agent.name} is `;
  return run.status.startsWith(prefix) ? run.status.slice(prefix.length) : VERBS[run.phase];
}

/** Agent team list (icon, name, status, nodes added) and the Plan · Diverge · Connect · Takeaway phase bar. */
export function AgentTeam() {
  const nodes = useStore(s => s.brain?.nodes);
  const run = useStore(s => s.run);

  const counts = new Map<string, number>();
  for (const n of nodes ?? []) if (n.by) counts.set(n.by, (counts.get(n.by) ?? 0) + 1);

  return (
    <section className="flex flex-none flex-col gap-0.5 border-t border-ink pt-[10px]">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted">Agent team</div>
      {AGENTS.map(a => {
        const doing = activity(a, run);
        return (
          <div key={a.id} className="flex items-center gap-[10px] py-[5px] text-[12px]">
            <AgentIcon agent={a} />
            <span className="w-[84px] flex-none">{a.name}</span>
            <span className={`min-w-0 flex-1 truncate text-[10px] uppercase tracking-[0.06em] ${doing ? 'text-accent' : 'text-muted'}`} title={doing ?? undefined}>
              {doing ?? 'idle'}
            </span>
            <span className="text-[10px] text-muted">+{counts.get(a.id) ?? 0}</span>
          </div>
        );
      })}
      <div className="mt-2 flex self-start border border-ink bg-panel" aria-label="Run phase">
        {PHASES.map(([id, label]) => (
          <div
            key={id}
            aria-current={run.phase === id ? 'step' : undefined}
            className={`flex items-center border-r border-ink px-2 py-1.5 text-[9.5px] uppercase tracking-[0.14em] ${run.phase === id ? 'bg-accent text-on-accent' : 'bg-transparent text-muted'}`}
          >
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}
