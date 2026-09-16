import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays, addDays, startOfWeek, endOfWeek, isToday as isTodayFn, isYesterday } from 'date-fns';
import { enUS, hi } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSessionsList, useCreateSession, useMarkPresent, useMarkAbsent, useCancelSession } from '../lib/queries/sessions';
import { useChildren } from '../lib/queries/children';
import { useRoster, useDisciplines, useMyCareTeamChildIds } from '../lib/queries/memberships';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/states/EmptyState';
import AvatarCircle from '../components/people/AvatarCircle';
import DisciplineBadge from '../components/DisciplineBadge';
import SessionsCalendarView from '../components/sessions/SessionsCalendarView';
import { useToast } from '../lib/toastStore';
import type { Database } from '../types/supabase';

type SessionStatus = Database['public']['Enums']['session_status'];

const statusFilters: SessionStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];

const statusIcons: Record<SessionStatus, string> = {
  scheduled: '\u{1F4C5}',
  in_progress: '\u231B',
  completed: '\u2713',
  cancelled: '\u2298',
  no_show: '\u2298',
};

const statusColors: Record<SessionStatus, string> = {
  scheduled: 'text-ink-muted',
  in_progress: 'text-amber-600',
  completed: 'text-[hsl(150,50%,28%)]',
  cancelled: 'text-[hsl(350,70%,40%)]',
  no_show: 'text-ink-muted',
};

// Generate 15-minute increment time options from 07:00 to 20:00
const timeOptions = Array.from({ length: 53 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 15;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return { value: `${h}:${m}`, label: `${h}:${m}` };
});

const durationOptions = [
  { value: '30', label: 'duration_30' },
  { value: '45', label: 'duration_45' },
  { value: '60', label: 'duration_60' },
  { value: '90', label: 'duration_90' },
];

function formatTime(time: string | null) {
  if (!time) return '';
  return time.slice(0, 5);
}

function engagementTone(pct: number): string {
  if (pct >= 60) return 'bg-[hsl(150,50%,85%)]';
  if (pct >= 30) return 'bg-amber-200';
  return 'bg-[hsl(350,70%,90%)]';
}

function engagementBarFg(pct: number): string {
  if (pct >= 60) return 'bg-[hsl(150,50%,45%)]';
  if (pct >= 30) return 'bg-amber-500';
  return 'bg-[hsl(350,70%,50%)]';
}

