import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useMyProfile, useUpdateMyProfile } from '../lib/queries/profile';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Skeleton from '../components/Skeleton';
import { useToast } from '../lib/toastStore';

const roleLabels: Record<string, string> = {
  center_owner: 'role_center_owner',
  supervising_therapist: 'role_supervising',
  therapist: 'role_therapist',
};

export default function Account() {
  const { t, i18n } = useTranslation();
  const { user, memberships } = useAuth();
  const { data: profile, isLoading, isError: profileError } = useMyProfile(user?.id);
  const updateProfile = useUpdateMyProfile();
  const toast = useToast((s) => s.add);

  const role = memberships[0]?.role as string ?? '';
  const centerName = (memberships[0]?.centers as unknown as { name: string } | null)?.name ?? '';
  const email = user?.email ?? '';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [formLoaded, setFormLoaded] = useState(false);

  // Sync form when profile loads
  if (profile && !formLoaded) {
    setFullName(profile.full_name);
    setPhone(profile.phone_e164 ?? '');
    setLanguage(profile.preferred_language);
    setFormLoaded(true);
  }

  async function handleSave() {
    if (!user) return;
    try {
      await updateProfile.mutateAsync({
        userId: user.id,
        updates: {
          full_name: fullName.trim(),
          phone_e164: phone.trim() || null,
          preferred_language: language,
        },
      });
      // Sync app language with saved preference
      if (language !== i18n.language) {
        i18n.changeLanguage(language);
      }
      toast(t('account_saved'), 'success');
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (profileError) {
    return <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-8 text-center"><p className="text-ink-secondary">{t('error_generic')}</p></div>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-2xl font-bold text-ink-primary">{t('account_title')}</h1>

      <div className="space-y-6">
        {/* Identity — read only */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('account_identity')}</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-ink-muted">{t('email')}</p>
              <p className="text-sm text-ink-primary">{email}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t('role')}</p>
              <p className="text-sm text-ink-primary">{t(roleLabels[role] ?? role)}</p>
            </div>
            {centerName && (
              <div>
                <p className="text-xs text-ink-muted">{t('centre')}</p>
                <p className="text-sm text-ink-primary">{centerName}</p>
              </div>
            )}
          </div>
        </section>

        {/* Editable fields */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('account_details')}</h2>
          <div className="space-y-4">
            <Input
              label={t('full_name')}
              value={fullName}
              onChange={(e) => setFullName(e.currentTarget.value)}
              required
            />
            <Input
              label={t('phone')}
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
            />
            <Select
              label={t('preferred_language')}
              value={language}
              onChange={(e) => setLanguage(e.currentTarget.value as 'en' | 'hi')}
              options={[
                { value: 'en', label: t('lang_en') },
                { value: 'hi', label: t('lang_hi') },
              ]}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={updateProfile.isPending}>
              {t('save_changes')}
            </Button>
          </div>
        </section>

        {/* Credentials — read only, managed by centre owner */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-medium text-ink-primary">{t('account_credentials')}</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-ink-muted">{t('discipline')}</p>
              <p className="text-sm text-ink-primary">{profile?.discipline_name ?? '—'}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{t('discipline_managed_by_owner')}</p>
            </div>
            {profile?.rci_registration_number && (
              <div>
                <p className="text-xs text-ink-muted">{t('rci_number')}</p>
                <p className="text-sm text-ink-primary">{profile.rci_registration_number}</p>
              </div>
            )}
            {profile?.credential_class && (
              <div>
                <p className="text-xs text-ink-muted">{t('credential_class')}</p>
                <p className="text-sm text-ink-primary">{profile.credential_class}</p>
              </div>
            )}
            {profile?.qualifications && (
              <div>
                <p className="text-xs text-ink-muted">{t('qualifications')}</p>
                <p className="text-sm text-ink-primary">{profile.qualifications}</p>
              </div>
            )}
            <p className="text-xs text-ink-muted">{t('credentials_onboarding_note')}</p>
          </div>
        </section>

        {/* Password */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-2 text-lg font-medium text-ink-primary">{t('password')}</h2>
          <p className="text-sm text-ink-secondary">{t('password_reset_hint')}</p>
          <a href="/forgot-password" className="mt-2 inline-block text-sm text-primary-600 hover:underline">
            {t('reset_password_link')}
          </a>
        </section>
      </div>
    </div>
  );
}
