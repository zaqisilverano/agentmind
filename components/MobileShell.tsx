'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { selectIsEmpty, useStore, type SheetId } from '@/lib/store';
import { pad3, useMapping } from '@/components/panels/BrainDropdown';
import { StatusLine, useRunInput, type RunInput } from '@/components/panels/InputBar';
import { EMPTY_TITLE } from '@/components/panels/LeftPanel';
import { AgentsSheet, BrainSheet, KeySheet, LogSheet, MapSheet, NodeSheet, SettingsSheet } from '@/components/panels/MobileSheets';
import { PhaseBar } from '@/components/panels/PhaseBar';

const TABS: [SheetId, string, string][] = [['map', '◎', 'Map'], ['agents', '✦', 'Agents'], ['log', '≡', 'Log'], ['key', '★', 'Key']];
const SQUARE = 'flex w-12 flex-none cursor-pointer items-center justify-center border border-ink font-mono leading-none shadow-[var(--shadow3)]';

/** Top bar: brain button (opens the brain sheet), … (view and settings) and ⤢ (focus mode). */
function TopBar() {
  const empty = useStore(selectIsEmpty);
  const number = useStore(s => s.brain?.number ?? null);
  const title = useStore(s => s.brain?.title ?? (empty ? EMPTY_TITLE : ''));
  const sheet = useStore(s => s.ui.sheet);
  const setSheet = useStore(s => s.setSheet);
  const setFocus = useStore(s => s.setFocus);
  const mapping = useMapping();
  const toggle = (id: SheetId) => setSheet(sheet === id ? null : id);

  // No switching brains while an idea is being mapped into a new one.
  useEffect(() => {
    if (mapping && useStore.getState().ui.sheet === 'brain') setSheet(null);
  }, [mapping, setSheet]);

  return (
    <div className="pointer-events-auto flex gap-2">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={sheet === 'brain'}
        data-sheet-trigger="brain"
        disabled={mapping}
        onClick={() => toggle('brain')}
        className="flex min-w-0 flex-1 cursor-pointer disabled:cursor-default disabled:opacity-60 items-center gap-2 border border-ink bg-panel px-3 pt-[7px] pb-[6px] text-left text-ink shadow-[var(--shadow3)]"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="font-mono text-[9.5px] uppercase leading-[normal] tracking-[0.14em]">
            Second brain {number === null ? '—' : `№ ${pad3(number)}`}
          </span>
          <span className="min-h-[23px] truncate font-serif text-[23px] leading-none tracking-[-0.01em]">{title}</span>
        </span>
        <span aria-hidden="true" className="flex-none font-mono text-[10px]">{sheet === 'brain' ? '▴' : '▾'}</span>
      </button>
      <button
        type="button"
        title="View & settings"
        aria-label="View & settings"
        aria-haspopup="dialog"
        aria-expanded={sheet === 'settings'}
        data-sheet-trigger="settings"
        onClick={() => toggle('settings')}
        className={`${SQUARE} text-[15px] tracking-[0.05em] ${sheet === 'settings' ? 'bg-ink text-panel' : 'bg-panel text-ink'}`}
      >
        ⋯
      </button>
      <button
        type="button"
        title="Focus mode: hide all panels"
        aria-label="Focus mode"
        onClick={() => setFocus(true)}
        className={`${SQUARE} bg-accent text-[16px] text-on-accent`}
      >
        ⤢
      </button>
    </div>
  );
}

/** Serif idea input; Enter does what ▶ Run in the tab bar does (the bar has no button of its own). */
function MobileInputBar({ r, inputRef }: { r: RunInput; inputRef: RefObject<HTMLInputElement | null> }) {
  return (
    <div data-testid="mobile-input-bar" className="pointer-events-auto flex items-stretch border border-ink bg-panel shadow-[var(--shadow5)]">
      <input
        ref={inputRef}
        value={r.text}
        maxLength={r.maxLength}
        disabled={r.mapping}
        aria-label={r.inputLabel}
        placeholder={r.placeholder}
        enterKeyHint="go"
        onChange={e => r.setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void r.run(); }}
        className="min-w-0 flex-1 border-none bg-transparent px-[14px] py-3 font-serif text-[21px] text-ink outline-none placeholder:text-muted placeholder:italic disabled:opacity-60"
      />
    </div>
  );
}

