import { format } from 'date-fns';

// Produces human-readable relative timestamps for activity feeds and cards.
export function formatRelativeTime(
  date: Date | string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t('relative_just_now');
  if (diffMin < 60) return t('relative_minutes_ago', { n: diffMin });

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return t('relative_today_time', { time: format(d, 'HH:mm') });
  if (isYesterday) return t('relative_yesterday');
  if (diffDay < 30) return t('relative_days_ago', { n: diffDay });
  return format(d, 'MMM dd, yyyy');
}
