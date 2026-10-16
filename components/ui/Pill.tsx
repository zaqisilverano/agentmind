import type { ReactNode } from 'react';

export interface PillProps {
  children: ReactNode;
  /** When set, the pill is a button. */
  onClick?: () => void;
  /** Accent fill, used for the active phase and similar states. */
  active?: boolean;
  title?: string;
  className?: string;
}

const BASE = 'inline-flex items-center gap-1.5 border border-ink px-2 py-[5px] font-mono text-[10.5px] uppercase leading-[normal] tracking-[0.06em]';

/** Small bordered chip: child chips on the node card, phase labels, tags. */
export function Pill({ children, onClick, active = false, title, className = '' }: PillProps) {
  const tone = active ? 'bg-accent text-[#1B1A17]' : 'bg-bg text-ink';
  if (!onClick) return <span title={title} className={`${BASE} ${tone} ${className}`}>{children}</span>;
  return (
    <button type="button" title={title} onClick={onClick} className={`${BASE} ${tone} cursor-pointer hover:bg-ink hover:text-panel ${className}`}>
      {children}
    </button>
  );
}
