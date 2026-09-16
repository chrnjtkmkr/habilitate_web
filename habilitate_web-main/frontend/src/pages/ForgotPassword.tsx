import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LanguageToggle } from '../layout/LanguageToggle';

export default function ForgotPassword() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (resetErr) {
        setError(resetErr.message);
        return;
      }
      setSent(true);
    } catch {
      setError(t('error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <span className="text-[40px]">&#x2709;</span>
          <h2 className="mt-3 text-xl font-semibold text-ink-primary">{t('reset_email_sent_title')}</h2>
          <p className="mt-2 text-sm text-ink-secondary">{t('reset_email_sent_body', { email })}</p>
          <Link to="/signin" className="mt-6 inline-block text-sm text-primary-600 hover:underline">
            {t('back_to_signin')}
          </Link>
        </div>
      </div>
    );
  }

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

        <h2 className="mb-2 text-lg font-medium text-ink-primary">{t('forgot_password_title')}</h2>
        <p className="mb-4 text-sm text-ink-secondary">{t('forgot_password_body')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="resetEmail" className="mb-1 block text-sm text-ink-secondary">
              {t('email')}
            </label>
            <input
              id="resetEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-primary-600 font-medium text-ink-inverse hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? t('loading') : t('send_reset_link')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-secondary">
          <Link to="/signin" className="text-primary-600 hover:underline">{t('back_to_signin')}</Link>
        </p>
      </div>
    </div>
  );
}
