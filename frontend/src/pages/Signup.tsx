import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LanguageToggle } from '../layout/LanguageToggle';

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError(t('required_field'));
      return;
    }
    if (password.length < 8) {
      setError(t('min_length', { min: 8 }));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwords_no_match'));
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/create-center`,
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already')) {
          setError(t('email_already_registered'));
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // If session exists, user is immediately signed in (no email confirmation)
      if (data.session) {
        navigate('/create-center');
      } else {
        // Email confirmation required
        setConfirmationSent(true);
      }
    } catch {
      setError(t('error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <span className="text-[40px]">&#x2709;</span>
          <h2 className="mt-3 text-xl font-semibold text-ink-primary">{t('check_email_title')}</h2>
          <p className="mt-2 text-sm text-ink-secondary">{t('check_email_body', { email })}</p>
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

        <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('create_account')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm text-ink-secondary">
              {t('full_name')}
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="signupEmail" className="mb-1 block text-sm text-ink-secondary">
              {t('email')}
            </label>
            <input
              id="signupEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="signupPassword" className="mb-1 block text-sm text-ink-secondary">
              {t('password')}
            </label>
            <input
              id="signupPassword"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm text-ink-secondary">
              {t('confirm_password')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-primary-600 font-medium text-ink-inverse hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? t('loading') : t('create_account')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-secondary">
          {t('already_have_account')}{' '}
          <Link to="/signin" className="text-primary-600 hover:underline">{t('sign_in')}</Link>
        </p>
      </div>
    </div>
  );
}
