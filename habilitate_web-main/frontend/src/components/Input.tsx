import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-ink-primary">
        {label}
      </label>
      <input
        id={inputId}
        className={clsx(
          'block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
          error ? 'border-danger' : 'border-border',
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
