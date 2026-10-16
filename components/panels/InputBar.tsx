'use client';

import { useEffect, useRef, useState } from 'react';
import { getController } from '@/lib/controller';
import { FOCUS_INPUT_EVENT } from '@/lib/events';
import { expandNode, mapIdea } from '@/lib/grow';
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

/**
 * Bottom bar: "New brain" maps a typed idea into a new brain; with a node selected it becomes "Ask node" and grows
 * that node from the question. ▶ Run agents / ❚❚ Pause drives the controller's runner. A failed save shows
 * "Not saved · Retry" next to the status.
 */
export function InputBar() {
  const selectedName = useStore(s => (s.selected ? s.brain?.nodes.find(n => n.id === s.selected)?.name ?? null : null));
  const selected = useStore(s => s.selected);
  const hasBrain = useStore(s => s.brain !== null);
  const active = useStore(s => s.run.active);
  const busy = useStore(s => s.ui.busy);
  const running = useStore(s => s.run.active || s.run.phase !== null);
  const syncError = useStore(s => s.syncError);
  const status = useStatusText();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    window.addEventListener(FOCUS_INPUT_EVENT, focus);
    return () => window.removeEventListener(FOCUS_INPUT_EVENT, focus);
  }, []);

  const submit = async () => {
    const idea = text.trim();
    if (!idea || busy) return;
    if (selected) {
      if (running) return;
      if (await expandNode(selected, idea)) setText('');
      return;
    }
    if (await mapIdea(idea)) setText('');
  };

  const toggleRun = () => {
    const c = getController();
    if (active) c?.pause();
    else c?.startRun();
  };

  const asking = selectedName !== null;

  return (
    <div data-testid="input-bar" className="fixed bottom-11 left-1/2 z-[2] flex w-[min(720px,calc(100%-88px))] -translate-x-1/2 flex-col gap-2">
      <div className="flex min-h-[14px] items-center justify-center gap-2 text-[10.5px] uppercase leading-[normal] tracking-[0.14em] text-muted">
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
      <div className="flex items-stretch border border-ink bg-panel shadow-[var(--shadow5)]">
        <div className="flex items-center whitespace-nowrap border-r border-ink px-[14px] text-[10px] uppercase tracking-[0.16em]">{asking ? 'Ask node' : 'New brain'}</div>
        <input
          ref={inputRef}
          value={text}
          maxLength={asking ? 300 : 2000}
          disabled={busy === 'map'}
          aria-label={asking ? 'Ask this node' : 'New idea'}
          placeholder={asking ? `Ask a follow-up about “${selectedName}” to grow it…` : 'Type an idea — a startup, a story, a plan…'}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
          className="min-w-0 flex-1 border-none bg-transparent px-4 py-[14px] font-serif text-[24px] text-ink outline-none placeholder:text-muted placeholder:italic disabled:opacity-60"
        />
        <button
          type="button"
          disabled={busy !== null || (asking && running)}
          title={asking && running ? 'Agents are running' : undefined}
          onClick={() => void submit()}
          className={`${ACTION} bg-accent px-[22px] text-on-accent hover:bg-ink hover:text-panel disabled:opacity-60`}
        >
          {busy === 'map' ? 'Mapping…' : busy === 'expand' ? 'Growing…' : asking ? 'Grow →' : 'Map it →'}
        </button>
        <button
          type="button"
          title="Run agents"
          disabled={!hasBrain && !active}
          onClick={toggleRun}
          className={`${ACTION} bg-ink px-[18px] text-panel hover:bg-accent hover:text-on-accent disabled:opacity-40`}
        >
          {active ? '❚❚ Pause' : '▶ Run agents'}
        </button>
      </div>
    </div>
  );
}
