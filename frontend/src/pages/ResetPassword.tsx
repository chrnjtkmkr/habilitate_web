import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toastStore';
import { LanguageToggle } from '../layout/LanguageToggle';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast((s) => s.add);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Supabase sets the session from the URL hash via onAuthStateChange.
  // We track whether a valid session has been established.
  const [sessionReady, setSessionReady] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if there's already a session (page may have loaded after the event fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    // If no session after 5 seconds, the link is likely expired
    const timeout = setTimeout(() => {
      setSessionReady((ready) => {
        if (!ready) setLinkExpired(true);
        return ready;
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        if (updateErr.message.toLowerCase().includes('expired') || updateErr.message.toLowerCase().includes('invalid')) {
          setLinkExpired(true);
        } else {
          setError(updateErr.message);
        }
        return;
      }
      // Sign out so user logs in fresh with the new password
      await supabase.auth.signOut();
      toast(t('password_reset_success'), 'success');
      navigate('/signin', { replace: true });
    } catch {
      setError(t('error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (linkExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <span className="text-[40px]">&#x23F3;</span>
          <h2 className="mt-3 text-xl font-semibold text-ink-primary">{t('reset_link_expired_title')}</h2>
          <p className="mt-2 text-sm text-ink-secondary">{t('reset_link_expired_body')}</p>
          <Link to="/forgot-password" className="mt-6 inline-block text-sm text-primary-600 hover:underline">
            {t('send_reset_link_again')}
          </Link>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-4 text-sm text-ink-secondary">{t('loading')}</p>
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

        <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('reset_password_title')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm text-ink-secondary">
              {t('new_password')}
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="confirmNewPassword" className="mb-1 block text-sm text-ink-secondary">
              {t('confirm_password')}
            </label>
            <input
              id="confirmNewPassword"
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
            {submitting ? t('loading') : t('set_new_password')}
          </button>
        </form>
      </div>
    </div>
  );
}
