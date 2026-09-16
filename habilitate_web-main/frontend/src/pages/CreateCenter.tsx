import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { LanguageToggle } from '../layout/LanguageToggle';

export default function CreateCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [centerName, setCenterName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!centerName.trim()) {
      setError(t('required_field'));
      return;
    }

    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('create_center_with_owner', {
        p_name: centerName.trim(),
        p_city: city.trim() || undefined,
        p_state: state.trim() || undefined,
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      // Invalidate memberships so RequireAuth picks up the new center
      await queryClient.invalidateQueries({ queryKey: ['memberships', user?.id] });
      navigate('/dashboard');
    } catch {
      setError(t('error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6">
          <img src="/logo.png" alt="" className="mx-auto mb-4 h-[100px] w-[100px]" />
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-ink-primary">{t('app_name')}</h1>
            <LanguageToggle />
          </div>
        </div>

        <h2 className="mb-1 text-lg font-medium text-ink-primary">{t('create_center_title')}</h2>
        <p className="mb-5 text-sm text-ink-secondary">{t('create_center_subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="centerName" className="mb-1 block text-sm text-ink-secondary">
              {t('center_name')}
            </label>
            <input
              id="centerName"
              type="text"
              required
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              placeholder={t('center_name_placeholder')}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="city" className="mb-1 block text-sm text-ink-secondary">
              {t('center_city')}
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="state" className="mb-1 block text-sm text-ink-secondary">
              {t('center_state')}
            </label>
            <input
              id="state"
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink-primary focus:border-primary-500 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-primary-600 font-medium text-ink-inverse hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? t('loading') : t('create_center_button')}
          </button>
        </form>
      </div>
    </div>
  );
}
