'use client';

import type { ReactNode } from 'react';
import type { Mode, ThemeId } from '@/engine/types';
import { THEMES } from '@/engine/themes';
import { providerText } from '@/lib/grow';
import { selectIsEmpty, useStore } from '@/lib/store';
import { Sheet } from '@/components/ui/Sheet';
import { AgentLogEntries } from './AgentLog';
import { AgentRows } from './AgentTeam';
import { BrainMenu } from './BrainDropdown';
import { IdentityLine } from './IdentityLine';
import { EMPTY_SUMMARY, EMPTY_TITLE } from './LeftPanel';
import { Legend } from './Legend';
import { NodeCardBody, NodeDot, nodeKindLabel } from './NodeCardBody';
import { PhaseBar } from './PhaseBar';
import { ROUNDS, useDownloads } from './SettingsMenu';
import { ShowPathToggle, TakeawayDetails, TakeawayMark } from './TakeawayCard';

const HEADING = 'text-[10px] uppercase tracking-[0.18em] text-muted';
const SEGMENT = 'flex min-w-0 flex-1 cursor-pointer items-center justify-center border-r border-ink px-1 py-[13px] font-mono text-[10.5px] uppercase leading-[normal] last:border-r-0';
const SEG_TEXT = 'tracking-[0.1em]';
// Tighter, so "Observatory" fits its third of the sheet at 390 px.
const SEG_THEME = 'gap-1.5 tracking-[0.05em]';
const SEG_ON = 'bg-ink text-panel';
const SEG_OFF = 'bg-panel text-ink';
const DL = 'min-w-0 flex-1 cursor-pointer border border-ink bg-panel px-1 py-[13px] font-mono text-[10.5px] uppercase leading-[normal] tracking-[0.1em] text-ink active:bg-ink active:text-panel disabled:cursor-default disabled:opacity-40';

/** On mobile the constellation layout is called Stars, as in the mockup; the store value stays `constellation`. */
const MODES: [Mode, string][] = [['constellation', 'Stars'], ['orbit', 'Orbit'], ['terrain', 'Terrain']];
const THEME_IDS = Object.keys(THEMES) as ThemeId[];

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <div className={HEADING}>{label}</div>
    {children}
  </div>
);

/** Saved brains, "+ New second brain" and "Delete this brain", from the top bar's brain button. */
export function BrainSheet() {
  const setSheet = useStore(s => s.setSheet);
  return (
    <Sheet id="brain" title="Second brain" data-testid="brain-sheet">
      <div className="flex flex-col">
        <BrainMenu close={() => setSheet(null)} />
      </div>
    </Sheet>
  );
}

/** MAP: title, summary and the branch legend; tapping a branch selects it, which swaps in the node sheet. */
export function MapSheet() {
  const empty = useStore(selectIsEmpty);
  const title = useStore(s => s.brain?.title ?? (empty ? EMPTY_TITLE : ''));
  const summary = useStore(s => s.brain?.summary ?? (empty ? EMPTY_SUMMARY : ''));
  const hasNodes = useStore(s => (s.brain?.nodes.length ?? 0) > 0);
  return (
    <Sheet id="map" title="Map" data-testid="map-sheet">
      <div className="flex flex-col gap-2 px-[14px] pt-[18px] pb-1">
        <div className="font-serif text-[34px] leading-[0.95] tracking-[-0.01em]">{title}</div>
        <div className="font-serif text-[17px] leading-[1.3] text-pretty text-soft italic">{summary}</div>
        {hasNodes && <div className="mt-3"><Legend variant="sheet" /></div>}
      </div>
    </Sheet>
  );
}

/** AGENTS: the team rows and the phase bar. */
export function AgentsSheet() {
  return (
    <Sheet id="agents" title="Agent team" data-testid="agents-sheet">
      <div className="flex flex-col gap-0.5 px-[14px] pt-2 pb-[14px]">
        <AgentRows />
        <PhaseBar />
      </div>
    </Sheet>
  );
}

