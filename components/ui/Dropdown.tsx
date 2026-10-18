'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { Panel } from './Panel';

export interface DropdownProps {
  /** Key in `ui.openDropdown`. One store field means only one dropdown is open at a time. */
  id: string;
  /** Trigger content; a function receives whether the menu is open (for ▾ / ▴). */
  label: ReactNode | ((open: boolean) => ReactNode);
  /** Menu content; a function receives `close` for items that should dismiss the menu. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Which edge of the anchor the menu lines up with. */
  align?: 'left' | 'right';
  title?: string;
  /** Wrapper classes. The wrapper is not positioned, so the menu anchors to the nearest positioned ancestor. */
  className?: string;
  /** Trigger classes. The trigger gets `data-open="true"` while open, for `data-[open=true]:` styling. */
  triggerClassName?: string;
  /** Menu classes, typically a width. */
  menuClassName?: string;
  /** Gap in px between the anchor's bottom edge and the menu (toolbar menus 12, the brain list 4). */
  menuGap?: number;
  /** Which theme shadow the menu casts. */
  menuShadow?: 3 | 5;
  /** Disables the trigger and closes the menu while true. */
  disabled?: boolean;
}

/** A trigger button and its menu. Closes on outside pointer-down and on Esc. */
export function Dropdown({ id, label, children, align = 'right', title, className = 'flex', triggerClassName = '', menuClassName = '', menuGap = 12, menuShadow = 5, disabled = false }: DropdownProps) {
  const open = useStore(s => s.ui.openDropdown === id) && !disabled;
  const setOpenDropdown = useStore(s => s.setOpenDropdown);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (useStore.getState().ui.openDropdown === id) setOpenDropdown(null);
  }, [id, setOpenDropdown]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    // Capture phase, so the canvas's own pointer handling cannot swallow the event first.
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div ref={ref} className={className}>
      <button
        type="button"
        title={title}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        data-open={open ? 'true' : undefined}
        onClick={() => setOpenDropdown(open ? null : id)}
        className={`group cursor-pointer disabled:cursor-default disabled:opacity-60 ${triggerClassName}`}
      >
        {typeof label === 'function' ? label(open) : label}
      </button>
      {open && (
        <Panel
          shadow={menuShadow}
          style={{ top: `calc(100% + ${menuGap}px)` }}
          className={`absolute z-[6] flex flex-col ${align === 'left' ? 'left-0' : 'right-0'} ${menuClassName}`}
        >
          {typeof children === 'function' ? children(close) : children}
        </Panel>
      )}
    </div>
  );
}
