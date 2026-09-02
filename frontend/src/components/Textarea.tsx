import clsx from 'clsx';
import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export default function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const textareaId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={className}>
      <label htmlFor={textareaId} className="mb-1 block text-sm font-medium text-ink-primary">
        {label}
      </label>
      <textarea
        id={textareaId}
        className={clsx(
          'block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
          error ? 'border-danger' : 'border-border',
        )}
        rows={3}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