/** LOG: the agent log, newest first; tapping an entry selects its node. */
export function LogSheet() {
  const count = useStore(s => s.brain?.log.length ?? 0);
  return (
    <Sheet id="log" title="Agent log" meta={`${count} entries`} data-testid="log-sheet">
      <div className="flex flex-col">
        <AgentLogEntries />
      </div>
    </Sheet>
  );
}

/** KEY: the key takeaway with Show/Hide path, or a hint to run the agents. */
export function KeySheet() {
  const synth = useStore(s => s.brain?.synth ?? null);
  return (
    <Sheet id="key" title="Key takeaway" lead={<TakeawayMark />} meta={synth ? <ShowPathToggle /> : undefined} data-testid="key-sheet">
      <div className="flex flex-col gap-2 px-[14px] pt-[14px] pb-4">
        {synth
          ? <TakeawayDetails synth={synth} />
          : <div className="font-serif text-[17px] leading-[1.35] text-pretty text-soft">Run the agents to get a key takeaway.</div>}
      </div>
    </Sheet>
  );
}

/** VIEW & SETTINGS: layout, theme, rounds per run, downloads, the identity line and the provider. */
export function SettingsSheet() {
  const mode = useStore(s => s.mode);
  const theme = useStore(s => s.theme);
  const rounds = useStore(s => s.settings.rounds);
  const provider = useStore(s => s.provider);
  const setMode = useStore(s => s.setMode);
  const setTheme = useStore(s => s.setTheme);
  const setRounds = useStore(s => s.setRounds);
  const { hasBrain, saveMarkdown, saveJson, saveHtml3d } = useDownloads();

  return (
    <Sheet id="settings" title="View & settings" data-testid="settings-sheet">
      <div className="flex flex-col gap-[18px] px-[14px] pt-4 pb-[14px]">
        <Field label="View">
          <div className="flex border border-ink" role="group" aria-label="View">
            {MODES.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={`${SEGMENT} ${SEG_TEXT} ${mode === id ? SEG_ON : SEG_OFF}`}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Design">
          <div className="flex border border-ink" role="group" aria-label="Design">
            {THEME_IDS.map(id => (
              <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)} className={`${SEGMENT} ${SEG_THEME} ${theme === id ? SEG_ON : SEG_OFF}`}>
                <span aria-hidden="true" className="h-3 w-3 flex-none border border-ink" style={{ background: THEMES[id].bg }} />
                <span className="min-w-0 truncate">{THEMES[id].label}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Rounds per run">
          <div className="flex border border-ink" role="group" aria-label="Rounds per run">
            {ROUNDS.map(n => (
              <button key={n} type="button" aria-pressed={rounds === n} onClick={() => setRounds(n)} className={`${SEGMENT} ${SEG_TEXT} ${rounds === n ? SEG_ON : SEG_OFF}`}>
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Download brain">
          <div className="flex gap-1.5">
            <button type="button" className={DL} disabled={!hasBrain} onClick={saveMarkdown}>Markdown</button>
            <button type="button" className={DL} disabled={!hasBrain} onClick={saveJson}>JSON</button>
            <button type="button" className={DL} disabled={!hasBrain} onClick={saveHtml3d}>3D HTML</button>
          </div>
        </Field>
        <IdentityLine />
        <div className="flex items-baseline gap-3">
          <div className={HEADING}>Provider</div>
          <div className="min-w-0 flex-1 truncate text-right text-[11px]" title={providerText(provider)}>{providerText(provider)}</div>
        </div>
      </div>
    </Sheet>
  );
}

/** NODE: the selected node's card. Opened by MobileShell whenever a node is selected; closing it deselects. */
export function NodeSheet() {
  const selected = useStore(s => s.selected);
  const node = useStore(s => (s.selected ? s.brain?.nodes.find(n => n.id === s.selected) : undefined));
  if (!selected || !node) return null;
  return (
    <Sheet id="node" title={nodeKindLabel(node)} lead={<NodeDot color={node.color} />} bare data-testid="node-sheet">
      <NodeCardBody key={selected} id={selected} />
    </Sheet>
  );
}
