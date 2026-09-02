import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMyProfile } from '../lib/queries/profile';
import AvatarCircle from '../components/people/AvatarCircle';

// Sync app language with profile on first load.
// Profile is the source of truth across devices; localStorage is the fast local cache.
function useSyncLanguageFromProfile(profileLang: string | undefined) {
  const { i18n } = useTranslation();
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!profileLang || syncedRef.current) return;
    if (profileLang !== i18n.language) {
      i18n.changeLanguage(profileLang);
    }
    syncedRef.current = true;
  }, [profileLang, i18n]);
}

const roleLabels: Record<string, string> = {
  center_owner: 'role_center_owner',
  supervising_therapist: 'role_supervising',
  therapist: 'role_therapist',
};

export default function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut, memberships } = useAuth();
  const { data: profile } = useMyProfile(user?.id);
  useSyncLanguageFromProfile(profile?.preferred_language);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const name = profile?.full_name ?? user?.email ?? '';
  const role = memberships[0]?.role as string ?? '';
  const email = user?.email ?? '';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1 hover:bg-primary-50"
      >
        <AvatarCircle name={name} size="xs" />
        <span className="hidden text-sm font-medium text-ink-primary sm:inline">{name}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg z-50"
        >
          <div className="mb-3">
            <p className="text-sm font-semibold text-ink-primary">{name}</p>
            <p className="text-xs text-ink-muted">{email}</p>
            {role && <p className="mt-1 text-xs text-ink-secondary">{t(roleLabels[role] ?? role)}</p>}
            {profile?.discipline_name && (
              <p className="text-xs text-ink-muted">{profile.discipline_name}</p>
            )}
          </div>

          <div className="border-t border-border pt-2 space-y-1">
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-ink-primary hover:bg-primary-50"
            >
              {t('account_settings')}
            </Link>
            <button
              onClick={async () => { setOpen(false); await signOut(); navigate('/signin', { replace: true }); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-primary hover:bg-primary-50"
            >
              {t('sign_out')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
