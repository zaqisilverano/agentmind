'use client';

import { AGENTS } from '@/lib/agents/roster';
import { useStore } from '@/lib/store';
import { AgentIcon } from '@/components/ui/AgentIcon';
import { Panel } from '@/components/ui/Panel';

const MAX_SHOWN = 50;

/** Right-hand panel while nothing is selected: the agents' thoughts, newest first; clicking one selects its node. */
export function AgentLog() {
  const log = useStore(s => s.brain?.log);
  const open = useStore(s => s.ui.logOpen);
  const setLogOpen = useStore(s => s.setLogOpen);
  const select = useStore(s => s.select);
  const entries = (log ?? []).slice(-MAX_SHOWN).reverse();

  return (
    <Panel className="fixed top-[100px] right-11 z-[2] flex max-h-[min(560px,calc(100%-254px))] min-h-0 w-[302px] max-w-[calc(100%-88px)] flex-col">
      <div className="flex flex-none items-center gap-[10px] border-b border-ink px-[14px] py-[10px]">
        <span className="flex-1 text-[10.5px] uppercase tracking-[0.16em]">Agent log</span>
        <span className="text-[10px] text-muted">{log?.length ?? 0} entries</span>
        <button
          type="button"
          title={open ? 'Collapse' : 'Expand'}
          aria-label={open ? 'Collapse agent log' : 'Expand agent log'}
          aria-expanded={open}
          onClick={() => setLogOpen(!open)}
          className="cursor-pointer border-none bg-transparent px-0.5 font-mono text-[12px] leading-[normal] text-ink"
        >
          {open ? '▴' : '▾'}
        </button>
      </div>
      {open && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {entries.length === 0 && (
            <div className="p-4 font-serif text-[17px] leading-[1.35] text-pretty text-soft">
              Press Run agents. Five agents take turns: each round one picks a thin part of the map, adds ideas, and looks for links to other branches. The Strategist closes with a key takeaway.
            </div>
          )}
          {entries.map(e => {
            const agent = AGENTS.find(a => a.id === e.agent);
            return (
              <button
                key={`${e.seq}-${e.node}-${e.tag}`}
                type="button"
                onClick={() => select(e.node)}
                className="flex flex-none cursor-pointer gap-[10px] border-b border-rule2 px-[14px] py-[10px] text-left text-ink hover:bg-bg"
              >
                {agent && <AgentIcon agent={agent} />}
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <div className="flex gap-2 font-mono text-[9.5px] uppercase leading-[normal] tracking-[0.14em] text-muted">
                    <span className="flex-1">{agent?.name ?? e.agent}</span>
                    <span>{e.tag}</span>
                  </div>
                  <div className="font-serif text-[16px] leading-[1.25] text-pretty">{e.text}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
