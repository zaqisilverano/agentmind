'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient, ApiError } from '@/lib/apiClient';
import { resetSession, switchUser } from '@/lib/sync';
import { useStore } from '@/lib/store';

/** Display-only mirror of the anonymous id (spec §5). The server never reads it. */
export const UID_DISPLAY_KEY = 'ab_uid_display';
const COPIED_MS = 1500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOAD_FAILED = 'Restored, but your brains could not be loaded.';

const SMALL = 'cursor-pointer border border-ink px-[7px] py-1 font-mono text-[9.5px] uppercase leading-[normal] tracking-[0.12em] disabled:cursor-default disabled:opacity-40';

function mirror(id: string): void {
  try {
    window.localStorage.setItem(UID_DISPLAY_KEY, id);
  } catch {
    // storage blocked: the mirror is a convenience only
  }
}

const message = (e: unknown): string => (e instanceof ApiError ? e.message : 'Network error, try again');

/**
 * "Your ID" with Copy, and a Restore ID form. Restoring is two steps: the server re-issues the cookie, then `me`
 * reloads the brains. If only the first succeeds, the old user's state is dropped at once and Retry re-runs `me`.
 */
export function IdentityLine() {
  const userId = useStore(s => s.user?.id ?? null);
  const [copied, setCopied] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
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

  /** Step 2: load the (new) user's brains and open the first. Retry calls only this. */
  const load = async () => {
    setPending(true);
    setError(null);
    try {
      const me = await apiClient.me();
      setLoadFailed(false);
      setRestoring(false);
      await switchUser(me);
    } catch {
      setLoadFailed(true);
      setError(LOAD_FAILED);
    } finally {
      setPending(false);
    }
  };

  const restore = async (e: FormEvent) => {
    e.preventDefault();
    const id = value.trim();
    if (!id || pending) return;
    if (!UUID.test(id)) {
      setError('That does not look like an ID');
      return;
    }
    setPending(true);
    setError(null);
    setLoadFailed(false);
    try {
      await apiClient.restore(id);
    } catch (err) {
      setError(message(err));
      setPending(false);
      return;
    }
    // The cookie now belongs to `id`: nothing of the previous user may stay open or editable.
    resetSession();
    useStore.setState({ user: { id } });
    setValue('');
    await load();
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
          onClick={() => { setRestoring(!restoring); if (!loadFailed) setError(null); }}
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
      {error && (
        <div role="alert" className="flex items-center gap-2 text-[10px] leading-[1.4] text-accent">
          <span className="flex-1">{error}</span>
          {loadFailed && (
            <button type="button" disabled={pending} onClick={() => void load()} className={`${SMALL} bg-panel text-ink hover:bg-ink hover:text-panel`}>
              {pending ? 'Loading…' : 'Retry'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
