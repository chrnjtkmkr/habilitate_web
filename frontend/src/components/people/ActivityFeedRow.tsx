import { useTranslation } from 'react-i18next';
import type { RecentActivityEvent } from '../../lib/queries/recentActivity';
import { formatRelativeTime } from '../../lib/utils/relativeTime';

interface ActivityFeedRowProps {
  event: RecentActivityEvent;
}

export default function ActivityFeedRow({ event }: ActivityFeedRowProps) {
  const { t } = useTranslation();
  const time = formatRelativeTime(event.timestamp, t);

  if (event.type === 'session_completed') {
    return (
      <div className="flex items-center gap-3 py-2.5">
        <span className="w-2 h-2 shrink-0 rounded-full bg-success" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-primary truncate">
            <span className="font-medium">{event.child_name}</span>
            {' '}<span className="text-ink-secondary">{t('session_ended_event')}</span>
          </p>
          <p className="text-xs text-ink-muted">
            {event.trial_count > 0 && <span>{event.trial_count} trials</span>}
            {event.avg_engagement_pct !== null && <span> · {event.avg_engagement_pct}% eng.</span>}
          </p>
        </div>
        <span className="shrink-0 text-xs text-ink-muted">{time}</span>
      </div>
    );
  }

  if (event.type === 'report_sent') {
    return (
      <div className="flex items-center gap-3 py-2.5">
        <span className="w-2 h-2 shrink-0 rounded-full bg-primary-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-primary truncate">
            <span className="font-medium">{event.child_name}</span>
            {' '}<span className="text-ink-secondary">{t('report_sent_event')}</span>
          </p>
          <p className="text-xs text-ink-muted truncate">{event.period_label}</p>
        </div>
        <span className="shrink-0 text-xs text-ink-muted">{time}</span>
      </div>
    );
  }

  // intake_completed
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-2 h-2 shrink-0 rounded-full bg-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-primary truncate">
          <span className="font-medium">{event.child_name}</span>
          {' '}<span className="text-ink-secondary">{t('intake_completed_event')}</span>
        </p>
      </div>
      <span className="shrink-0 text-xs text-ink-muted">{time}</span>
    </div>
  );
}
