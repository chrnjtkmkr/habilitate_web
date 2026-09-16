import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChild, useUpdateChild } from '../lib/queries/children';
import { ALL_DIAGNOSTIC_PROFILES, diagnosticI18nKeys } from '../lib/domainLabels';
import { useRoster } from '../lib/queries/memberships';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Skeleton from '../components/Skeleton';
import { useToast } from '../lib/toastStore';
import type { Database } from '../types/supabase';

type DiagnosticProfile = Database['public']['Enums']['diagnostic_profile'];
type LanguageCode = Database['public']['Enums']['language_code'];

export default function ChildEdit() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, memberships } = useAuth();
  const centerId = memberships[0]?.center_id;
  const myRole = memberships[0]?.role;
  const canAssignTherapists = myRole === 'center_owner' || myRole === 'supervising_therapist';
  const { data: child, isLoading, isError: childError } = useChild(id);
  const { data: roster } = useRoster(centerId);
  const updateChild = useUpdateChild(centerId ?? '');
  const toast = useToast((s) => s.add);

  const therapists = roster?.filter((m) =>
    m.role === 'therapist' || m.role === 'supervising_therapist' || m.role === 'center_owner',
  ) ?? [];
  const supervisors = roster?.filter((m) =>
    m.role === 'supervising_therapist' || m.role === 'center_owner',
  ) ?? [];

  const initialForm = useMemo(() => ({
    full_name: child?.full_name ?? '',
    date_of_birth: child?.date_of_birth ?? '',
    gender: child?.gender ?? 'Male',
    primary_language: (child?.primary_language ?? 'en') as LanguageCode,
    diagnostic_profile: (child?.diagnostic_profile ?? []) as DiagnosticProfile[],
    primary_therapist_id: child?.primary_therapist_id ?? '',
    supervising_therapist_id: child?.supervising_therapist_id ?? '',
  }), [child]);

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when child data loads (key-based remounting would be cleaner but this works)
  if (child && form.full_name === '' && initialForm.full_name !== '') {
    setForm(initialForm);
  }

  function toggleDiagnostic(d: DiagnosticProfile) {
    setForm((f) => ({
      ...f,
      diagnostic_profile: f.diagnostic_profile.includes(d)
        ? f.diagnostic_profile.filter((x) => x !== d)
        : [...f.diagnostic_profile, d],
    }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!id || !user) return;
    setSubmitting(true);
    try {
      const updates: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        primary_language: form.primary_language,
        diagnostic_profile: form.diagnostic_profile,
      };
      // Only include therapist assignment when the user has permission to change them
      if (canAssignTherapists) {
        updates.primary_therapist_id = form.primary_therapist_id || null;
        updates.supervising_therapist_id = form.supervising_therapist_id || null;
      }
      await updateChild.mutateAsync({
        childId: id,
        updates,
        actorId: user.id,
      });
      navigate(`/children/${id}`);
    } catch {
      toast(t('error_generic'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;
  }

  if (childError || !child) {
    return <div className="rounded-2xl border border-border bg-surface p-8 text-center"><p className="text-ink-secondary">{t('error_generic')}</p></div>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-ink-primary">{t('edit_child')}</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('child_basics')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('full_name')}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.currentTarget.value })}
              required
              className="sm:col-span-2"
            />
            <Input
              label={t('date_of_birth')}
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.currentTarget.value })}
              required
            />
            <Select
              label={t('gender')}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.currentTarget.value })}
              options={[
                { value: 'Male', label: t('gender_male') },
                { value: 'Female', label: t('gender_female') },
                { value: 'Other', label: t('gender_other') },
              ]}
            />
            <Select
              label={t('primary_language')}
              value={form.primary_language}
              onChange={(e) => setForm({ ...form, primary_language: e.currentTarget.value as LanguageCode })}
              options={[
                { value: 'en', label: t('lang_en') },
                { value: 'hi', label: t('lang_hi') },
              ]}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('diagnostic_profile')}</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_DIAGNOSTIC_PROFILES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDiagnostic(d)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  form.diagnostic_profile.includes(d)
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-border text-ink-secondary hover:bg-primary-50'
                }`}
              >
                {t(diagnosticI18nKeys[d])}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('care_team')}</h2>
          {canAssignTherapists ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label={t('primary_therapist')}
                value={form.primary_therapist_id}
                onChange={(e) => setForm({ ...form, primary_therapist_id: e.currentTarget.value })}
                placeholder={`-- ${t('primary_therapist')} --`}
                options={therapists.map((m) => ({
                  value: m.user_id,
                  label: m.profiles.full_name,
                }))}
              />
              <Select
                label={t('supervising_therapist')}
                value={form.supervising_therapist_id}
                onChange={(e) => setForm({ ...form, supervising_therapist_id: e.currentTarget.value })}
                placeholder={`-- ${t('supervising_therapist')} --`}
                options={supervisors.map((m) => ({
                  value: m.user_id,
                  label: m.profiles.full_name,
                }))}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-ink-muted">{t('primary_therapist')}</p>
                <p className="text-sm font-medium text-ink-primary">{child?.primary_therapist?.full_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t('supervising_therapist')}</p>
                <p className="text-sm font-medium text-ink-primary">{child?.supervising_therapist_profile?.full_name ?? '—'}</p>
              </div>
              <p className="text-xs text-ink-muted">{t('therapist_assignment_read_only')}</p>
            </div>
          )}
        </section>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={() => navigate(`/children/${id}`)}>
            {t('modal_cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('sending') : t('save_changes')}
          </Button>
        </div>
      </form>
    </div>
  );
}