export default function Sessions() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, memberships } = useAuth();
  const centerId = memberships[0]?.center_id;
  const dateLocale = i18n.language === 'hi' ? hi : enUS;
  const toast = useToast((s) => s.add);

  const activeFilter = (searchParams.get('status') as SessionStatus | null) ?? null;
  const activeView = searchParams.get('view') === 'calendar' ? 'calendar' : 'list';

  // Calendar week state from URL (?week=2026-06-08) or default to current week
  const calendarWeekStart = useMemo(() => {
    const weekParam = searchParams.get('week');
    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      return startOfWeek(new Date(weekParam + 'T00:00'), { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  }, [searchParams]);

  // Fetch past 60 days + upcoming 30 days of sessions
  const dateFrom = format(subDays(new Date(), 60), 'yyyy-MM-dd');
  const dateTo = format(addDays(new Date(), 30), 'yyyy-MM-dd');
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const role = memberships[0]?.role;
  const isPrivileged = role === 'center_owner' || role === 'supervising_therapist';

  const { data: allSessions, isLoading } = useSessionsList(centerId, dateFrom, dateTo);
  const { data: careTeamChildIds } = useMyCareTeamChildIds(isPrivileged ? undefined : user?.id);
  const { data: children } = useChildren(centerId);
  const { data: roster } = useRoster(centerId);
  const { data: disciplines } = useDisciplines();

  // Scope visible sessions: privileged users see all, therapists see only their own or care-team sessions
  const sessions = useMemo(() => {
    if (!allSessions) return undefined;
    if (isPrivileged) return allSessions;
    const careSet = new Set(careTeamChildIds ?? []);
    return allSessions.filter(
      (s) => s.therapist_id === user?.id || careSet.has(s.child_id),
    );
  }, [allSessions, isPrivileged, careTeamChildIds, user?.id]);
  const createSession = useCreateSession(centerId ?? '');
  const markPresent = useMarkPresent(centerId ?? '');
  const markAbsent = useMarkAbsent(centerId ?? '');
  const cancelSession = useCancelSession(centerId ?? '');

  // Schedule modal
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedForm, setSchedForm] = useState({
    child_id: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    scheduled_time: '09:00',
    duration_minutes: '45',
    therapist_id: '',
    discipline_id: '',
    repeat_weekly: false,
    repeat_until: '',
  });

  // Session detail modal
  const [detailSession, setDetailSession] = useState<NonNullable<typeof sessions>[number] | null>(null);

  // Cancel modal
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Absent modal
  const [absentOpen, setAbsentOpen] = useState(false);
  const [absentReason, setAbsentReason] = useState('');

  const therapistOptions = useMemo(() =>
    roster?.filter((m) => m.role === 'therapist' || m.role === 'supervising_therapist' || m.role === 'center_owner')
      .map((m) => ({ value: m.user_id, label: m.profiles.full_name })) ?? [],
    [roster],
  );

  function disciplineForTherapist(therapistId: string): string {
    const m = roster?.find((r) => r.user_id === therapistId);
    return m?.profiles.discipline_id ?? 'unspecified';
  }

  // Compute engagement averages and stats
  const sessionStats = useMemo(() => {
    if (!sessions) return { todayCount: 0, weekCount: 0, completedWeek: 0, avgEngagement: null as number | null, engagementMap: new Map<string, number>() };

    let todayCount = 0;
    let weekCount = 0;
    let completedWeek = 0;
    let weekEngSum = 0;
    let weekEngCount = 0;
    const engagementMap = new Map<string, number>();

    for (const s of sessions) {
      if (s.scheduled_date === todayStr) todayCount++;
      if (s.scheduled_date >= weekStartStr && s.scheduled_date <= weekEndStr) {
        weekCount++;
        if (s.status === 'completed') completedWeek++;
      }

      // Compute avg engagement from nested samples
      const samples = (s as { engagement_samples?: { composite_score: number | null }[] }).engagement_samples;
      if (samples && samples.length > 0) {
        const validScores = samples.filter(e => e.composite_score != null).map(e => e.composite_score!);
        if (validScores.length > 0) {
          const avg = Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 100);
          engagementMap.set(s.id, avg);
          if (s.status === 'completed' && s.scheduled_date >= weekStartStr && s.scheduled_date <= weekEndStr) {
            weekEngSum += avg;
            weekEngCount++;
          }
        }
      }
    }

    return {
      todayCount,
      weekCount,
      completedWeek,
      avgEngagement: weekEngCount > 0 ? Math.round(weekEngSum / weekEngCount) : null,
      engagementMap,
    };
  }, [sessions, todayStr, weekStartStr, weekEndStr]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (!activeFilter) return sessions;
    return sessions.filter(s => s.status === activeFilter);
  }, [sessions, activeFilter]);

  // Group sessions by time
  const groupedSessions = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayS = format(today, 'yyyy-MM-dd');
    const yesterdayS = format(yesterday, 'yyyy-MM-dd');
    const weekEndS = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    // Buckets: today, this-week (rest of week after today), upcoming (beyond week), yesterday, earlier (past)
    const groups: { key: string; label: string; sessions: typeof filteredSessions }[] = [
      { key: 'today', label: t('group_today'), sessions: [] },
      { key: 'this_week', label: t('group_this_week'), sessions: [] },
      { key: 'upcoming', label: t('group_upcoming'), sessions: [] },
      { key: 'yesterday', label: t('group_yesterday'), sessions: [] },
      { key: 'earlier', label: t('group_earlier'), sessions: [] },
    ];

    for (const s of filteredSessions) {
      if (s.scheduled_date === todayS) groups[0].sessions.push(s);
      else if (s.scheduled_date > todayS && s.scheduled_date <= weekEndS) groups[1].sessions.push(s);
      else if (s.scheduled_date > weekEndS) groups[2].sessions.push(s);
      else if (s.scheduled_date === yesterdayS) groups[3].sessions.push(s);
      else groups[4].sessions.push(s);
    }

    // Future buckets: soonest-first; past buckets: most-recent-first
    groups[1].sessions.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    groups[2].sessions.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    return groups.filter(g => g.sessions.length > 0);
  }, [filteredSessions, t]);

  function handleFilterChange(status: SessionStatus | null) {
    const params: Record<string, string> = {};
    if (activeView === 'calendar') params.view = 'calendar';
    if (searchParams.get('week')) params.week = searchParams.get('week')!;
    if (status) params.status = status;
    setSearchParams(params);
  }

  function handleViewChange(view: 'list' | 'calendar') {
    const params: Record<string, string> = {};
    if (view === 'calendar') params.view = 'calendar';
    if (activeFilter) params.status = activeFilter;
    if (searchParams.get('week')) params.week = searchParams.get('week')!;
    setSearchParams(params);
  }

  function handleWeekChange(newStart: Date) {
    const weekStr = format(startOfWeek(newStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const params: Record<string, string> = { view: 'calendar', week: weekStr };
    if (activeFilter) params.status = activeFilter;
    setSearchParams(params);
  }

  // Sessions filtered for calendar week
  const calendarSessions = useMemo(() => {
    if (!filteredSessions) return [];
    const start = format(calendarWeekStart, 'yyyy-MM-dd');
    const end = format(addDays(calendarWeekStart, 6), 'yyyy-MM-dd');
    return filteredSessions.filter(s => s.scheduled_date >= start && s.scheduled_date <= end);
  }, [filteredSessions, calendarWeekStart]);

  function handleSessionClick(s: NonNullable<typeof sessions>[number]) {
    if (s.status === 'completed') {
      navigate(`/sessions/${s.id}/summary`);
    } else if (s.status === 'in_progress' || s.status === 'scheduled') {
      setDetailSession(s);
    }
  }

  function getSessionDuration(s: NonNullable<typeof sessions>[number]): number | null {
    if (s.started_at && s.ended_at) {
      return Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
    }
    return s.duration_minutes;
  }

  function getActivityCount(s: NonNullable<typeof sessions>[number]): number {
    const sa = (s as { session_activities?: { id: string; trials?: { id: string }[] }[] }).session_activities;
    return sa?.length ?? 0;
  }

  function getTrialCount(s: NonNullable<typeof sessions>[number]): number {
    const sa = (s as { session_activities?: { id: string; trials?: { id: string }[] }[] }).session_activities;
    if (!sa) return 0;
    return sa.reduce((sum, a) => sum + (a.trials?.length ?? 0), 0);
  }

  function formatSessionTime(s: NonNullable<typeof sessions>[number]): string {
    const time = formatTime(s.scheduled_time);
    if (!time) return '';
    if (isTodayFn(new Date(s.scheduled_date + 'T00:00'))) return time;
    const d = new Date(s.scheduled_date + 'T00:00');
    if (isYesterday(d)) return `${t('group_yesterday')} ${time}`;
    return `${format(d, 'MMM d', { locale: dateLocale })} ${time}`;
  }

  async function handleSchedule() {
    if (!user || !schedForm.child_id || !schedForm.therapist_id) return;

    const sessionDates: string[] = [schedForm.scheduled_date];
    if (schedForm.repeat_weekly && schedForm.repeat_until) {
      const start = new Date(schedForm.scheduled_date);
      const end = new Date(schedForm.repeat_until);
      const dayOfWeek = start.getDay();
      const current = new Date(start);
      current.setDate(current.getDate() + 7);
      while (current <= end) {
        if (current.getDay() === dayOfWeek) {
          sessionDates.push(format(current, 'yyyy-MM-dd'));
        }
        current.setDate(current.getDate() + 7);
      }
    }

    try {
      await createSession.mutateAsync({
        sessions: sessionDates.map((d) => ({
          child_id: schedForm.child_id,
          scheduled_date: d,
          scheduled_time: schedForm.scheduled_time,
          duration_minutes: parseInt(schedForm.duration_minutes),
          therapist_id: schedForm.therapist_id,
          discipline_id: schedForm.discipline_id || 'unspecified',
        })),
        actorId: user.id,
      });
      toast(t('schedule_session'), 'success');
      setScheduleOpen(false);
      setSchedForm({ child_id: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), scheduled_time: '09:00', duration_minutes: '45', therapist_id: '', discipline_id: '', repeat_weekly: false, repeat_until: '' });
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  async function handleMarkPresent() {
    if (!detailSession || !user) return;
    await markPresent.mutateAsync({ sessionId: detailSession.id, actorId: user.id });
    toast(t('mark_present'), 'success');
    setDetailSession(null);
  }

  async function handleMarkAbsent() {
    if (!detailSession || !user) return;
    await markAbsent.mutateAsync({ sessionId: detailSession.id, reason: absentReason, actorId: user.id });
    toast(t('mark_absent'), 'success');
    setAbsentOpen(false);
    setDetailSession(null);
    setAbsentReason('');
  }

  async function handleCancel() {
    if (!detailSession || !user) return;
    await cancelSession.mutateAsync({ sessionId: detailSession.id, reason: cancelReason, actorId: user.id });
    toast(t('cancel_session'), 'success');
    setCancelOpen(false);
    setDetailSession(null);
    setCancelReason('');
  }

  function handleReschedule() {
    if (!detailSession) return;
    setSchedForm({
      child_id: detailSession.child_id,
      scheduled_date: detailSession.scheduled_date,
      scheduled_time: formatTime(detailSession.scheduled_time) || '09:00',
      duration_minutes: String(detailSession.duration_minutes ?? 45),
      therapist_id: detailSession.therapist_id,
      discipline_id: detailSession.discipline_id ?? disciplineForTherapist(detailSession.therapist_id),
      repeat_weekly: false,
      repeat_until: '',
    });
    setDetailSession(null);
    setScheduleOpen(true);
  }

  const kpiTiles = [
    { label: t('today_sessions'), value: sessionStats.todayCount },
    { label: t('this_week'), value: sessionStats.weekCount },
    { label: t('filter_completed'), value: sessionStats.completedWeek },
    { label: t('avg_engagement'), value: sessionStats.avgEngagement != null ? `${sessionStats.avgEngagement}%` : '\u2014' },
  ];

  return (
    <div>
      {/* REGION 1 — Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-ink-primary">{t('sessions_title')}</h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeView === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface text-ink-secondary hover:bg-gray-50'
              }`}
              onClick={() => handleViewChange('list')}
            >
              {t('view_list')}
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeView === 'calendar'
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface text-ink-secondary hover:bg-gray-50'
              }`}
              onClick={() => handleViewChange('calendar')}
            >
              {t('view_calendar')}
            </button>
          </div>
          <Button onClick={() => setScheduleOpen(true)}>+ {t('schedule_session')}</Button>
        </div>
      </div>

      {/* REGION 2 — KPI Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      {/* REGION 3 — Filter Pills */}
      <div className="mb-5 flex gap-2 overflow-x-auto">
        <button
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !activeFilter
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-ink-secondary hover:bg-gray-200'
          }`}
          onClick={() => handleFilterChange(null)}
        >
          {t('filter_all')}
        </button>
        {statusFilters.map((status) => (
          <button
            key={status}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-ink-secondary hover:bg-gray-200'
            }`}
            onClick={() => handleFilterChange(status)}
          >
            {t(`filter_${status}`)}
          </button>
        ))}
      </div>

      {/* REGION 4 — List or Calendar view */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
      ) : activeView === 'calendar' ? (
        <SessionsCalendarView
          sessions={calendarSessions}
          weekStart={calendarWeekStart}
          onWeekChange={handleWeekChange}
          engagementMap={sessionStats.engagementMap}
          onSessionClick={(s) => setDetailSession(s as NonNullable<typeof sessions>[number])}
          onSchedule={() => setScheduleOpen(true)}
        />
      ) : groupedSessions.length === 0 && !activeFilter ? (
        <EmptyState
          icon="&#x1F4C5;"
          title={t('empty_sessions_title')}
          description={t('empty_sessions_desc')}
          action={{ label: t('schedule_session'), onClick: () => setScheduleOpen(true) }}
        />
      ) : groupedSessions.length === 0 && activeFilter ? (
        <EmptyState
          icon="&#x1F50D;"
          title={t('no_sessions_match_filter')}
          description={t('try_different_filter')}
          action={{ label: t('clear_filters_cta'), onClick: () => handleFilterChange(null) }}
        />
      ) : (
        <div className="space-y-6">
          {groupedSessions.map((group) => (
            <div key={group.key}>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.sessions.map((s) => {
                  const eng = sessionStats.engagementMap.get(s.id);
                  const actCount = getActivityCount(s);
                  const trialCount = getTrialCount(s);
                  const dur = getSessionDuration(s);

                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSessionClick(s)}
                      className="w-full text-left rounded-2xl border border-border bg-surface p-4 hover:border-primary-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <AvatarCircle name={s.child?.full_name ?? '?'} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="font-semibold text-ink-primary">{s.child?.full_name}</span>
                              <p className="text-sm text-ink-muted">{t('with_therapist', { name: s.therapist?.full_name })}</p>
                            </div>
                            <span className="shrink-0 text-sm text-ink-muted">
                              {formatSessionTime(s)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                            <span className={`font-medium ${statusColors[s.status]}`}>
                              {statusIcons[s.status]} {t(`filter_${s.status === 'no_show' ? 'cancelled' : s.status}`)}
                            </span>
                            <DisciplineBadge displayName={s.discipline?.display_name ?? null} />
                            {eng != null && (
                              <span className="text-ink-secondary">{eng}% {t('avg_engagement').toLowerCase()}</span>
                            )}
                            {actCount > 0 && (
                              <span className="text-ink-muted">
                                {actCount} {t('activities_label')} · {trialCount} {t('trials_label')}{dur ? ` · ${dur} ${t('minutes_short')}` : ''}
                              </span>
                            )}
                          </div>

                          {eng != null && (
                            <div className={`mt-2 h-1.5 w-full rounded-full ${engagementTone(eng)}`}>
                              <div
                                className={`h-full rounded-full ${engagementBarFg(eng)}`}
                                style={{ width: `${Math.min(eng, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule modal */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title={t('schedule_session')}>
        <div className="space-y-4">
          <Select
            label={t('child')}
            value={schedForm.child_id}
            onChange={(e) => {
              const cid = e.currentTarget.value;
              const c = children?.find((x) => x.id === cid);
              const tid = c?.primary_therapist_id ?? schedForm.therapist_id;
              setSchedForm({
                ...schedForm,
                child_id: cid,
                therapist_id: tid,
                discipline_id: tid ? disciplineForTherapist(tid) : schedForm.discipline_id,
              });
            }}
            placeholder={`-- ${t('child')} --`}
            options={children?.map((c) => ({ value: c.id, label: c.full_name })) ?? []}
          />
          <Input
            label={t('date')}
            type="date"
            value={schedForm.scheduled_date}
            onChange={(e) => setSchedForm({ ...schedForm, scheduled_date: e.currentTarget.value })}
          />
          <Select
            label={t('start_time')}
            value={schedForm.scheduled_time}
            onChange={(e) => setSchedForm({ ...schedForm, scheduled_time: e.currentTarget.value })}
            options={timeOptions}
          />
          <Select
            label={t('duration')}
            value={schedForm.duration_minutes}
            onChange={(e) => setSchedForm({ ...schedForm, duration_minutes: e.currentTarget.value })}
            options={durationOptions.map((d) => ({ value: d.value, label: t(d.label) }))}
          />
          <Select
            label={t('therapist')}
            value={schedForm.therapist_id}
            onChange={(e) => {
              const tid = e.currentTarget.value;
              setSchedForm({
                ...schedForm,
                therapist_id: tid,
                discipline_id: tid ? disciplineForTherapist(tid) : schedForm.discipline_id,
              });
            }}
            placeholder={`-- ${t('therapist')} --`}
            options={therapistOptions}
          />
          <Select
            label={t('discipline')}
            value={schedForm.discipline_id}
            onChange={(e) => setSchedForm({ ...schedForm, discipline_id: e.currentTarget.value })}
            options={(disciplines ?? []).map((d) => ({ value: d.id, label: d.display_name }))}
          />
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink-primary">
              <input
                type="checkbox"
                checked={schedForm.repeat_weekly}
                onChange={(e) => setSchedForm({ ...schedForm, repeat_weekly: e.target.checked })}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              {t('repeat_weekly')}
            </label>
            {schedForm.repeat_weekly && (
              <Input
                label={t('repeat_until')}
                type="date"
                value={schedForm.repeat_until}
                onChange={(e) => setSchedForm({ ...schedForm, repeat_until: e.currentTarget.value })}
                className="mt-3"
              />
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
              {t('modal_cancel')}
            </Button>
            <Button onClick={handleSchedule}>{t('schedule_session')}</Button>
          </div>
        </div>
      </Modal>

      {/* Session detail modal */}
      <Modal
        open={!!detailSession}
        onClose={() => setDetailSession(null)}
        title={t('session_detail')}
      >
        {detailSession && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-ink-secondary">{t('child')}</p>
                <p className="font-medium text-ink-primary">{detailSession.child?.full_name}</p>
              </div>
              <div>
                <p className="text-ink-secondary">{t('therapist')}</p>
                <p className="font-medium text-ink-primary">{detailSession.therapist?.full_name}</p>
              </div>
              <div>
                <p className="text-ink-secondary">{t('date')}</p>
                <p className="font-medium text-ink-primary">{format(new Date(detailSession.scheduled_date), 'PPP', { locale: dateLocale })}</p>
              </div>
              <div>
                <p className="text-ink-secondary">{t('time')}</p>
                <p className="font-medium text-ink-primary">
                  {formatTime(detailSession.scheduled_time) || '\u2014'}
                  {detailSession.duration_minutes ? ` \u00b7 ${t('duration_minutes', { minutes: detailSession.duration_minutes })}` : ''}
                </p>
              </div>
              <div>
                <p className="text-ink-secondary">{t('discipline')}</p>
                <p className="font-medium text-ink-primary">
                  <DisciplineBadge displayName={detailSession.discipline?.display_name ?? null} />
                </p>
              </div>
            </div>

            {detailSession.status === 'scheduled' && (
              <div className="flex gap-3 pt-2">
                <Button size="lg" className="flex-1" onClick={handleMarkPresent}>
                  {t('mark_present')}
                </Button>
                <Button size="lg" variant="secondary" className="flex-1" onClick={() => setAbsentOpen(true)}>
                  {t('mark_absent')}
                </Button>
              </div>
            )}

            {(detailSession.status === 'scheduled' || detailSession.status === 'in_progress') && (
              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => { setDetailSession(null); navigate(`/sessions/${detailSession.id}/run`); }}
                >
                  {t('start_session_btn')}
                </Button>
              </div>
            )}

            <div className="flex gap-3 border-t border-border pt-4">
              {detailSession.status === 'scheduled' && (
                <>
                  <Button variant="secondary" size="sm" onClick={handleReschedule}>
                    {t('reschedule')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                    {t('cancel_session')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel confirmation */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('cancel_session')}>
        <div className="space-y-4">
          <Textarea
            label={t('cancellation_reason')}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.currentTarget.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              {t('modal_cancel')}
            </Button>
            <Button variant="danger" onClick={handleCancel}>
              {t('modal_confirm')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Absent modal */}
      <Modal open={absentOpen} onClose={() => setAbsentOpen(false)} title={t('mark_absent')}>
        <div className="space-y-4">
          <Textarea
            label={t('no_show_reason')}
            value={absentReason}
            onChange={(e) => setAbsentReason(e.currentTarget.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAbsentOpen(false)}>
              {t('modal_cancel')}
            </Button>
            <Button variant="danger" onClick={handleMarkAbsent}>
              {t('modal_confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
