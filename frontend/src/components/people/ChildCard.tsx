import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInMonths } from 'date-fns';
import type { ChildWithStats } from '../../lib/queries/children';
import { useChildEngagementHistory } from '../../lib/queries/childEngagement';
import { formatRelativeTime } from '../../lib/utils/relativeTime';
import AvatarCircle from './AvatarCircle';
import TrajectoryPill from './TrajectoryPill';
import MiniSparkline from '../charts/MiniSparkline';
import Pill from '../Pill';

const diagnosticKeys: Record<string, string> = {
  autism: 'diagnostic_autism',
  speech_delay: 'diagnostic_speech_delay',
  adhd: 'diagnostic_adhd',
};

interface ChildCardProps {
  child: ChildWithStats;
  onClick: () => void;
}

export default function ChildCard({ child, onClick }: ChildCardProps) {
  const { t } = useTranslation();
  const { data: engHistory } = useChildEngagementHistory(child.id);
  const sparkData = (engHistory ?? []).map(e => e.avg_engagement_pct).reverse();

  const { years, rem, lastSessionDaysAgo } = useMemo(() => {
    const now = new Date();
    const ms = differenceInMonths(now, new Date(child.date_of_birth));
    const daysAgo = child.last_session_date
      ? Math.floor((now.getTime() - new Date(child.last_session_date).getTime()) / 86_400_000)
      : null;
    return { years: Math.floor(ms / 12), rem: ms % 12, lastSessionDaysAgo: daysAgo };
  }, [child.date_of_birth, child.last_session_date]);

  const lastSessionColor =
    lastSessionDaysAgo === null ? 'text-ink-muted'
    : lastSessionDaysAgo > 14 ? 'text-danger'
    : lastSessionDaysAgo > 7 ? 'text-warning'
    : 'text-ink-secondary';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-surface p-4 hover:border-primary-300 hover:shadow-sm transition-all"
    >
      <div className="flex gap-3">
        <AvatarCircle name={child.full_name} size="md" />
        <div className="min-w-0 flex-1">
          {/* Row 1: name + trajectory */}
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink-primary">{child.full_name}</span>
            <TrajectoryPill trajectory={child.trajectory} />
          </div>

          {/* Row 2: age + diagnostic pills + descriptions */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-ink-secondary">{t('age_years', { years, months: rem })}</span>
            {child.diagnostic_profile?.map(d => (
              <Pill key={d}>{t(diagnosticKeys[d] ?? d)}</Pill>
            ))}
          </div>
          {child.diagnostic_profile && child.diagnostic_profile.length > 0 && (
            <p className="mt-0.5 text-[11px] text-ink-muted truncate">
              {child.diagnostic_profile.map(d => t(`diagnostic_desc_${d}`)).join(' · ')}
            </p>
          )}

          {/* Row 3: sparkline + last session */}
          <div className="mt-2 flex items-center gap-3">
            {sparkData.length >= 2 && <MiniSparkline data={sparkData} />}
            <span className={`text-xs ${lastSessionColor}`}>
              {child.last_session_date
                ? `${t('last_session')}: ${formatRelativeTime(child.last_session_date, t)}`
                : t('no_sessions_yet')}
            </span>
          </div>

          {/* Row 4: footer stats */}
          <div className="mt-2 flex items-center gap-4 text-xs text-ink-muted">
            <span>{child.active_goal_count} {t('active_goals')}</span>
            <span>{child.sessions_completed} {t('recent_sessions')}</span>
            {child.primary_therapist && (
              <span className="truncate">{(child.primary_therapist as { full_name: string }).full_name}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
