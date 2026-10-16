'use client';

import { useEffect } from 'react';
import { KIND_COLORS } from '@/engine/types';
import { useStore } from '@/lib/store';
import { Panel } from '@/components/ui/Panel';

/**
 * The last verdict this card has reacted to. Module-level, so hiding and re-showing the panel (which remounts
 * the card) does not reopen a takeaway the user collapsed; only a new verdict does.
 */
let seenVerdict: string | null = null;

/** Key takeaway: verdict, brief and the strongest path, with Show/Hide path and a ▴/▾ collapse. */
export function TakeawayCard() {
  const synth = useStore(s => s.brain?.synth ?? null);
  const nodes = useStore(s => s.brain?.nodes);
  const open = useStore(s => s.ui.takeawayOpen);
  const showPath = useStore(s => s.ui.showPath);
  const setTakeawayOpen = useStore(s => s.setTakeawayOpen);
  const setShowPath = useStore(s => s.setShowPath);
  const verdict = synth?.verdict ?? null;

  useEffect(() => {
    if (verdict === null || verdict === seenVerdict) return;
    seenVerdict = verdict;
    setTakeawayOpen(true);
  }, [verdict, setTakeawayOpen]);

  if (!synth) return null;
  const path = synth.path.map(id => nodes?.find(n => n.id === id)?.name).filter(Boolean).join(' → ');

  return (
    <Panel shadow={3} className="flex flex-none flex-col gap-2 px-[14px] py-3">
      <div className="flex items-center gap-2">
        <span className="h-[11px] w-[11px] flex-none rotate-45 border border-ink" style={{ background: KIND_COLORS['Next step'] }} />
        <span className="flex-1 text-[10px] uppercase tracking-[0.18em] text-muted">Key takeaway</span>
        <button
          type="button"
          aria-pressed={showPath}
          onClick={() => setShowPath(!showPath)}
          className="cursor-pointer border border-ink bg-bg px-[7px] py-1 font-mono text-[9.5px] uppercase leading-[normal] tracking-[0.12em] text-ink"
        >
          {showPath ? 'Hide path' : 'Show path'}
        </button>
        <button
          type="button"
          title={open ? 'Collapse' : 'Expand'}
          aria-expanded={open}
          onClick={() => setTakeawayOpen(!open)}
          className="cursor-pointer border-none bg-transparent px-0.5 font-mono text-[12px] leading-[normal] text-ink"
        >
          {open ? '▴' : '▾'}
        </button>
      </div>
      {open && (
        <>
          <div className="font-serif text-[21px] leading-[1.1] text-pretty">{synth.verdict}</div>
          <div className="font-serif text-[15.5px] leading-[1.35] text-pretty text-soft">{synth.brief}</div>
          {path && <div className="text-[10px] leading-[1.5] tracking-[0.04em] text-accent">{path}</div>}
        </>
      )}
    </Panel>
  );
}
