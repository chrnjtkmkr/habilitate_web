import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const DEMO_EMAIL = 'demo-tour@sunshine-pediatric-indore.local';
const DEMO_PASSWORD = 'demo-2026-habilitate-tour';

export default function Demo() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function autoSignIn() {
      // Clear any prior tour state so restart works cleanly
      sessionStorage.removeItem('habilitate-tour');

      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      // Mark tour active BEFORE navigating so TourOverlay picks it up immediately
      sessionStorage.setItem('habilitate-tour', 'active');
      navigate('/dashboard?tour=1', { replace: true });
    }
    autoSignIn();
    return () => { cancelled = true; };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-medium text-danger">{t('demo_error_title')}</p>
          <p className="mt-2 text-sm text-ink-secondary">{error}</p>
          <a href="/signin" className="mt-4 inline-block text-sm text-primary-600 hover:underline">
            {t('demo_manual_signin')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="mt-4 text-sm text-ink-secondary">{t('demo_signing_in')}</p>
      </div>
    </div>
  );
}
