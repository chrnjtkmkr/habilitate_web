import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

const variants = {
  primary:
    'bg-primary-600 text-ink-inverse hover:bg-primary-700 focus-visible:ring-primary-500',
  secondary:
    'border border-border bg-surface text-ink-primary hover:bg-primary-50 focus-visible:ring-primary-500',
  ghost:
    'text-ink-secondary hover:bg-primary-50 focus-visible:ring-primary-500',
  danger:
    'bg-danger text-ink-inverse hover:bg-danger/90 focus-visible:ring-danger',
} as const;

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}
