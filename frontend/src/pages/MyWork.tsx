import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format, differenceInMonths } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useMyWork, useMyMoments, buildShareText, buildMomentSentence } from '../lib/queries/myWork';
import type { Moment, MyWorkData } from '../lib/queries/myWork';
import { useMyProfile } from '../lib/queries/profile';
import { useToast } from '../lib/toastStore';
import Skeleton from '../components/Skeleton';

const INITIAL_MOMENTS = 5;
const ROTATION_INTERVAL = 6000;

// Build the set of factual insights from this therapist's data.
// Each insight has a condition — it only appears when the data supports it.
function buildInsights(
  data: MyWorkData,
  moments: Moment[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): string[] {
  const insights: string[] = [];

  // How many months they have been doing this
  if (data.sinceDate) {
    const months = differenceInMonths(new Date(), new Date(data.sinceDate));
    if (months >= 2) {
      insights.push(t('insight_months', { months }));
    }
  }

  // How many firsts (milestones) happened in their sessions
  const firsts = moments.filter(m => m.kind === 'milestone');
  if (firsts.length >= 2) {
    const firstChildren = new Set(firsts.map(m => m.childName));
    insights.push(t('insight_firsts', { firsts: firsts.length, children: firstChildren.size }));
  }

  // How recently the last moment happened
  if (moments.length > 0) {
    const latest = moments[0]; // sorted newest first
    const daysAgo = Math.round((Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo <= 14) {
      insights.push(t('insight_recent_moment', { child: latest.childName, days: daysAgo }));
    }
  }

  // Notes shared with care teams
  if (data.noteCount >= 3) {
    insights.push(t('insight_notes_shared', { notes: data.noteCount }));
  }

  // Records broken (personal bests) as distinct from firsts
  const records = moments.filter(m => m.kind === 'personal_best');
  if (records.length >= 3) {
    insights.push(t('insight_records', { records: records.length }));
  }

  return insights;
}

export default function MyWork() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useMyWork(user?.id);
  const { data: moments } = useMyMoments(user?.id);
  const { data: profile } = useMyProfile(user?.id);
  const toast = useToast((s) => s.add);
  const [showAll, setShowAll] = useState(false);

  // Rotating insights
  const insights = useMemo(
    () => (data && moments ? buildInsights(data, moments, t) : []),
    [data, moments, t],
  );
  const [insightIndex, setInsightIndex] = useState(0);
  const [insightVisible, setInsightVisible] = useState(true);

  // Detect prefers-reduced-motion once on mount
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  // Rotation effect: only runs when 2+ insights and motion is allowed.
  // Captures the current insights count via a closure over the dep value.
  // Cleans up both the interval and any pending fade timeout.
  useEffect(() => {
    if (insights.length <= 1 || prefersReducedMotion) return;

    const count = insights.length;
    let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

    const id = setInterval(() => {
      setInsightVisible(false);
      fadeTimeout = setTimeout(() => {
        setInsightIndex(prev => (prev + 1) % count);
        setInsightVisible(true);
      }, 400);
    }, ROTATION_INTERVAL);

    return () => {
      clearInterval(id);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, [insights.length, prefersReducedMotion]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const hasWork = data && data.sessionCount > 0;
  const sinceLabel = data?.sinceDate
    ? format(new Date(data.sinceDate), 'MMMM yyyy')
    : '';

  async function handleShare() {
    if (!data) return;
    const text = buildShareText(
      data.totalHours,
      data.childCount,
      data.noteCount,
      data.disciplines,
      sinceLabel,
      i18n.language,
    );
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast(t('my_work_copied'), 'success');
    }
  }

  const allMoments = moments ?? [];
  const visibleMoments = showAll ? allMoments : allMoments.slice(0, INITIAL_MOMENTS);
  const hasMore = allMoments.length > INITIAL_MOMENTS;

  // The insight line to display
  const insightLine = insights.length > 0
    ? insights[insightIndex % insights.length]
    : (hasWork ? t('insight_fallback', { months: data?.sinceDate ? differenceInMonths(new Date(), new Date(data.sinceDate)) : 0 }) : '');

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink-primary">{t('my_work_title')}</h1>
        {profile && (
          <p className="mt-1 text-[13px] text-ink-secondary">
            {profile.full_name}{profile.discipline_name ? ` \u00b7 ${profile.discipline_name}` : ''}
            {hasWork && sinceLabel ? ` \u00b7 ${t('my_work_since_inline', { date: sinceLabel })}` : ''}
          </p>
        )}
      </div>

      {!hasWork ? (
        <div className="rounded-2xl border border-border bg-surface px-6 py-16 text-center">
          <h3 className="text-lg font-semibold text-ink-primary">{t('my_work_empty_title')}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-secondary">{t('my_work_empty_desc')}</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── MOVEMENT 1: PRESENCE ── */}
          <div className="rounded-2xl border border-border bg-surface">
            <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:gap-8">
              {/* Left: stat tiles — fixed width, vertically centred against right content */}
              <div className="grid grid-cols-2 gap-4 lg:w-[280px] lg:shrink-0">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                    {t('my_work_hours_label')}
                  </p>
                  <p className="mt-1 text-[48px] font-bold leading-none text-primary-600">
                    {data.totalHours}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                    {t('my_work_children_label')}
                  </p>
                  <p className="mt-1 text-[48px] font-bold leading-none text-ink-primary">
                    {data.childCount}
                  </p>
                </div>
              </div>

              {/* Right: insight + metadata */}
              <div className="flex-1 min-w-0">
                {insightLine && (
                  <p
                    className="text-[17px] leading-relaxed text-ink-secondary"
                    style={{
                      fontFamily: 'Fraunces, serif',
                      opacity: insightVisible ? 1 : 0,
                      transition: prefersReducedMotion ? 'none' : 'opacity 0.4s ease',
                      minHeight: '1.6em',
                    }}
                  >
                    {insightLine}
                  </p>
                )}

                {data.disciplines.length > 0 && (
                  <p className="mt-3 text-sm text-ink-muted">{data.disciplines.join(' \u00b7 ')}</p>
                )}

                {data.noteCount > 0 && (
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('my_work_notes', { count: data.noteCount })}
                  </p>
                )}
              </div>
            </div>

            {/* Share — spans full card width, separated by border */}
            <div className="border-t border-border px-5 py-3">
              <button
                onClick={handleShare}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted hover:bg-primary-50 hover:text-ink-primary"
              >
                {t('my_work_share')}
              </button>
            </div>
          </div>

          {/* ── MOVEMENT 2: THE MOMENTS ── */}
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-ink-muted">
              {t('my_work_moments_heading')}
            </p>

            {allMoments.length > 0 ? (
              <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
                {visibleMoments.map((m, i) => (
                  <div key={`${m.kind}-${m.date}-${i}`} className="px-4 py-3">
                    <p className="text-[14px] leading-relaxed text-ink-primary">
                      {buildMomentSentence(m, t)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {format(new Date(m.date), 'd MMMM yyyy')}
                    </p>
                  </div>
                ))}
                {hasMore && (
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full px-4 py-2.5 text-sm text-primary-600 hover:bg-primary-50"
                  >
                    {showAll
                      ? t('my_work_show_less')
                      : t('my_work_show_all', { count: allMoments.length })}
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface px-5 py-6 text-center">
                <p className="text-sm text-ink-secondary">{t('my_work_moments_empty')}</p>
              </div>
            )}
          </div>

          {/* ── MOVEMENT 3: THE CHILDREN ── */}
          {data.children.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                {t('my_work_children_heading')}
              </p>
              <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
                {data.children.map((child) => (
                  <Link
                    key={child.id}
                    to={`/children/${child.id}`}
                    className="flex items-center px-4 py-3 text-sm text-ink-primary hover:bg-primary-50"
                  >
                    {child.full_name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
