'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

/** Shown only in focus mode: leaves it on click or on Esc (the key listener lives while this is mounted). */
export function FocusExit() {
  const setFocus = useStore(s => s.setFocus);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocus(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setFocus]);

  return (
    <Button onClick={() => setFocus(false)} className="fixed right-10 bottom-10 z-[6] flex items-center gap-[10px] shadow-[var(--shadow3)]">
      Exit focus <span className="text-muted">Esc</span>
    </Button>
  );
}
