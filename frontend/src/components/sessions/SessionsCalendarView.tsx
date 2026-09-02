import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, isSameDay, isToday as isTodayFn, parseISO } from 'date-fns';
import { enUS, hi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import AvatarCircle from '../people/AvatarCircle';
import Button from '../Button';

type SessionRow = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  child_id: string;
  therapist_id: string;
  child?: { full_name: string } | null;
  therapist?: { full_name: string } | null;
  duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
};

interface SessionsCalendarViewProps {
  sessions: SessionRow[];
  weekStart: Date;
  onWeekChange: (newStart: Date) => void;
  engagementMap: Map<string, number>;
  onSessionClick: (session: SessionRow) => void;
  onSchedule: () => void;
}

const statusIcons: Record<string, string> = {
  scheduled: '\u{1F4C5}',
  in_progress: '\u231B',
  completed: '\u2713',
  cancelled: '\u2298',
  no_show: '\u2298',
};

const statusCardColors: Record<string, string> = {
  scheduled: 'border-gray-200 bg-gray-50',
  in_progress: 'border-amber-200 bg-amber-50',
  completed: 'border-[hsl(150,40%,80%)] bg-[hsl(150,40%,95%)]',
  cancelled: 'border-[hsl(350,50%,85%)] bg-[hsl(350,50%,96%)]',
  no_show: 'border-gray-200 bg-gray-50',
};

const MAX_VISIBLE_PER_DAY = 4;

function formatTime(time: string | null) {
  if (!time) return '';
  return time.slice(0, 5);
}

export default function SessionsCalendarView({
  sessions,
  weekStart,
  onWeekChange,
  engagementMap,
  onSessionClick,
  onSchedule,
}: SessionsCalendarViewProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = i18n.language === 'hi' ? hi : enUS;

  // Build 7 days of the week (Mon-Sun)
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const weekEnd = weekDays[6];

  // Track which days are expanded to show all sessions
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  // Group sessions by day index (0-6)
  const sessionsByDay = useMemo(() => {
    const map = new Map<number, SessionRow[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);

    for (const s of sessions) {
      const d = parseISO(s.scheduled_date);
      for (let i = 0; i < 7; i++) {
        if (isSameDay(d, weekDays[i])) {
          map.get(i)!.push(s);
          break;
        }
      }
    }

    // Sort each day by time
    for (const [, daySessions] of map) {
      daySessions.sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));
    }

    return map;
  }, [sessions, weekDays]);

  const totalSessionsThisWeek = useMemo(() => {
    let count = 0;
    for (const [, daySessions] of sessionsByDay) count += daySessions.length;
    return count;
  }, [sessionsByDay]);

  const weekLabel = `${format(weekStart, 'MMM d', { locale: dateLocale })} \u2013 ${format(weekEnd, 'MMM d, yyyy', { locale: dateLocale })}`;

  function handleSessionCardClick(s: SessionRow) {
    if (s.status === 'completed') {
      navigate(`/sessions/${s.id}/summary`);
    } else {
      onSessionClick(s);
    }
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => onWeekChange(addDays(weekStart, -7))}
          className="rounded-lg p-2 text-ink-secondary hover:bg-gray-100"
          aria-label={t('previous_week')}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-ink-primary">{weekLabel}</span>
        <button
          onClick={() => onWeekChange(addDays(weekStart, 7))}
          className="rounded-lg p-2 text-ink-secondary hover:bg-gray-100"
          aria-label={t('next_week')}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {totalSessionsThisWeek === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-16">
          <p className="text-ink-secondary">{t('no_sessions_this_week')}</p>
          <Button className="mt-4" onClick={onSchedule}>+ {t('schedule_session')}</Button>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 rounded-2xl border border-border bg-surface p-2">
          {/* Day headers */}
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={`rounded-lg px-1 py-2 text-center text-xs font-semibold ${
                isTodayFn(day)
                  ? 'bg-[hsl(150,30%,93%)] text-[hsl(150,50%,28%)]'
                  : 'text-ink-secondary'
              }`}
            >
              <div>{format(day, 'EEE', { locale: dateLocale })}</div>
              <div className="mt-0.5 text-lg font-bold">{format(day, 'd')}</div>
            </div>
          ))}

          {/* Session columns */}
          {weekDays.map((day, dayIdx) => {
            const daySessions = sessionsByDay.get(dayIdx) ?? [];
            const isExpanded = expandedDays.has(dayIdx);
            const visibleSessions = isExpanded ? daySessions : daySessions.slice(0, MAX_VISIBLE_PER_DAY);
            const hiddenCount = daySessions.length - MAX_VISIBLE_PER_DAY;

            return (
              <div
                key={dayIdx}
                className={`min-h-[100px] rounded-lg p-1 ${
                  isTodayFn(day) ? 'bg-[hsl(150,30%,96%)]' : ''
                }`}
              >
                {visibleSessions.map((s) => {
                  const eng = engagementMap.get(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSessionCardClick(s)}
                      className={`mb-1 w-full rounded-lg border p-1.5 text-left transition-all hover:shadow-sm ${
                        statusCardColors[s.status] ?? 'border-border bg-surface'
                      }`}
                    >
                      <div className="text-[10px] font-medium text-ink-muted">
                        {formatTime(s.scheduled_time)}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <AvatarCircle name={s.child?.full_name ?? '?'} size="xs" />
                        <span className="truncate text-xs font-medium text-ink-primary">
                          {s.child?.full_name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px]">
                        <span>{statusIcons[s.status]}</span>
                        {eng != null && (
                          <span className="font-medium text-ink-secondary">{eng}%</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {!isExpanded && hiddenCount > 0 && (
                  <button
                    onClick={() => setExpandedDays(prev => new Set(prev).add(dayIdx))}
                    className="w-full rounded-lg py-1 text-center text-[10px] font-medium text-primary-600 hover:bg-primary-50"
                  >
                    {t('more_sessions', { count: hiddenCount })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
