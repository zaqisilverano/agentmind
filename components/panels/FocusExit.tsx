'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

/**
 * Shown only in focus mode: leaves it on click or on Esc (the key listener lives while this is mounted). `compact` is
 * the mobile version, a small accent × in the bottom-right corner above the safe area.
 */
export function FocusExit({ compact = false }: { compact?: boolean }) {
  const setFocus = useStore(s => s.setFocus);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocus(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setFocus]);

  if (compact) {
    return (
      <button
        type="button"
        title="Exit focus"
        aria-label="Exit focus"
        onClick={() => setFocus(false)}
        className="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-[6] flex h-11 w-11 cursor-pointer items-center justify-center border border-ink bg-accent font-mono text-[16px] leading-none text-on-accent shadow-[var(--shadow3)]"
      >
        ×
      </button>
    );
  }

  return (
    <Button onClick={() => setFocus(false)} className="fixed right-10 bottom-10 z-[6] flex items-center gap-[10px] shadow-[var(--shadow3)]">
      Exit focus <span className="text-muted">Esc</span>
    </Button>
  );
}
