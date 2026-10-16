import type { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** `mono` for notes (soft rule border), `serif` for editing a node description (ink border). */
  variant?: 'mono' | 'serif';
}

const VARIANTS = {
  mono: 'border-rule font-mono text-[12px] leading-[1.5] p-2',
  serif: 'border-ink font-serif text-[16px] px-2 py-1.5',
};

/** Full-width textarea on the page background, resizable vertically. */
export function Textarea({ variant = 'mono', rows = 3, className = '', ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      {...rest}
      className={`box-border block w-full resize-y border bg-bg text-ink placeholder:text-faint focus:border-ink focus:outline-none ${VARIANTS[variant]} ${className}`}
    />
  );
}
