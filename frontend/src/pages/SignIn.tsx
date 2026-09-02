import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LanguageToggle } from '../layout/LanguageToggle';

export default function SignIn() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch {
      setError(t('sign_in_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6">
          <img src="/logo.png" alt="" className="mx-auto mb-4 h-[120px] w-[120px]" />
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-ink-primary">{t('app_name')}</h1>
            <LanguageToggle />
          </div>
        </div>

        <a
          href="/demo"
          className="mb-4 block rounded-lg bg-primary-50 px-4 py-3 text-center text-sm text-primary-700 hover:bg-primary-100"
        >
          {t('demo_tour_banner')}
        </a>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-ink-secondary">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-ink-secondary">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
              {t('forgot_password')}
            </Link>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-primary-600 font-medium text-ink-inverse hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? t('loading') : t('sign_in')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-secondary">
          {t('no_account_yet')}{' '}
          <Link to="/signup" className="text-primary-600 hover:underline">{t('create_account')}</Link>
        </p>
      </div>
    </div>
  );
}
