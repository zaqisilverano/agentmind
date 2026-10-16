import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'default' | 'accent' | 'ink' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Text on accent fills uses the `on-accent` token (dark in every theme), so it stays readable on amber and yellow.
const VARIANTS: Record<ButtonVariant, string> = {
  default: 'border-ink bg-panel text-ink hover:bg-ink hover:text-panel',
  accent: 'border-ink bg-accent text-on-accent hover:bg-ink hover:text-panel',
  ink: 'border-ink bg-ink text-panel hover:bg-accent hover:text-on-accent',
  ghost: 'border-transparent bg-transparent text-ink hover:text-accent',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-[7px] py-1 text-[9.5px] tracking-[0.12em]',
  md: 'px-[14px] py-[9px] text-[10.5px] tracking-[0.14em]',
};

/** Mono uppercase chrome button with a 1 px border. */
export function Button({ variant = 'default', size = 'md', type = 'button', className = '', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`cursor-pointer border font-mono uppercase leading-[normal] disabled:cursor-default disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
