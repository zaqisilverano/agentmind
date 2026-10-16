'use client';

import { useStore } from '@/lib/store';

/** "Legend — branches": one row per depth-1 node; clicking a row selects that branch. */
export function Legend() {
  const nodes = useStore(s => s.brain?.nodes);
  const selected = useStore(s => s.selected);
  const select = useStore(s => s.select);
  const branches = (nodes ?? []).filter(n => n.depth === 1);

  return (
    <section className="flex flex-none flex-col gap-0.5 border-t border-ink pt-[10px]">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted">Legend — branches</div>
      {branches.map(b => (
        <button
          key={b.id}
          type="button"
          aria-pressed={selected === b.id}
          onClick={() => select(b.id)}
          className={`flex cursor-pointer items-center gap-[10px] py-[5px] text-left font-mono text-[12px] leading-[normal] hover:text-accent ${selected === b.id ? 'text-accent' : 'text-ink'}`}
        >
          <span className="h-[13px] w-[13px] flex-none rounded-full border border-ink" style={{ background: b.color }} />
          <span className="min-w-0 flex-1">{b.name}</span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-muted">{b.kind}</span>
        </button>
      ))}
    </section>
  );
}
