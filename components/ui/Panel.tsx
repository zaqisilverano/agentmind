import type { HTMLAttributes } from 'react';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Which theme shadow to cast: the large panel shadow (default) or the small one used by bars and tabs. */
  shadow?: 3 | 5;
}

/** Floating panel chrome: square corners, 1 px ink border, panel background, theme shadow. */
export function Panel({ shadow = 5, className = '', ...rest }: PanelProps) {
  const cast = shadow === 5 ? 'shadow-[var(--shadow5)]' : 'shadow-[var(--shadow3)]';
  return <div {...rest} className={`border border-ink bg-panel text-ink ${cast} ${className}`} />;
}
