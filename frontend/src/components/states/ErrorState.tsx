import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export default function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(350,70%,94%)]">
        <span className="text-xl">&#x26A0;</span>
      </div>
      <h3 className="text-lg font-semibold text-ink-primary">{title ?? t('error_generic_title')}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-secondary">
        {description ?? t('error_generic_desc')}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-border px-5 py-2 text-sm font-medium text-ink-primary hover:bg-primary-50"
        >
          {t('retry_action')}
        </button>
      )}
    </div>
  );
}
