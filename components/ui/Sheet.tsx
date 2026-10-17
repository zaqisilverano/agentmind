'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useStore, type SheetId } from '@/lib/store';

export interface SheetProps {
  /** Key in `ui.sheet`. One store field means only one sheet is open at a time. */
  id: SheetId;
  /** Mono header title; also the dialog's accessible name. */
  title: ReactNode;
  /** Optional element before the title, e.g. a node's colour dot. */
  lead?: ReactNode;
  /** Optional muted text between the title and ×, e.g. an entry count. */
  meta?: ReactNode;
  children: ReactNode;
  /**
   * By default the children sit in one scrolling body. `bare` places them straight into the sheet's flex column, for
   * content that brings its own scrolling area and footer (the node card).
   */
  bare?: boolean;
  'data-testid'?: string;
}

/**
 * Mobile bottom sheet: Panel chrome (square corners, 1 px ink border, hard shadow), a header row with the mono title
 * and ×, and a scrolling body up to 70 % of the viewport. It fills the positioned region it is rendered in (between the
 * top bar and the status line in MobileShell) and anchors to its bottom edge. A transparent backdrop over the same
 * region closes it on tap; so does Esc.
 */
export function Sheet({ id, title, lead, meta, children, bare = false, 'data-testid': testId }: SheetProps) {
  const open = useStore(s => s.ui.sheet === id);
  const setSheet = useStore(s => s.setSheet);
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && useStore.getState().ui.sheet === id) setSheet(null);
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKey);
  }, [open, id, setSheet]);

  if (!open) return null;

  return (
    <>
      <div data-testid="sheet-backdrop" aria-hidden="true" onClick={() => setSheet(null)} className="pointer-events-auto absolute inset-0" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        className="pointer-events-auto absolute right-3 bottom-2 left-3 flex max-h-[min(70dvh,calc(100%-16px))] min-h-0 flex-col border border-ink bg-panel text-ink shadow-[var(--shadow5)] outline-none"
      >
        <div className="flex flex-none items-center gap-[10px] border-b border-ink px-[14px] py-[14px]">
          {lead}
          <span id={titleId} className="min-w-0 flex-1 truncate font-mono text-[10.5px] uppercase leading-[normal] tracking-[0.16em]">{title}</span>
          {meta && <span className="flex-none font-mono text-[10px] leading-[normal] text-muted">{meta}</span>}
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={() => setSheet(null)}
            className="-my-2 -mr-1.5 flex-none cursor-pointer border-none bg-transparent px-1.5 py-1 font-mono text-[16px] leading-[normal] text-ink"
          >
            ×
          </button>
        </div>
        {bare ? children : <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>}
      </div>
    </>
  );
}
