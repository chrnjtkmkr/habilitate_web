import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { differenceInMonths, format } from 'date-fns';
import { useChild, useChildSessions } from '../lib/queries/children';
import { useParents, useCreateParent } from '../lib/queries/parents';
import { useChildIntake } from '../lib/queries/intake';
import { useActiveGoals } from '../lib/queries/goals';
import { useParentReports } from '../lib/queries/parentReports';
import { useGoalProgress } from '../lib/queries/goalProgress';
import { useChildEngagementHistory } from '../lib/queries/childEngagement';
import { useChildNotes, useAddChildNote, useUpdateChildNote } from '../lib/queries/notes';
import { domainI18nKeys } from '../lib/domainLabels';
import { formatRelativeTime } from '../lib/utils/relativeTime';
import Button from '../components/Button';
import Pill from '../components/Pill';
import Skeleton from '../components/Skeleton';
import Modal from '../components/Modal';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import PhoneInput from '../components/forms/PhoneInput';
import Select from '../components/Select';
import AvatarCircle from '../components/people/AvatarCircle';
import TrajectoryPill from '../components/people/TrajectoryPill';
import DisciplineBadge from '../components/DisciplineBadge';
import { useAuth } from '../hooks/useAuth';
import { useChildCareTeam, useAddCareTeamMember, useRemoveCareTeamMember, useRoster, useDisciplines } from '../lib/queries/memberships';
import { useMyProfile } from '../lib/queries/profile';
import { useToast } from '../lib/toastStore';
import { supabase } from '../lib/supabase';
import { openPdfFresh } from '../lib/reports/clientPdf';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '../types/supabase';

type LanguageCode = Database['public']['Enums']['language_code'];

const FAMILY_CONTEXT_LABELS: Record<string, string> = {
  '15_30': '15-30 min', 'less_15': 'Less than 15 min', '30_60': '30-60 min', 'more_60': 'More than 60 min',
  'very_comfortable': 'Very comfortable', 'comfortable': 'Comfortable', 'needs_guidance': 'Needs guidance', 'uncomfortable': 'Uncomfortable',
  'reads_hindi': 'Reads Hindi', 'reads_english': 'Reads English', 'reads_both': 'Reads both', 'non_literate': 'Non-literate', 'limited': 'Limited literacy',
};

