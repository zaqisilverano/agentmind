'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient, ApiError } from '@/lib/apiClient';
import { selectBrain } from '@/lib/sync';
import { useStore } from '@/lib/store';

/** Display-only mirror of the anonymous id (spec §5). The server never reads it. */
export const UID_DISPLAY_KEY = 'ab_uid_display';
const COPIED_MS = 1500;

const SMALL = 'cursor-pointer border border-ink px-[7px] py-1 font-mono text-[9.5px] uppercase leading-[normal] tracking-[0.12em] disabled:cursor-default disabled:opacity-40';

function mirror(id: string): void {
  try {
    window.localStorage.setItem(UID_DISPLAY_KEY, id);
  } catch {
    // storage blocked: the mirror is a convenience only
  }
}

const message = (e: unknown): string => (e instanceof ApiError ? e.message : 'Network error, try again');

/** "Your ID" with Copy, and a Restore ID form that re-issues the cookie for a pasted uuid and reloads the brains. */
export function IdentityLine() {
  const userId = useStore(s => s.user?.id ?? null);
  const hydrate = useStore(s => s.hydrate);
  const [copied, setCopied] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (userId) mirror(userId); }, [userId]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!userId) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(userId);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setCopied(false); timer.current = null; }, COPIED_MS);
  };

  const restore = async (e: FormEvent) => {
    e.preventDefault();
    const id = value.trim();
    if (!id || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiClient.restore(id);
      const me = await apiClient.me();
      hydrate(me);
      setValue('');
      setRestoring(false);
      const first = me.brains[0];
      if (first) await selectBrain(first.id);
      else useStore.setState({ brain: null, selected: null });
    } catch (err) {
      setError(message(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mt-auto flex flex-none flex-col gap-2 border-t border-ink pt-[10px]">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Your ID</span>
        <span className="min-w-0 flex-1 truncate text-[11px] tracking-[0.06em]" title={userId}>{userId.slice(0, 8)}</span>
        <button type="button" title="Copy your full ID" onClick={copy} className={`${SMALL} bg-panel text-ink hover:bg-ink hover:text-panel`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          aria-expanded={restoring}
          onClick={() => { setRestoring(!restoring); setError(null); }}
          className={`${SMALL} ${restoring ? 'bg-ink text-panel' : 'bg-panel text-ink hover:bg-ink hover:text-panel'}`}
        >
          Restore ID
        </button>
      </div>
      {restoring && (
        <form onSubmit={restore} className="flex gap-1.5">
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Paste your full ID"
            aria-label="ID to restore"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 border border-ink bg-bg px-2 py-[5px] font-mono text-[11px] leading-[normal] text-ink placeholder:text-faint placeholder:italic focus:outline-none"
          />
          <button type="submit" disabled={!value.trim() || pending} className={`${SMALL} bg-ink text-panel hover:bg-accent hover:text-on-accent`}>
            {pending ? 'Restoring…' : 'Restore'}
          </button>
        </form>
      )}
      {error && <div role="alert" className="text-[10px] leading-[1.4] text-accent">{error}</div>}
    </section>
  );
}
