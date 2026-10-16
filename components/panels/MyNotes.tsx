'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { saveUserNote } from '@/lib/sync';
import { Textarea } from '@/components/ui/Textarea';

export interface MyNotesProps {
  nodeId: string;
  /** The brain the node belongs to; a pending note is never written into another brain. */
  brainId: string;
  /** The stored note; adopted while the user is not typing. */
  value: string;
}

const SAVED_MS = 1500;

/**
 * "My notes" textarea for one node. Keep it keyed by node id: it saves on blur and on unmount (another node selected,
 * selection cleared, focus mode), shows "editing…" while dirty and "saved" for 1.5 s after a save.
 */
export function MyNotes({ nodeId, brainId, value }: MyNotesProps) {
  const [text, setText] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (pending.current === null) setText(value); }, [value]);

  const flush = (): boolean => {
    const note = pending.current;
    pending.current = null;
    if (note === null || useStore.getState().brain?.id !== brainId) return false;
    void saveUserNote(nodeId, note);
    return true;
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    flush();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- unmount only; flush reads refs

  const onBlur = () => {
    if (!flush()) return setDirty(false);
    setDirty(false);
    setSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), SAVED_MS);
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-dashed border-rule pt-[10px]">
      <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-muted">
        <span>My notes</span>
        <span aria-live="polite">{dirty ? 'editing…' : saved ? 'saved' : ''}</span>
      </div>
      <Textarea
        value={text}
        maxLength={2000}
        placeholder="Add your own thoughts on this node…"
        onChange={e => {
          setText(e.target.value);
          pending.current = e.target.value;
          setDirty(true);
          setSaved(false);
        }}
        onBlur={onBlur}
      />
    </div>
  );
}