function humanLabel(raw: string): string {
  return FAMILY_CONTEXT_LABELS[raw] ?? raw.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

// Diagnostic labels imported from shared module; local alias for backward compat with inline uses
const diagnosticKeys: Record<string, string> = {
  autism: 'diagnostic_autism', speech_delay: 'diagnostic_speech_delay', adhd: 'diagnostic_adhd',
  specific_learning_disability: 'diagnostic_specific_learning_disability',
  global_developmental_delay: 'diagnostic_global_developmental_delay',
};
const intakeKeys: Record<string, string> = { not_started: 'intake_not_started', in_progress: 'intake_in_progress', completed: 'intake_completed' };

const domainKeys: Record<string, string> = {
  communication: 'domain_communication', social_reciprocity: 'domain_social_reciprocity', motor_imitation: 'domain_motor_imitation',
  play_skills: 'domain_play_skills', self_regulation: 'domain_self_regulation', attention_executive: 'domain_attention_executive',
};

const bandKeys: Record<string, string> = { pre_emerging: 'skill_band_pre_emerging', emerging: 'skill_band_emerging', established: 'skill_band_established', mastery: 'skill_band_mastery' };

const bandPillVariants: Record<string, 'danger' | 'warning' | 'success' | 'default'> = {
  pre_emerging: 'danger',
  emerging: 'warning',
  established: 'success',
  mastery: 'default',
};

const relationshipOptions = ['mother', 'father', 'grandparent_maternal', 'grandparent_paternal', 'guardian', 'other'];

export default function ChildDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: child, isLoading, isError: childError } = useChild(id);
  const { data: parents } = useParents(id);
  const { data: sessions } = useChildSessions(id);
  const { data: activeGoals } = useActiveGoals(id);
  const { data: recentReports } = useParentReports(id);
  const { data: engHistory } = useChildEngagementHistory(id);
  const createParent = useCreateParent();
  const { data: notes, isLoading: notesLoading } = useChildNotes(id);
  const addNoteMutation = useAddChildNote();
  const updateNoteMutation = useUpdateChildNote();
  const { user, memberships } = useAuth();
  const myRole = memberships[0]?.role;
  const centerId = memberships[0]?.center_id;
  const canManageTeam = myRole === 'center_owner' || myRole === 'supervising_therapist';
  const toast = useToast((s) => s.add);
  const { data: careTeam } = useChildCareTeam(id);
  const { data: roster } = useRoster(canManageTeam ? centerId : undefined);
  const { data: disciplines } = useDisciplines();
  const addMember = useAddCareTeamMember();
  const removeMember = useRemoveCareTeamMember();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({ therapistId: '', disciplineId: '' });

  const { data: myProfile } = useMyProfile(user?.id);

  // Get trajectory from v_pulse_clinical
  const { data: clinicalData } = useQuery({
    queryKey: ['child-clinical', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_pulse_clinical')
        .select('trajectory, active_goal_count, sessions_completed, last_session_date')
        .eq('child_id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const [addParentOpen, setAddParentOpen] = useState(false);
  const [parentForm, setParentForm] = useState({
    full_name: '', relationship: 'mother', phone: '', whatsapp_number_e164: '', email: '', preferred_language: 'hi' as LanguageCode,
  });

  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState('');

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;
  }

  if (childError || !child) {
    return <p className="text-ink-secondary">{t('error_generic')}</p>;
  }

  const ageMonths = differenceInMonths(new Date(), new Date(child.date_of_birth));
  const ageYears = Math.floor(ageMonths / 12);
  const ageRem = ageMonths % 12;

  // Build engagement map per session
  const engMap = new Map<string, number>();
  for (const e of engHistory ?? []) {
    engMap.set(e.session_id, e.avg_engagement_pct);
  }

  async function handleAddParent() {
    if (!id) return;
    try {
      await createParent.mutateAsync({
        child_id: id,
        full_name: parentForm.full_name.trim(),
        relationship: parentForm.relationship,
        phone: parentForm.phone,
        whatsapp_number_e164: parentForm.whatsapp_number_e164 || null,
        email: parentForm.email || null,
        preferred_language: parentForm.preferred_language,
        is_primary_contact: false,
      });
      setAddParentOpen(false);
      setParentForm({ full_name: '', relationship: 'mother', phone: '', whatsapp_number_e164: '', email: '', preferred_language: 'hi' });
      toast(t('save'), 'success');
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  async function handleAddNote() {
    if (!id || !user) return;
    try {
      await addNoteMutation.mutateAsync({
        childId: id,
        body: noteBody.trim(),
        authorId: user.id,
        disciplineId: myProfile?.discipline_id ?? null,
      });
      setAddNoteOpen(false);
      setNoteBody('');
      toast(t('note_saved'), 'success');
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  async function handleUpdateNote(noteId: string) {
    if (!id) return;
    try {
      await updateNoteMutation.mutateAsync({
        noteId,
        childId: id,
        body: editingNoteBody.trim(),
      });
      setEditingNoteId(null);
      setEditingNoteBody('');
      toast(t('note_saved'), 'success');
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <AvatarCircle name={child.full_name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <h1 className="text-[28px] font-bold text-ink-primary">{child.full_name}</h1>
            <Button variant="secondary" onClick={() => navigate(`/children/${id}/edit`)}>
              {t('edit_child')}
            </Button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-secondary">{t('age_years', { years: ageYears, months: ageRem })}</span>
            {child.diagnostic_profile?.map(d => (
              <Pill key={d}>{t(diagnosticKeys[d] ?? d)}</Pill>
            ))}
          </div>
          {child.diagnostic_profile && child.diagnostic_profile.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {child.diagnostic_profile.map(d => (
                <p key={`desc-${d}`} className="text-[12px] text-ink-muted">{t(`diagnostic_desc_${d}`)}</p>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <TrajectoryPill trajectory={clinicalData?.trajectory as string | null} size="md" />
            <span className="text-sm text-ink-muted">
              {clinicalData?.last_session_date
                ? `${t('last_session')}: ${formatRelativeTime(clinicalData.last_session_date, t)}`
                : t('no_sessions_yet')}
              {' · '}
              {clinicalData?.sessions_completed ?? 0} {t('recent_sessions').toLowerCase()}
              {' · '}
              {clinicalData?.active_goal_count ?? 0} {t('active_goals').toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left column (60%) */}
        <div className="flex-1 space-y-6 lg:w-[60%]">
          {/* Recent sessions */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{t('recent_sessions')}</p>
              <button onClick={() => navigate('/sessions')} className="text-xs text-primary-600 hover:underline">
                {t('view_all')}
              </button>
            </div>
            {sessions && sessions.length > 0 ? (
              <div className="divide-y divide-border">
                {sessions.slice(0, 6).map((s) => {
                  const isClickable = s.status === 'completed';
                  const eng = engMap.get(s.id);
                  const engColor = eng == null ? 'bg-gray-200' : eng > 60 ? 'bg-[hsl(150,50%,45%)]' : eng > 30 ? 'bg-warning' : 'bg-danger';

                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 py-2.5 ${isClickable ? 'cursor-pointer hover:bg-primary-50/50 -mx-2 px-2 rounded-lg' : ''}`}
                      onClick={isClickable ? () => navigate(`/sessions/${s.id}/summary`) : undefined}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter') navigate(`/sessions/${s.id}/summary`); } : undefined}
                    >
                      {/* Status icon */}
                      <span className="text-sm">
                        {s.status === 'completed' ? <span className="text-success">&#10003;</span>
                          : s.status === 'cancelled' ? <span className="text-danger">&#8856;</span>
                          : <span className="text-warning">&#9203;</span>}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-primary">
                          {formatRelativeTime(s.scheduled_date, t)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-ink-muted truncate">
                            {s.profiles?.full_name ?? '—'}
                          </p>
                          <DisciplineBadge displayName={s.discipline?.display_name ?? null} />
                        </div>
                      </div>

                      {/* Engagement bar */}
                      {s.status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${engColor}`} style={{ width: `${eng ?? 0}%` }} />
                          </div>
                          <span className="text-xs font-medium text-ink-secondary w-8 text-right">
                            {eng != null ? `${eng}%` : '—'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-sm text-ink-muted text-center">{t('no_sessions_yet')}</p>
            )}
          </section>

          {/* Active Goals */}
          <section className="rounded-2xl border border-border bg-surface p-5" data-tour="child-goals">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{t('active_goals')}</p>
              <button onClick={() => navigate(`/children/${id}/goals`)} className="text-xs text-primary-600 hover:underline">
                {t('view_all_goals')}
              </button>
            </div>
            {activeGoals && activeGoals.length > 0 ? (
              <div className="space-y-3">
                {activeGoals.slice(0, 5).map((g) => (
                  <GoalRow key={g.id} goal={g} childId={id!} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm text-ink-muted text-center">{t('no_goals_yet')}</p>
            )}
          </section>

          {/* Progress */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{t('progress_title')}</p>
              <button onClick={() => navigate(`/children/${id}/progress`)} className="text-xs text-primary-600 hover:underline">
                {t('view_progress')}
              </button>
            </div>
            <p className="text-sm text-ink-muted">{t('progress_card_desc')}</p>
          </section>

          {/* Parent Reports */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{t('reports_title')}</p>
              <button onClick={() => navigate(`/children/${id}/reports`)} className="text-xs text-primary-600 hover:underline">
                {t('view_all_reports')}
              </button>
            </div>
            {recentReports && recentReports.length > 0 ? (
              <div className="divide-y divide-border">
                {recentReports.slice(0, 5).map((r) => {
                  const monthLabel = format(new Date(r.period_start), 'MMMM yyyy');
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-primary-50/50 -mx-2 px-2 rounded-lg"
                      onClick={() => navigate(`/children/${id}/reports/${r.id}`)}
                    >
                      <span className="text-sm text-ink-primary">{monthLabel}</span>
                      <div className="flex items-center gap-2">
                        <Pill variant={r.status === 'approved' || r.status === 'sent' ? 'success' : r.status === 'awaiting_approval' ? 'warning' : 'neutral'}>
                          {t(`report_status_${r.status}`)}
                        </Pill>
                        {r.pdf_url && (
                          <span
                            className="text-xs text-primary-600 hover:underline cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPdfFresh({ centerId: r.center_id, childId: r.child_id, reportId: r.id })
                                .catch(() => toast(t('pdf_link_expired'), 'error'));
                            }}
                          >
                            PDF
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-sm text-ink-muted text-center">{t('no_reports_yet')}</p>
            )}
          </section>

          {/* Care Team Notes */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{t('care_team_notes')}</p>
              <Button size="sm" variant="secondary" onClick={() => setAddNoteOpen(true)}>
                {t('add_note')}
              </Button>
            </div>
            {notesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : notes && notes.length > 0 ? (<>
              <p className="mb-3 text-xs text-ink-muted">{t('notes_shared_with_care_team')}</p>
              <div className="divide-y divide-border">
                {notes.map((n) => (
                  <div key={n.id} className="py-2.5">
                    {editingNoteId === n.id ? (
                      <div className="space-y-2">
                        <textarea
                          className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-primary focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          rows={3}
                          value={editingNoteBody}
                          onChange={(e) => setEditingNoteBody(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => { setEditingNoteId(null); setEditingNoteBody(''); }}>
                            {t('modal_cancel')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateNote(n.id)}
                            disabled={!editingNoteBody.trim() || updateNoteMutation.isPending}
                          >
                            {t('save')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-ink-primary">{n.body}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                          <span>{n.author?.full_name ?? '—'}</span>
                          {n.author?.discipline?.display_name && (
                            <>
                              <span>·</span>
                              <span>{n.author.discipline.display_name}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{formatRelativeTime(n.created_at, t)}</span>
                          {n.scope === 'session' && (
                            <>
                              <span>·</span>
                              <span className="text-ink-muted">{t('from_session')}</span>
                            </>
                          )}
                        </div>
                        {n.author_id === user?.id && (
                          <button
                            className="mt-1 text-xs text-primary-600 hover:underline"
                            onClick={() => { setEditingNoteId(n.id); setEditingNoteBody(n.body); }}
                          >
                            {t('edit_label')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>) : (
              <p className="py-4 text-sm text-ink-muted text-center">{t('no_care_team_notes')}</p>
            )}
          </section>
        </div>

        {/* Right column (40%) */}
        <div className="space-y-6 lg:w-[40%]">
          {/* Care Team */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{t('care_team')}</p>
              {canManageTeam && (
                <Button size="sm" variant="secondary" onClick={() => setAddMemberOpen(true)}>
                  {t('add_member')}
                </Button>
              )}
            </div>
            <div className="divide-y divide-border">
              {(careTeam ?? []).map((ct) => {
                const name = (ct.therapist as unknown as { full_name: string })?.full_name ?? '—';
                const disc = (ct.discipline as unknown as { display_name: string })?.display_name ?? null;
                const isPrimary = ct.therapist_id === child.primary_therapist_id;
                const isSupervising = ct.therapist_id === child.supervising_therapist_id;
                return (
                  <div key={ct.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-primary">{name}</span>
                        {isPrimary && <Pill variant="success">{t('primary_therapist_short')}</Pill>}
                        {isSupervising && !isPrimary && <Pill>{t('supervisor_short')}</Pill>}
                      </div>
                      {disc && <p className="text-xs text-ink-muted">{disc}</p>}
                    </div>
                    {canManageTeam && !isPrimary && !isSupervising && (
                      <button
                        className="text-xs text-danger hover:underline"
                        onClick={() => removeMember.mutate({ careTeamId: ct.id, childId: id! })}
                      >
                        {t('remove_label')}
                      </button>
                    )}
                    {canManageTeam && (isPrimary || isSupervising) && (
                      <span className="text-[10px] text-ink-muted">{t('set_on_child_record')}</span>
                    )}
                  </div>
                );
              })}
              {(!careTeam || careTeam.length === 0) && (
                <p className="py-3 text-sm text-ink-muted text-center">—</p>
              )}
            </div>
          </section>

          {/* Family Contacts */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{t('family_contact')}</p>
              <Button size="sm" variant="secondary" onClick={() => setAddParentOpen(true)}>
                {t('add_contact')}
              </Button>
            </div>
            {parents && parents.length > 0 ? (
              <div className="space-y-3">
                {parents.map(p => (
                  <div key={p.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-primary">{p.full_name}</span>
                      {p.is_primary_contact && <Pill variant="success">{t('primary_contact')}</Pill>}
                    </div>
                    <p className="text-xs text-ink-muted">{t(`relationship_${p.relationship}`)}</p>
                    <p className="text-xs text-ink-secondary">{p.phone}</p>
                    {p.whatsapp_number_e164 && (
                      <p className="text-xs text-ink-muted">WhatsApp &#10003;</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">—</p>
            )}
          </section>

          {/* Intake */}
          <IntakeCard childId={id!} intakeStatus={child.intake_status} navigate={navigate} />
        </div>
      </div>

      {/* Add parent modal */}
      <Modal open={addParentOpen} onClose={() => setAddParentOpen(false)} title={t('add_contact')}>
        <div className="space-y-4">
          <Input label={t('full_name')} value={parentForm.full_name} onChange={(e) => setParentForm({ ...parentForm, full_name: e.currentTarget.value })} required />
          <Select label={t('relationship')} value={parentForm.relationship} onChange={(e) => setParentForm({ ...parentForm, relationship: e.currentTarget.value })}
            options={relationshipOptions.map(r => ({ value: r, label: t(`relationship_${r}`) }))} />
          <PhoneInput label={t('phone')} value={parentForm.phone} onChange={(v) => setParentForm({ ...parentForm, phone: v })} required />
          <PhoneInput label={t('whatsapp_number')} value={parentForm.whatsapp_number_e164} onChange={(v) => setParentForm({ ...parentForm, whatsapp_number_e164: v })} />
          <Input label={t('email')} type="email" value={parentForm.email} onChange={(e) => setParentForm({ ...parentForm, email: e.currentTarget.value })} />
          <Select label={t('preferred_language')} value={parentForm.preferred_language} onChange={(e) => setParentForm({ ...parentForm, preferred_language: e.currentTarget.value as LanguageCode })}
            options={[{ value: 'hi', label: t('lang_hi') }, { value: 'en', label: t('lang_en') }]} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setAddParentOpen(false)}>{t('modal_cancel')}</Button>
            <Button onClick={handleAddParent}>{t('save')}</Button>
          </div>
        </div>
      </Modal>

      {/* Add note modal */}
      <Modal open={addNoteOpen} onClose={() => setAddNoteOpen(false)} title={t('add_note')}>
        <div className="space-y-4">
          <Textarea
            label={t('note_body')}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
          />
          <p className="text-xs text-ink-muted">{t('note_audience_hint')}</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setAddNoteOpen(false); setNoteBody(''); }}>{t('modal_cancel')}</Button>
            <Button
              onClick={handleAddNote}
              disabled={!noteBody.trim() || addNoteMutation.isPending}
            >
              {t('save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add care team member modal */}
      {addMemberOpen && roster && (
        <Modal open onClose={() => setAddMemberOpen(false)} title={t('add_member')}>
          <div className="space-y-4">
            <Select
              label={t('therapist')}
              value={addMemberForm.therapistId}
              onChange={(e) => {
                const tid = e.currentTarget.value;
                const member = roster.find(m => m.user_id === tid);
                const defaultDisc = (member?.profiles as unknown as { discipline_id: string | null })?.discipline_id ?? '';
                setAddMemberForm({ therapistId: tid, disciplineId: defaultDisc });
              }}
              options={[
                { value: '', label: `-- ${t('therapist')} --` },
                ...roster.map(m => ({
                  value: m.user_id,
                  label: (m.profiles as unknown as { full_name: string }).full_name,
                })),
              ]}
            />
            <Select
              label={t('discipline')}
              value={addMemberForm.disciplineId}
              onChange={(e) => setAddMemberForm({ ...addMemberForm, disciplineId: e.currentTarget.value })}
              options={[
                { value: '', label: `-- ${t('discipline')} --` },
                ...(disciplines ?? []).map(d => ({ value: d.id, label: d.display_name })),
              ]}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setAddMemberOpen(false)}>{t('modal_cancel')}</Button>
              <Button
                disabled={!addMemberForm.therapistId || addMember.isPending}
                onClick={async () => {
                  try {
                    await addMember.mutateAsync({
                      childId: id!,
                      therapistId: addMemberForm.therapistId,
                      disciplineId: addMemberForm.disciplineId || null,
                    });
                    setAddMemberOpen(false);
                    setAddMemberForm({ therapistId: '', disciplineId: '' });
                    toast(t('member_added'), 'success');
                  } catch {
                    toast(t('error_generic'), 'error');
                  }
                }}
              >
                {t('save')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Goal row with inline progress bar
function GoalRow({ goal, childId }: { goal: { id: string; name: string; target_domain: string; target_skill_level: string; status: string; activity_id: string | null }; childId: string }) {
  const { t } = useTranslation();
  const { data: progress } = useGoalProgress(goal.id, childId, goal.status, goal.activity_id);

  const pct = progress?.progress_pct;
  const barColor = pct == null ? 'bg-gray-200' : pct > 60 ? 'bg-[hsl(150,50%,45%)]' : pct > 30 ? 'bg-warning' : 'bg-danger';

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-primary truncate">{goal.name}</span>
        <span className="text-xs font-medium text-ink-secondary ml-2 shrink-0">
          {pct != null ? `${pct}%` : '—'}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <div className="mt-1 flex gap-1.5">
        <Pill>{t(domainI18nKeys[goal.target_domain as keyof typeof domainI18nKeys] ?? goal.target_domain)}</Pill>
      </div>
    </div>
  );
}

// Intake card for right column
function IntakeCard({ childId, intakeStatus, navigate }: { childId: string; intakeStatus: string; navigate: (path: string) => void }) {
  const { t } = useTranslation();
  const { data: intakeData } = useChildIntake(childId);

  const outputs = intakeData?.assessment?.computed_outputs as {
    baseline_skill_bands?: Record<string, string>;
    family_context?: { parent_literacy_level?: string; home_practice_capacity?: string };
    child_profile?: { diagnostic_profile?: string[] };
  } | null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{t('intake_status')}</p>
        <Pill variant={intakeStatus === 'completed' ? 'success' : intakeStatus === 'in_progress' ? 'warning' : 'neutral'}>
          {t(intakeKeys[intakeStatus])}
        </Pill>
      </div>

      {intakeStatus === 'not_started' && (
        <Button size="sm" onClick={() => navigate(`/children/${childId}/intake`)}>{t('start_intake')}</Button>
      )}

      {intakeStatus === 'in_progress' && (
        <Button size="sm" onClick={() => navigate(`/children/${childId}/intake`)}>{t('resume_intake')}</Button>
      )}

      {intakeStatus === 'completed' && outputs && (
        <div className="space-y-3">
          {outputs.child_profile?.diagnostic_profile && outputs.child_profile.diagnostic_profile.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-ink-muted">{t('diagnostic_profile')}</p>
              <div className="flex flex-wrap gap-1">
                {outputs.child_profile.diagnostic_profile.map(d => (
                  <Pill key={d}>{t(diagnosticKeys[d] ?? d)}</Pill>
                ))}
              </div>
            </div>
          )}

          {outputs.baseline_skill_bands && (
            <div>
              <p className="mb-2 text-xs font-medium text-ink-muted">{t('baseline_skill_bands')}</p>
              <div className="space-y-2">
                {Object.entries(outputs.baseline_skill_bands).map(([domain, band]) => (
                  <div key={domain}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-secondary">{t(domainKeys[domain] ?? domain)}</span>
                      <Pill variant={bandPillVariants[band] ?? 'neutral'}>{t(bandKeys[band] ?? band)}</Pill>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-muted">{t(`band_desc_${band}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outputs.family_context && (
            <div>
              <p className="mb-2 text-xs font-medium text-ink-muted">{t('family_context')}</p>
              <div className="space-y-2">
                {outputs.family_context.parent_literacy_level && (
                  <div>
                    <p className="text-xs text-ink-secondary">{t('literacy_level')}: <span className="font-medium text-ink-primary">{humanLabel(outputs.family_context.parent_literacy_level)}</span></p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">{t(`literacy_desc_${outputs.family_context.parent_literacy_level}`)}</p>
                  </div>
                )}
                {outputs.family_context.home_practice_capacity && (
                  <div>
                    <p className="text-xs text-ink-secondary">{t('home_practice_time')}: <span className="font-medium text-ink-primary">{humanLabel(outputs.family_context.home_practice_capacity)}</span></p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">{t(`home_practice_desc_${outputs.family_context.home_practice_capacity}`)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <button onClick={() => navigate(`/children/${childId}/intake?mode=view`)} className="text-xs text-primary-600 hover:underline">
            {t('view_full_intake')}
          </button>
        </div>
      )}
    </section>
  );
}
