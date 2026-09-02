import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function NoCenter() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <img src="/logo.png" alt="" className="mx-auto mb-4 h-[120px] w-[120px]" />
        <h1 className="text-xl font-semibold text-ink-primary">{t('no_center_title')}</h1>
        <p className="mt-2 text-sm text-ink-secondary">{t('no_center_body_updated')}</p>

        <div className="mt-6 space-y-3">
          <Link
            to="/create-center"
            className="block w-full rounded-lg bg-primary-600 px-6 py-2.5 font-medium text-ink-inverse hover:bg-primary-700"
          >
            {t('create_center_button')}
          </Link>

          <p className="text-xs text-ink-muted">{t('invited_therapist_hint')}</p>
        </div>

        <button
          onClick={signOut}
          className="mt-4 text-sm text-ink-secondary hover:text-ink-primary hover:underline"
        >
          {t('sign_out')}
        </button>
      </div>
    </div>
  );
}
