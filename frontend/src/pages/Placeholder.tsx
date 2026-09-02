import { useTranslation } from 'react-i18next';

export default function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <h1 className="text-xl font-semibold text-ink-primary">{t(titleKey)}</h1>
      <p className="mt-2 text-ink-secondary">{t('loading')}</p>
    </div>
  );
}
