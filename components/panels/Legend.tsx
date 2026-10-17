'use client';

import { useStore } from '@/lib/store';

const DESKTOP = {
  section: 'flex flex-none flex-col gap-0.5 border-t border-ink pt-[10px]',
  heading: 'Legend — branches',
  row: 'py-[5px] text-[12px]',
};

export interface LegendProps {
  /** `sheet` is the mobile MAP sheet's version: "Branches", ruled rows with more room to tap. */
  variant?: 'panel' | 'sheet';
}

/** "Legend — branches": one row per depth-1 node; clicking a row selects that branch. */
export function Legend({ variant = 'panel' }: LegendProps) {
  const nodes = useStore(s => s.brain?.nodes);
  const selected = useStore(s => s.selected);
  const select = useStore(s => s.select);
  const branches = (nodes ?? []).filter(n => n.depth === 1);
  const look = variant === 'panel'
    ? DESKTOP
    : { section: 'flex flex-col border-t border-ink pt-[14px]', heading: 'Branches', row: 'border-b border-rule2 py-[13px] text-[12.5px] last:border-b-0' };

  return (
    <section className={look.section}>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted">{look.heading}</div>
      {branches.map(b => (
        <button
          key={b.id}
          type="button"
          aria-pressed={selected === b.id}
          onClick={() => select(b.id)}
          className={`flex cursor-pointer items-center gap-[10px] text-left font-mono leading-[normal] hover:text-accent ${look.row} ${selected === b.id ? 'text-accent' : 'text-ink'}`}
        >
          <span className="h-[13px] w-[13px] flex-none rounded-full border border-ink" style={{ background: b.color }} />
          <span className="min-w-0 flex-1">{b.name}</span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-muted">{b.kind}</span>
        </button>
      ))}
    </section>
  );
}
