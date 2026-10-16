import type { ReactNode } from 'react';

export interface MenuItemProps {
  children: ReactNode;
  onClick: () => void;
  /** Marks the current choice with a filled dot and the page background. */
  active?: boolean;
  /** Optional leading element, e.g. a theme swatch. */
  lead?: ReactNode;
}

/** One row of a dropdown menu: mono uppercase label, trailing ● when active. */
export function MenuItem({ children, onClick, active = false, lead }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex cursor-pointer items-center gap-[10px] border-b border-rule2 px-[14px] py-[10px] text-left font-mono text-[11px] uppercase leading-[normal] tracking-[0.12em] text-ink ${active ? 'bg-bg' : 'bg-transparent'}`}
    >
      {lead}
      <span className="flex-1">{children}</span>
      <span>{active ? '●' : ''}</span>
    </button>
  );
}
