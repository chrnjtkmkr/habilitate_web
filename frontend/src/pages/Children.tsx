import { useState, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChildren } from '../lib/queries/children';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/states/EmptyState';
import ChildCard from '../components/people/ChildCard';

type FilterKey = 'all' | 'improving' | 'steady' | 'needs_attention' | 'intake_pending';

const filterKeys: FilterKey[] = ['all', 'improving', 'steady', 'needs_attention', 'intake_pending'];

const filterI18n: Record<FilterKey, string> = {
  all: 'filter_all',
  improving: 'pulse_trajectory_improving',
  steady: 'pulse_trajectory_steady',
  needs_attention: 'pulse_trajectory_needs_attention',
  intake_pending: 'filter_intake_pending',
};

export default function Children() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { memberships } = useAuth();
  const centerId = memberships[0]?.center_id;

  const trajectoryFilter = searchParams.get('trajectory') as FilterKey | null;
  const intakeFilter = searchParams.get('intake');
  const activeFilter: FilterKey =
    trajectoryFilter === 'improving' || trajectoryFilter === 'steady' || trajectoryFilter === 'needs_attention'
      ? trajectoryFilter
      : intakeFilter === 'pending'
        ? 'intake_pending'
        : 'all';

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const { data: allChildren, isLoading, isError, refetch } = useChildren(centerId, deferredSearch || undefined);

  function setFilter(key: FilterKey) {
    if (key === 'all') {
      setSearchParams({});
    } else if (key === 'intake_pending') {
      setSearchParams({ intake: 'pending' });
    } else {
      setSearchParams({ trajectory: key });
    }
  }

  const children = allChildren?.filter(c => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'intake_pending') return c.intake_status !== 'completed';
    return c.trajectory === activeFilter;
  });

  const emptyFromFilter = activeFilter !== 'all' && children?.length === 0 && (allChildren?.length ?? 0) > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-ink-primary">{t('children_title')}</h1>
        <Button onClick={() => navigate('/children/new')}>{t('add_child')}</Button>
      </div>

      {/* Search + Filter row */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative max-w-md flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t('search_children')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {filterKeys.map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={
                activeFilter === key
                  ? 'rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white'
                  : 'rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-secondary hover:bg-primary-50'
              }
            >
              {t(filterI18n[key])}
            </button>
          ))}
        </div>
      </div>

      {/* Child cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-ink-secondary">{t('error_loading_children')}</p>
          <button onClick={() => refetch()} className="mt-3 rounded-lg border border-border px-4 py-2 text-sm text-ink-primary hover:bg-primary-50">
            {t('retry')}
          </button>
        </div>
      ) : children?.length === 0 ? (
        emptyFromFilter ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-ink-secondary">{t('no_children_match_filter')}</p>
          </div>
        ) : (
          <EmptyState
            icon="&#x1F476;"
            title={t('empty_children_title')}
            description={t('empty_children_desc')}
            action={{ label: t('add_child'), onClick: () => navigate('/children/new') }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {children?.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              onClick={() => navigate(`/children/${child.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
