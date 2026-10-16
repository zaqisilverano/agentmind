'use client';

import { useStore } from '@/lib/store';
import { AgentTeam } from './AgentTeam';
import { BrainDropdown } from './BrainDropdown';
import { IdentityLine } from './IdentityLine';
import { Legend } from './Legend';
import { TakeawayCard } from './TakeawayCard';

/**
 * Top-left column on the page background: brain dropdown, title and summary, key takeaway, agent team,
 * branch legend and the identity line. Geometry copies the prototype (content 300 px wide at 44/40 with
 * 14/16 px padding pulled out by negative margins), so the box is 333 px at 28/26 and ends 136 px above
 * the bottom. When hidden, a "» {title}" tab brings it back.
 */
export function LeftPanel() {
  const hidden = useStore(s => s.ui.leftHidden);
  const title = useStore(s => s.brain?.title ?? '');
  const summary = useStore(s => s.brain?.summary ?? '');
  const toggleLeft = useStore(s => s.toggleLeft);

  if (hidden) {
    return (
      <button
        type="button"
        title="Show panel"
        onClick={toggleLeft}
        className="fixed top-10 left-10 z-[2] flex max-w-[333px] cursor-pointer items-center gap-2 border border-ink bg-panel px-3 py-[9px] font-mono text-[10.5px] uppercase leading-[normal] tracking-[0.14em] text-ink shadow-[var(--shadow3)] hover:bg-ink hover:text-panel"
      >
        <span className="truncate">» {title}</span>
      </button>
    );
  }

  return (
    <aside className="fixed top-[26px] bottom-[136px] left-7 z-[2] flex w-[333px] max-w-[calc(100%-55px)] flex-col gap-[22px] overflow-y-auto border-r border-b border-r-rule2 border-b-rule bg-bg px-4 pt-[14px] pb-4">
      <div className="flex flex-none flex-col gap-1.5">
        <BrainDropdown />
        <div className="font-serif text-[46px] leading-[0.95] tracking-[-0.01em]">{title}</div>
        <div className="font-serif text-[18px] leading-[1.3] text-pretty text-soft italic">{summary}</div>
      </div>
      <TakeawayCard />
      <AgentTeam />
      <Legend />
      <IdentityLine />
    </aside>
  );
}
