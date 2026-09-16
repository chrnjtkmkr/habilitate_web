import clsx from 'clsx';

const variantStyles = {
  default: 'bg-primary-50 text-primary-700',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  neutral: 'bg-background text-ink-secondary',
} as const;

interface PillProps {
  children: React.ReactNode;
  variant?: keyof typeof variantStyles;
  className?: string;
}

export default function Pill({ children, variant = 'default', className }: PillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
