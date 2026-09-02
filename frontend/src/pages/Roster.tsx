import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useRoster, useUpdateMembershipRole, useDeactivateMembership, useDisciplines, useSetMemberDiscipline } from '../lib/queries/memberships';
import { useSessions } from '../lib/queries/sessions';
import { useChildren } from '../lib/queries/children';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import PhoneInput from '../components/forms/PhoneInput';
import Select from '../components/Select';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/states/EmptyState';
import AvatarCircle from '../components/people/AvatarCircle';
import { useToast } from '../lib/toastStore';
import type { Database } from '../types/supabase';

type UserRole = Database['public']['Enums']['user_role'];

const roleFilters: UserRole[] = ['center_owner', 'supervising_therapist', 'therapist'];

const roleColors: Record<UserRole, string> = {
  center_owner: 'bg-purple-100 text-purple-700',
  supervising_therapist: 'bg-primary-100 text-primary-700',
  therapist: 'bg-[hsl(150,50%,92%)] text-[hsl(150,50%,28%)]',
};

const roleLabels: Record<UserRole, string> = {
  center_owner: 'role_center_owner',
  supervising_therapist: 'role_supervising',
  therapist: 'role_therapist',
};

export default function Roster() {
  const { t } = useTranslation();
  const { user, memberships } = useAuth();
  const centerId = memberships[0]?.center_id;
  const myRole = memberships[0]?.role as UserRole;
  const isOwner = myRole === 'center_owner';

  const { data: roster, isLoading } = useRoster(centerId);
  const updateRole = useUpdateMembershipRole(centerId ?? '');
  const deactivate = useDeactivateMembership(centerId ?? '');
  const setDiscipline = useSetMemberDiscipline(centerId ?? '');
  const { data: disciplines } = useDisciplines();
  const toast = useToast((s) => s.add);

  // Fetch data for stats
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { data: weekSessions } = useSessions(centerId, weekStart, weekEnd);
  const { data: children } = useChildren(centerId);

  const [activeFilter, setActiveFilter] = useState<UserRole | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState<string | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<UserRole>('therapist');
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
  const [editDisciplineTarget, setEditDisciplineTarget] = useState<{ userId: string; name: string } | null>(null);
  const [editDisciplineValue, setEditDisciplineValue] = useState<string>('');
  const [disciplineError, setDisciplineError] = useState<string | null>(null);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    full_name: '',
    email: '',
    role: 'therapist' as UserRole,
    rci_registration_number: '',
    credential_class: '',
    phone_e164: '',
    discipline_id: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  // Compute stats
  const stats = useMemo(() => {
    const activeTherapists = roster?.filter(m => m.profiles.is_active).length ?? 0;
    const totalAssigned = children?.length ?? 0;
    const sessionsWeek = weekSessions?.length ?? 0;
    return { activeTherapists, totalAssigned, sessionsWeek };
  }, [roster, children, weekSessions]);

  // Per-therapist stats
  const therapistStats = useMemo(() => {
    const childCounts = new Map<string, number>();
    const sessionCounts = new Map<string, number>();
    const lastSessionInfo = new Map<string, { date: string; childName: string }>();

    for (const c of children ?? []) {
      if (c.primary_therapist_id) {
        childCounts.set(c.primary_therapist_id, (childCounts.get(c.primary_therapist_id) ?? 0) + 1);
      }
    }

    for (const s of weekSessions ?? []) {
      sessionCounts.set(s.therapist_id, (sessionCounts.get(s.therapist_id) ?? 0) + 1);
    }

    // Last session across all sessions this week
    for (const s of weekSessions ?? []) {
      const existing = lastSessionInfo.get(s.therapist_id);
      if (!existing || s.scheduled_date > existing.date) {
        lastSessionInfo.set(s.therapist_id, {
          date: s.scheduled_date,
          childName: s.child?.full_name ?? '',
        });
      }
    }

    return { childCounts, sessionCounts, lastSessionInfo };
  }, [children, weekSessions]);

  // Filter roster
  const filteredRoster = useMemo(() => {
    if (!roster) return [];
    if (!activeFilter) return roster;
    return roster.filter(m => m.role === activeFilter);
  }, [roster, activeFilter]);

  function validateInvite() {
    const errors: Record<string, string> = {};
    if (!inviteForm.full_name.trim()) errors.full_name = t('required_field');
    if (!inviteForm.email.trim()) errors.email = t('required_field');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email)) errors.email = t('invalid_email');
    if (inviteForm.phone_e164 && !/^\+91\d{10}$/.test(inviteForm.phone_e164)) errors.phone_e164 = t('phone_error_length');
    const needsDiscipline = inviteForm.role === 'therapist' || inviteForm.role === 'supervising_therapist';
    if (needsDiscipline && !inviteForm.discipline_id) errors.discipline_id = t('discipline_required_for_therapist');
    return errors;
  }

  async function handleInvite() {
    const errors = validateInvite();
    setInviteErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-therapist', {
        body: {
          email: inviteForm.email,
          full_name: inviteForm.full_name,
          role: inviteForm.role,
          center_id: centerId,
          rci_registration_number: inviteForm.rci_registration_number || undefined,
          credential_class: inviteForm.credential_class || undefined,
          phone_e164: inviteForm.phone_e164 || undefined,
          discipline_id: inviteForm.discipline_id || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('duplicate')) {
          setInviteErrors({ email: t('error_duplicate_email') });
        } else {
          toast(data.error, 'error');
        }
        return;
      }
      toast(t('invite_sent_to', { email: inviteForm.email }), 'success');
      setInviteOpen(false);
      setInviteForm({ full_name: '', email: '', role: 'therapist', rci_registration_number: '', credential_class: '', phone_e164: '', discipline_id: '' });
    } catch {
      toast(t('error_network'), 'error');
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleChange(membershipId: string) {
    if (!user) return;
    await updateRole.mutateAsync({ membershipId, role: editRoleValue, actorId: user.id });
    toast(t('save'), 'success');
    setEditRoleOpen(null);
  }

  async function handleDisciplineChange() {
    if (!editDisciplineTarget) return;
    setDisciplineError(null);
    try {
      await setDiscipline.mutateAsync({
        userId: editDisciplineTarget.userId,
        disciplineId: editDisciplineValue || null,
      });
      toast(t('save'), 'success');
      setEditDisciplineTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('not authorized')) {
        setDisciplineError(t('discipline_error_not_authorized'));
      } else if (msg.includes('discipline not found')) {
        setDisciplineError(t('discipline_error_not_found'));
      } else {
        setDisciplineError(msg || t('error_generic'));
      }
    }
  }

  async function handleDeactivate() {
    if (!user || !deactivateTarget) return;
    await deactivate.mutateAsync({ membershipId: deactivateTarget.id, actorId: user.id });
    toast(t('deactivate'), 'success');
    setDeactivateTarget(null);
  }

  function formatRelativeDate(date: string): string {
    const d = new Date(date + 'T00:00');
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diff === 0) return t('group_today');
    if (diff === 1) return t('group_yesterday');
    return t('relative_days_ago', { n: diff });
  }

  const kpiTiles = [
    { label: t('active_therapists'), value: stats.activeTherapists },
    { label: t('total_children_assigned'), value: stats.totalAssigned },
    { label: t('this_week'), value: stats.sessionsWeek },
  ];

  return (
    <div>
      {/* REGION 1 — Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-ink-primary">{t('therapist_team_title')}</h1>
        {isOwner && (
          <Button onClick={() => setInviteOpen(true)}>+ {t('invite_therapist')}</Button>
        )}
      </div>

      {/* REGION 2 — KPI Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {kpiTiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
              {tile.label}
            </p>
            {isLoading ? (
              <Skeleton className="mt-1.5 h-7 w-12" />
            ) : (
              <p className="mt-1.5 font-manrope text-2xl font-bold leading-tight text-ink-primary">
                {tile.value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* REGION 3 — Role Filter Pills */}
      <div className="mb-5 flex gap-2 overflow-x-auto">
        <button
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !activeFilter
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-ink-secondary hover:bg-gray-200'
          }`}
          onClick={() => setActiveFilter(null)}
        >
          {t('filter_all')}
        </button>
        {roleFilters.map((role) => (
          <button
            key={role}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === role
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-ink-secondary hover:bg-gray-200'
            }`}
            onClick={() => setActiveFilter(activeFilter === role ? null : role)}
          >
            {t(roleLabels[role])}
          </button>
        ))}
      </div>

      {/* REGION 4 — Therapist Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
        </div>
      ) : filteredRoster.length <= 1 && isOwner && !activeFilter ? (
        <>
          {/* Show the single owner card + solo hint */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredRoster.map((m) => {
              const p = m.profiles;
              return (
                <div key={m.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex gap-3">
                    <AvatarCircle name={p.full_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-ink-primary">{p.full_name}</span>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[m.role]}`}>
                        {t(roleLabels[m.role])}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {p.discipline?.display_name ?? t('discipline_not_set')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <EmptyState
              icon="&#x1F91D;"
              title={t('empty_roster_solo_title')}
              description={t('empty_roster_solo_desc')}
              action={{ label: t('invite_therapist'), onClick: () => setInviteOpen(true) }}
            />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredRoster.map((m) => {
            const p = m.profiles;
            const childCount = therapistStats.childCounts.get(m.user_id) ?? 0;
            const sessionCount = therapistStats.sessionCounts.get(m.user_id) ?? 0;
            const lastInfo = therapistStats.lastSessionInfo.get(m.user_id);

            return (
              <div
                key={m.id}
                className="rounded-2xl border border-border bg-surface p-4 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <div className="flex gap-3">
                  <AvatarCircle name={p.full_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink-primary">{p.full_name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[m.role]}`}>
                        {t(roleLabels[m.role])}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {p.discipline?.display_name ?? t('discipline_not_set')}
                    </p>
                    {p.rci_registration_number && (
                      <p className="mt-0.5 text-sm text-ink-muted">{t('rci_number')}: {p.rci_registration_number}</p>
                    )}
                    {p.phone_e164 && (
                      <p className="text-sm text-ink-muted">{p.phone_e164}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                      {t('total_children_assigned')}
                    </p>
                    <p className="mt-0.5 text-lg font-bold text-ink-primary">{childCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                      {t('this_week')}
                    </p>
                    <p className="mt-0.5 text-lg font-bold text-ink-primary">{sessionCount}</p>
                  </div>
                </div>

                {lastInfo && (
                  <p className="mt-2 text-xs text-ink-muted truncate">
                    {t('last_session_with', {
                      time: formatRelativeDate(lastInfo.date),
                      child: lastInfo.childName,
                    })}
                  </p>
                )}

                {isOwner && (
                  <div className="mt-3 flex gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditRoleValue(m.role);
                        setEditRoleOpen(m.id);
                      }}
                    >
                      {t('edit_role')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditDisciplineValue(p.discipline_id ?? '');
                        setDisciplineError(null);
                        setEditDisciplineTarget({ userId: m.user_id, name: p.full_name });
                      }}
                    >
                      {t('set_discipline')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeactivateTarget({ id: m.id, name: p.full_name })}
                    >
                      {t('deactivate')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('invite_therapist')}>
        <div className="space-y-4">
          <Input
            label={t('full_name')}
            value={inviteForm.full_name}
            onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.currentTarget.value })}
            error={inviteErrors.full_name}
            required
          />
          <Input
            label={t('email')}
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.currentTarget.value })}
            error={inviteErrors.email}
            required
          />
          <Select
            label={t('role')}
            value={inviteForm.role}
            onChange={(e) => setInviteForm({ ...inviteForm, role: e.currentTarget.value as UserRole })}
            options={[
              { value: 'supervising_therapist', label: t('role_supervising') },
              { value: 'therapist', label: t('role_therapist') },
            ]}
          />
          <Select
            label={t('discipline')}
            value={inviteForm.discipline_id}
            onChange={(e) => setInviteForm({ ...inviteForm, discipline_id: e.currentTarget.value })}
            options={[
              { value: '', label: t('discipline_not_set') },
              ...(disciplines ?? []).map((d) => ({ value: d.id, label: d.display_name })),
            ]}
            error={inviteErrors.discipline_id}
          />
          <Input
            label={t('rci_number')}
            value={inviteForm.rci_registration_number}
            onChange={(e) => setInviteForm({ ...inviteForm, rci_registration_number: e.currentTarget.value })}
          />
          <Input
            label={t('credential')}
            value={inviteForm.credential_class}
            onChange={(e) => setInviteForm({ ...inviteForm, credential_class: e.currentTarget.value })}
          />
          <PhoneInput
            label={t('phone')}
            value={inviteForm.phone_e164}
            onChange={(v) => setInviteForm({ ...inviteForm, phone_e164: v })}
            error={inviteErrors.phone_e164}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              {t('modal_cancel')}
            </Button>
            <Button onClick={handleInvite} disabled={inviteLoading}>
              {inviteLoading ? t('sending') : t('invite_therapist')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit role modal */}
      <Modal open={!!editRoleOpen} onClose={() => setEditRoleOpen(null)} title={t('edit_role')}>
        <div className="space-y-4">
          <Select
            label={t('role')}
            value={editRoleValue}
            onChange={(e) => setEditRoleValue(e.currentTarget.value as UserRole)}
            options={[
              { value: 'center_owner', label: t('role_center_owner') },
              { value: 'supervising_therapist', label: t('role_supervising') },
              { value: 'therapist', label: t('role_therapist') },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditRoleOpen(null)}>
              {t('modal_cancel')}
            </Button>
            <Button onClick={() => editRoleOpen && handleRoleChange(editRoleOpen)}>
              {t('save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate confirm modal */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title={t('deactivate')}>
        <p className="mb-4 text-sm text-ink-secondary">
          {t('deactivate_confirm', { name: deactivateTarget?.name })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>
            {t('modal_cancel')}
          </Button>
          <Button variant="danger" onClick={handleDeactivate}>
            {t('modal_confirm')}
          </Button>
        </div>
      </Modal>

      {/* Set discipline modal */}
      <Modal open={!!editDisciplineTarget} onClose={() => setEditDisciplineTarget(null)} title={t('set_discipline')}>
        <div className="space-y-4">
          <Select
            label={t('discipline')}
            value={editDisciplineValue}
            onChange={(e) => { setEditDisciplineValue(e.currentTarget.value); setDisciplineError(null); }}
            options={[
              { value: '', label: t('discipline_not_set') },
              ...(disciplines ?? []).map((d) => ({ value: d.id, label: d.display_name })),
            ]}
          />
          {disciplineError && (
            <p className="text-sm text-danger">{disciplineError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditDisciplineTarget(null)}>
              {t('modal_cancel')}
            </Button>
            <Button onClick={handleDisciplineChange} disabled={setDiscipline.isPending}>
              {t('save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
