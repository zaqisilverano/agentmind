'use client';

import { useEffect, useRef, useState } from 'react';
import { getController } from '@/lib/controller';
import { FOCUS_INPUT_EVENT } from '@/lib/events';
import { runAction, startFromInput } from '@/lib/run';
import { useStore } from '@/lib/store';

const ACTION = 'cursor-pointer whitespace-nowrap border-l border-ink font-mono text-[12px] font-bold uppercase leading-[normal] tracking-[0.12em] disabled:cursor-default';

/** The one-line status above the bar: round progress, the last status text, or a summary of the brain. */
function useStatusText(): string {
  const run = useStore(s => s.run);
  const round = useStore(s => s.brain?.round ?? 0);
  const linkCount = useStore(s => s.brain?.links.length ?? 0);
  const prefix = run.active && run.total > 0 ? `Round ${Math.min(run.round + 1, run.total)}/${run.total} · ` : '';
  return prefix + (run.status || (round ? `${round} rounds · ${linkCount} links` : 'Agents standing by'));
}

/** The status text (role="status") and, after a failed save, the "Not saved · Retry" chip. Shared by both layouts. */
export function StatusLine({ className }: { className: string }) {
  const syncError = useStore(s => s.syncError);
  const status = useStatusText();
  return (
    <div className={className}>
      <span className="min-w-0 truncate" role="status">{status}</span>
      {syncError && (
        <button
          type="button"
          title={`${syncError.label} failed. Retry`}
          onClick={() => void syncError.retry()}
          className="flex-none cursor-pointer border border-ink bg-accent px-1.5 py-px font-mono text-[9.5px] uppercase leading-[normal] tracking-[0.12em] text-on-accent hover:bg-ink hover:text-panel"
        >
          Not saved · Retry
        </button>
      )}
    </div>
  );
}

/**
 * The idea input and the one ▶ Run agents / ❚❚ Pause action, shared by both layouts. Run (or Enter) maps typed text
 * into a new brain and runs the agents on it, runs the open brain when the input is empty, or, with a node selected,
 * starts a scoped run on that node with the text as its focus note (see `startFromInput`). While a run is active the
 * button pauses it. Focuses the input on FOCUS_INPUT_EVENT.
 */
export function useRunInput() {
  const selectedName = useStore(s => (s.selected ? s.brain?.nodes.find(n => n.id === s.selected)?.name ?? null : null));
  const busy = useStore(s => s.ui.busy);
  const active = useStore(s => s.run.active);
  const [text, setText] = useState('');
  const action = useStore(s => runAction(text, s));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    window.addEventListener(FOCUS_INPUT_EVENT, focus);
    return () => window.removeEventListener(FOCUS_INPUT_EVENT, focus);
  }, []);

  const run = async () => {
    if (await startFromInput(text)) setText('');
  };
  const toggle = () => {
    if (active) getController()?.pause();
    else void run();
  };

  const focusing = selectedName !== null;
  return {
    text, setText, inputRef, run, toggle, active, focusing,
    mapping: busy === 'map',
    disabled: !active && (busy !== null || action === null),
    placeholder: focusing ? `Steer the agents on “${selectedName}” (optional)…` : 'Type an idea — a startup, a story, a plan…',
    inputLabel: focusing ? 'Focus note' : 'New idea',
    maxLength: focusing ? 300 : 2000,
  };
}

export type RunInput = ReturnType<typeof useRunInput>;

/**
 * Bottom bar: "New brain" while nothing is selected, "Focus node" with a node selected, the serif input, and the one
 * ▶ Run agents / ❚❚ Pause button. A failed save shows "Not saved · Retry" next to the status.
 */
export function InputBar() {
  const r = useRunInput();

  return (
    <div data-testid="input-bar" className="fixed bottom-11 left-1/2 z-[2] flex w-[min(720px,calc(100%-88px))] -translate-x-1/2 flex-col gap-2">
      <StatusLine className="flex min-h-[14px] items-center justify-center gap-2 text-[10.5px] uppercase leading-[normal] tracking-[0.14em] text-muted" />
      <div className="flex items-stretch border border-ink bg-panel shadow-[var(--shadow5)]">
        <div className="flex items-center whitespace-nowrap border-r border-ink px-[14px] text-[10px] uppercase tracking-[0.16em]">{r.focusing ? 'Focus node' : 'New brain'}</div>
        <input
          ref={r.inputRef}
          value={r.text}
          maxLength={r.maxLength}
          disabled={r.mapping}
          aria-label={r.inputLabel}
          placeholder={r.placeholder}
          onChange={e => r.setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void r.run(); }}
          className="min-w-0 flex-1 border-none bg-transparent px-4 py-[14px] font-serif text-[24px] text-ink outline-none placeholder:text-muted placeholder:italic disabled:opacity-60"
        />
        <button
          type="button"
          title={r.active ? 'Pause the agents' : 'Run agents'}
          disabled={r.disabled}
          onClick={r.toggle}
          className={`${ACTION} bg-accent px-[22px] text-on-accent hover:bg-ink hover:text-panel disabled:opacity-60`}
        >
          {r.active ? '❚❚ Pause' : r.mapping ? 'Mapping…' : '▶ Run agents'}
        </button>
      </div>
    </div>
  );
}
