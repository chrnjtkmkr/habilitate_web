import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCreateChild } from '../lib/queries/children';
import { ALL_DIAGNOSTIC_PROFILES, diagnosticI18nKeys } from '../lib/domainLabels';
import { useCreateParent } from '../lib/queries/parents';
import { useRoster } from '../lib/queries/memberships';
import Button from '../components/Button';
import Input from '../components/Input';
import PhoneInput from '../components/forms/PhoneInput';
import Select from '../components/Select';
import { useToast } from '../lib/toastStore';
import type { Database } from '../types/supabase';

type DiagnosticProfile = Database['public']['Enums']['diagnostic_profile'];
type LanguageCode = Database['public']['Enums']['language_code'];
const relationshipOptions = [
  'mother', 'father', 'grandparent_maternal', 'grandparent_paternal', 'guardian', 'other',
];

export default function ChildNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, memberships } = useAuth();
  const centerId = memberships[0]?.center_id;
  const createChild = useCreateChild(centerId ?? '');
  const createParent = useCreateParent();
  const { data: roster } = useRoster(centerId);
  const toast = useToast((s) => s.add);

  const therapists = roster?.filter((m) =>
    m.role === 'therapist' || m.role === 'supervising_therapist' || m.role === 'center_owner',
  ) ?? [];
  const supervisors = roster?.filter((m) =>
    m.role === 'supervising_therapist' || m.role === 'center_owner',
  ) ?? [];

  const ownerUserId = roster?.find((m) => m.role === 'center_owner')?.user_id ?? '';

  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: 'Male',
    primary_language: 'en' as LanguageCode,
    diagnostic_profile: [] as DiagnosticProfile[],
    primary_therapist_id: '',
    supervising_therapist_id: '',
  });

  // Default primary therapist to the centre owner once roster loads
  if (ownerUserId && !form.primary_therapist_id) {
    setForm((f) => ({ ...f, primary_therapist_id: ownerUserId }));
  }

  const [parent, setParent] = useState({
    full_name: '',
    relationship: 'mother',
    phone: '',
    whatsapp_same: true,
    whatsapp_number_e164: '',
    email: '',
    preferred_language: 'hi' as LanguageCode,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function toggleDiagnostic(d: DiagnosticProfile) {
    setForm((f) => ({
      ...f,
      diagnostic_profile: f.diagnostic_profile.includes(d)
        ? f.diagnostic_profile.filter((x) => x !== d)
        : [...f.diagnostic_profile, d],
    }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (form.full_name.trim().length < 2) e.full_name = t('min_length', { min: 2 });
    if (!form.date_of_birth) e.date_of_birth = t('required_field');
    else {
      const dob = new Date(form.date_of_birth);
      if (dob > new Date()) e.date_of_birth = t('dob_future');
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      if (dob < eighteenYearsAgo) e.date_of_birth = t('dob_too_old');
    }
    if (form.diagnostic_profile.length === 0) e.diagnostic_profile = t('select_one');
    if (!form.primary_therapist_id) e.primary_therapist_id = t('required_field');
    if (!form.supervising_therapist_id) e.supervising_therapist_id = t('required_field');
    if (parent.full_name.trim().length < 2) e.parent_full_name = t('min_length', { min: 2 });
    if (!parent.phone || !/^\+91\d{10}$/.test(parent.phone)) e.parent_phone = t('phone_error_length');
    if (parent.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parent.email)) e.parent_email = t('invalid_email');
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const childData = await createChild.mutateAsync({
        child: {
          full_name: form.full_name.trim(),
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          primary_language: form.primary_language,
          diagnostic_profile: form.diagnostic_profile,
          primary_therapist_id: form.primary_therapist_id,
          supervising_therapist_id: form.supervising_therapist_id,
        },
        actorId: user!.id,
      });

      await createParent.mutateAsync({
        child_id: childData.id,
        full_name: parent.full_name.trim(),
        relationship: parent.relationship,
        phone: parent.phone,
        whatsapp_number_e164: parent.whatsapp_same ? parent.phone : (parent.whatsapp_number_e164 || null),
        email: parent.email || null,
        preferred_language: parent.preferred_language,
        is_primary_contact: true,
      });

      navigate(`/children/${childData.id}/intake`);
    } catch {
      toast(t('error_generic'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-ink-primary">{t('add_child')}</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Child basics */}
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('child_basics')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('full_name')}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.currentTarget.value })}
              error={errors.full_name}
              required
              className="sm:col-span-2"
            />
            <Input
              label={t('date_of_birth')}
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.currentTarget.value })}
              error={errors.date_of_birth}
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

        {/* Section 2: Diagnostic profile */}
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
          {errors.diagnostic_profile && (
            <p className="mt-2 text-xs text-danger">{errors.diagnostic_profile}</p>
          )}
        </section>

        {/* Section 3: Care team */}
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('care_team')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t('primary_therapist')}
              value={form.primary_therapist_id}
              onChange={(e) => setForm({ ...form, primary_therapist_id: e.currentTarget.value })}
              error={errors.primary_therapist_id}
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
              error={errors.supervising_therapist_id}
              placeholder={`-- ${t('supervising_therapist')} --`}
              options={supervisors.map((m) => ({
                value: m.user_id,
                label: m.profiles.full_name,
              }))}
            />
          </div>
        </section>

        {/* Section 4: Primary parent contact */}
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('family_contact')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('full_name')}
              value={parent.full_name}
              onChange={(e) => setParent({ ...parent, full_name: e.currentTarget.value })}
              error={errors.parent_full_name}
              required
            />
            <Select
              label={t('relationship')}
              value={parent.relationship}
              onChange={(e) => setParent({ ...parent, relationship: e.currentTarget.value })}
              options={relationshipOptions.map((r) => ({
                value: r,
                label: t(`relationship_${r}`),
              }))}
            />
            <PhoneInput
              label={t('phone')}
              value={parent.phone}
              onChange={(v) => setParent({ ...parent, phone: v })}
              error={errors.parent_phone}
              required
            />
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-ink-primary">
                <input
                  type="checkbox"
                  checked={parent.whatsapp_same}
                  onChange={(e) => setParent({ ...parent, whatsapp_same: e.target.checked })}
                  className="rounded border-border text-primary-600 focus:ring-primary-500"
                />
                {t('whatsapp_same_as_phone')}
              </label>
              {!parent.whatsapp_same && (
                <PhoneInput
                  label={t('whatsapp_number')}
                  value={parent.whatsapp_number_e164}
                  onChange={(v) => setParent({ ...parent, whatsapp_number_e164: v })}
                />
              )}
            </div>
            <Input
              label={t('email')}
              type="email"
              value={parent.email}
              onChange={(e) => setParent({ ...parent, email: e.currentTarget.value })}
              error={errors.parent_email}
            />
            <Select
              label={t('preferred_language')}
              value={parent.preferred_language}
              onChange={(e) => setParent({ ...parent, preferred_language: e.currentTarget.value as LanguageCode })}
              options={[
                { value: 'hi', label: t('lang_hi') },
                { value: 'en', label: t('lang_en') },
              ]}
            />
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={() => navigate('/children')}>
            {t('modal_cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('sending') : t('create_child')}
          </Button>
        </div>
      </form>
    </div>
  );
}
