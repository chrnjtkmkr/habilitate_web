import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { t } = useTranslation();
  void t; // available for subclasses

  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
      {icon && (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(150,50%,92%)]">
          <span className="text-xl">{icon}</span>
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink-primary">{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-secondary">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-ink-inverse hover:bg-primary-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