/** Map · Agents · Log · Key tabs (each toggles its sheet) and the one action: ▶ Run / ❚❚ Pause (Mapping… while mapping). */
function TabBar({ r }: { r: RunInput }) {
  const sheet = useStore(s => s.ui.sheet);
  const setSheet = useStore(s => s.setSheet);
  return (
    <nav aria-label="Panels" className="pointer-events-auto flex border border-ink bg-panel shadow-[var(--shadow5)]">
      {TABS.map(([id, icon, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={sheet === id}
          data-sheet-trigger={id}
          onClick={() => setSheet(sheet === id ? null : id)}
          className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[5px] border-r border-ink py-[9px] font-mono uppercase leading-none ${sheet === id ? 'bg-ink text-panel' : 'bg-panel text-ink'}`}
        >
          <span aria-hidden="true" className="text-[14px]">{icon}</span>
          <span className="text-[9.5px] tracking-[0.14em]">{label}</span>
        </button>
      ))}
      <button
        type="button"
        title={r.active ? 'Pause the agents' : 'Run agents'}
        disabled={r.disabled}
        onClick={r.toggle}
        className="flex w-[27%] flex-none cursor-pointer items-center justify-center whitespace-nowrap bg-ink font-mono text-[11px] font-bold uppercase leading-[normal] tracking-[0.12em] text-panel disabled:cursor-default disabled:opacity-40"
      >
        {r.active ? '❚❚ Pause' : r.mapping ? 'Mapping…' : '▶ Run'}
      </button>
    </nav>
  );
}

/**
 * The phone layout (< 768 px): top bar and phase bar, a sheet region in the middle, then the status line, the input bar
 * and the tab bar. The column itself ignores pointer events so the canvas underneath stays draggable; only the bars,
 * an open sheet and its backdrop take them. Selecting a node opens the node sheet; leaving that sheet deselects it.
 */
export function MobileShell() {
  const selected = useStore(s => s.selected);
  const sheet = useStore(s => s.ui.sheet);
  const setSheet = useStore(s => s.setSheet);
  const select = useStore(s => s.select);
  // One input state for the input bar and the tab bar's Run button. The ref is taken out first: the React Compiler lint
  // treats every field of an object that holds a ref as a ref.
  const { inputRef, ...r } = useRunInput();

  useEffect(() => {
    if (selected) setSheet('node');
    else if (useStore.getState().ui.sheet === 'node') setSheet(null);
  }, [selected, setSheet]);

  // Only a move away from the node sheet deselects (×, backdrop, Esc or another tab), not mounting with another sheet.
  const prevSheet = useRef(sheet);
  useEffect(() => {
    const was = prevSheet.current;
    prevSheet.current = sheet;
    if (was === 'node' && sheet !== 'node' && useStore.getState().selected !== null) select(null);
  }, [sheet, select]);

  return (
    <div
      data-testid="mobile-shell"
      className="pointer-events-none fixed inset-0 z-[5] flex flex-col gap-2 px-3 pt-[calc(12px+env(safe-area-inset-top))] pb-[calc(12px+env(safe-area-inset-bottom))]"
    >
      <header data-testid="mobile-top" className="flex flex-none flex-col gap-2">
        <TopBar />
        <PhaseBar className="self-start shadow-[var(--shadow3)]" />
      </header>
      <div className="relative min-h-0 flex-1">
        <BrainSheet />
        <SettingsSheet />
        <MapSheet />
        <AgentsSheet />
        <LogSheet />
        <KeySheet />
        <NodeSheet />
      </div>
      <footer data-testid="mobile-bottom" className="flex flex-none flex-col gap-2">
        <StatusLine className="flex min-h-[14px] items-center justify-center gap-2 text-[10px] uppercase leading-[normal] tracking-[0.14em] text-muted [&>button]:pointer-events-auto" />
        <MobileInputBar r={r} inputRef={inputRef} />
        <TabBar r={r} />
      </footer>
    </div>
  );
}
