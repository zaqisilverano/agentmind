'use client';

import { useStore, type Phase } from '@/lib/store';

const PHASES: [Phase, string][] = [['plan', 'Plan'], ['diverge', 'Diverge'], ['connect', 'Connect'], ['takeaway', 'Takeaway']];

/** Plan · Diverge · Connect · Takeaway, the current run phase in accent. `className` places and decorates the bar. */
export function PhaseBar({ className = 'mt-2 self-start' }: { className?: string }) {
  const phase = useStore(s => s.run.phase);
  return (
    <div className={`flex border border-ink bg-panel ${className}`} aria-label="Run phase">
      {PHASES.map(([id, label]) => (
        <div
          key={id}
          aria-current={phase === id ? 'step' : undefined}
          className={`flex items-center border-r border-ink px-2 py-1.5 text-[9.5px] uppercase tracking-[0.14em] ${phase === id ? 'bg-accent text-on-accent' : 'bg-transparent text-muted'}`}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
