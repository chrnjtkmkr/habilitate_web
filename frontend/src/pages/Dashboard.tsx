import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { enUS, hi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useChildren } from '../lib/queries/children';
import { useRecentActivity } from '../lib/queries/recentActivity';
import ActivityFeedRow from '../components/people/ActivityFeedRow';
import WelcomeWizard from '../components/onboarding/WelcomeWizard';
import Skeleton from '../components/Skeleton';

interface TrajectoryChild {
  child_id: string | null;
  full_name: string | null;
  trajectory: string | null;
}

function useTrajectoryDetails(centerId: string | undefined) {
  return useQuery({
    queryKey: ['trajectory-details', centerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_pulse_clinical')
        .select('child_id, full_name, trajectory')
        .eq('center_id', centerId!);
      if (error) throw error;

      const buckets: Record<string, TrajectoryChild[]> = {
        improving: [],
        steady: [],
        needs_attention: [],
      };

      for (const row of (data ?? []) as TrajectoryChild[]) {
        const t = (row.trajectory as string) ?? 'steady';
        if (t in buckets) buckets[t].push(row);
        else buckets.steady.push(row);
      }

      return buckets;
    },
    enabled: !!centerId,
  });
}

const trajectoryConfig = {
  improving: {
    labelKey: 'pulse_trajectory_improving',
    bg: 'bg-[hsl(150,50%,95%)]',
    border: 'border-[hsl(150,50%,80%)]',
    hoverBorder: 'hover:border-[hsl(150,50%,60%)]',
    heroColor: 'text-[hsl(150,50%,28%)]',
    nameColor: 'text-[hsl(150,50%,35%)]',
  },
  steady: {
    labelKey: 'pulse_trajectory_steady',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    hoverBorder: 'hover:border-gray-400',
    heroColor: 'text-gray-600',
    nameColor: 'text-gray-500',
  },
  needs_attention: {
    labelKey: 'pulse_trajectory_needs_attention',
    bg: 'bg-[hsl(350,70%,97%)]',
    border: 'border-[hsl(350,70%,85%)]',
    hoverBorder: 'hover:border-[hsl(350,70%,60%)]',
    heroColor: 'text-[hsl(350,70%,40%)]',
    nameColor: 'text-[hsl(350,70%,45%)]',
  },
} as const;

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, memberships } = useAuth();
  const centerId = memberships[0]?.center_id;
  const dateLocale = i18n.language === 'hi' ? hi : enUS;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pulse-operational', centerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_pulse_operational')
        .select('active_children, sessions_this_week, retention_alerts_14d, therapists_active')
        .eq('center_id', centerId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const { data: trajectoryBuckets } = useTrajectoryDetails(centerId);
  const { data: recentEvents } = useRecentActivity(centerId);
  const { data: allChildren } = useChildren(centerId);

  // Onboarding wizard state
  const [wizardDismissed, setWizardDismissed] = useState(() => sessionStorage.getItem('habilitate-wizard-dismissed') === '1');

  const onboarding = useMemo(() => {
    const children = allChildren ?? [];
    const hasChild = children.length > 0;
    const hasIntake = children.some(c => c.intake_status === 'completed');
    const hasPlan = (data?.sessions_this_week ?? 0) > 0 || children.some(c => c.sessions_completed > 0 || c.active_goal_count > 0);
    const hasCompletedSession = children.some(c => c.sessions_completed > 0);
    const allDone = hasChild && hasIntake && hasPlan && hasCompletedSession;
    const firstChildId = children[0]?.id ?? null;
    return { hasChild, hasIntake, hasPlan, hasCompletedSession, allDone, firstChildId };
  }, [allChildren, data]);

  const ownerFirstName = (user?.user_metadata?.full_name as string ?? '').split(' ')[0] || '';

  function handleDismissWizard() {
    sessionStorage.setItem('habilitate-wizard-dismissed', '1');
    setWizardDismissed(true);
  }

  const kpiCards = [
    { labelKey: 'pulse_active_children', value: data?.active_children },
    { labelKey: 'pulse_sessions_this_week', value: data?.sessions_this_week },
    { labelKey: 'pulse_retention_alerts', value: data?.retention_alerts_14d },
    { labelKey: 'pulse_therapists_active', value: data?.therapists_active },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-primary">{t('pulse_title')}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {format(new Date(), 'PPP', { locale: dateLocale })}
        </p>
      </div>

      {/* Welcome wizard for new center owners */}
      {!onboarding.allDone && !wizardDismissed && !isLoading && (
        <WelcomeWizard
          firstName={ownerFirstName}
          firstChildId={onboarding.firstChildId}
          hasChild={onboarding.hasChild}
          hasIntake={onboarding.hasIntake}
          hasPlan={onboarding.hasPlan}
          hasCompletedSession={onboarding.hasCompletedSession}
          onDismiss={handleDismissWizard}
        />
      )}

      {isError && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-danger">{t('error_generic')}</p>
          <button
            onClick={() => refetch()}
            className="mt-3 rounded-lg border border-border px-4 py-2 text-ink-primary hover:bg-primary-50"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {!isError && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpiCards.map((card) => (
              <div
                key={card.labelKey}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                  {t(card.labelKey)}
                </p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-9 w-16" />
                ) : (
                  <p className="mt-2 text-[32px] font-bold leading-tight text-ink-primary">
                    {card.value ?? 0}
                  </p>
                )}
                {/* Placeholder bars for visual rhythm — real trends V2 */}
                <div className="mt-3 flex items-end gap-0.5 h-5">
                  {[40, 55, 45, 60, 50, 65, 55].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-sm bg-primary-200/60"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Trajectory Cards */}
          {trajectoryBuckets && (
            <div className="mt-6" data-tour="trajectory-section">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                {t('pulse_trajectory_title')}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(['improving', 'steady', 'needs_attention'] as const).map((key) => {
                  const cfg = trajectoryConfig[key];
                  const bucket = trajectoryBuckets[key] ?? [];
                  return (
                    <button
                      key={key}
                      onClick={() => navigate(`/children?trajectory=${key}`)}
                      className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5 text-left ${cfg.hoverBorder} transition-colors`}
                    >
                      <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                        {t(cfg.labelKey)}
                      </p>
                      <p className={`mt-1 text-[32px] font-bold leading-tight ${cfg.heroColor}`}>
                        {bucket.length}
                      </p>
                      <div className="mt-2 space-y-0.5">
                        {bucket.slice(0, 3).map((c) => (
                          <p key={c.child_id} className={`text-sm ${cfg.nameColor} truncate`}>
                            {c.full_name}
                          </p>
                        ))}
                        {bucket.length > 3 && (
                          <p className="text-xs text-ink-muted">
                            +{bucket.length - 3} more
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Activity Feed */}
          <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                {t('recent_activity')}
              </p>
              <button
                onClick={() => navigate('/sessions')}
                className="text-xs text-primary-600 hover:underline"
              >
                {t('view_all_sessions')}
              </button>
            </div>
            {recentEvents && recentEvents.length > 0 ? (
              <div className="divide-y divide-border">
                {recentEvents.map((event, i) => (
                  <ActivityFeedRow key={i} event={event} />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-ink-muted">{t('no_recent_activity')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
