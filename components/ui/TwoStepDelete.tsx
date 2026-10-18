'use client';

import { useEffect, useRef, useState } from 'react';

export interface TwoStepDeleteProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  title?: string;
  /** Borders and layout from the caller; the button supplies type, colour and padding. */
  className?: string;
  disabled?: boolean;
}

const RESET_MS = 3000;

/**
 * Delete button that asks once: the first click arms it ("Confirm?"), the second calls `onConfirm`.
 * It disarms itself after 3 s. Give it a `key` tied to the target so switching targets disarms it too.
 */
export function TwoStepDelete({ onConfirm, label = 'Delete', confirmLabel = 'Confirm?', title, className = '', disabled = false }: TwoStepDeleteProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const click = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (armed) {
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => { setArmed(false); timer.current = null; }, RESET_MS);
  };

  const tone = armed ? 'bg-accent text-on-accent' : 'bg-panel text-ink';
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={click}
      className={`cursor-pointer disabled:cursor-default disabled:opacity-50 px-4 py-[13px] font-mono text-[11px] uppercase leading-[normal] tracking-[0.14em] hover:bg-accent hover:text-on-accent ${tone} ${className}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
