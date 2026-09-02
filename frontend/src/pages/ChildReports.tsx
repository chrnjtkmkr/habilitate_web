import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { format, previousMonday, previousSunday, type Locale } from 'date-fns';
import { enUS, hi } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import { useChild } from '../lib/queries/children';
import { useParentReports, useGenerateReport } from '../lib/queries/parentReports';
import { useParents } from '../lib/queries/parents';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Select from '../components/Select';
import Input from '../components/Input';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/states/EmptyState';
import { formatRelativeTime } from '../lib/utils/relativeTime';
import { useToast } from '../lib/toastStore';
import { openPdfFresh } from '../lib/reports/clientPdf';
import type { Database } from '../types/supabase';

type LanguageCode = Database['public']['Enums']['language_code'];
type ReportStatus = string;

const statusFilters: ReportStatus[] = ['draft', 'awaiting_approval', 'approved', 'sent'];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  awaiting_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-[hsl(150,50%,92%)] text-[hsl(150,50%,28%)]',
  sent: 'bg-[hsl(150,50%,92%)] text-[hsl(150,50%,28%)]',
};

const statusKeys: Record<string, string> = {
  draft: 'report_draft',
  awaiting_approval: 'report_pending_approval',
  approved: 'report_approved',
  sent: 'report_sent',
};

const periodTypeKeys: Record<string, string> = {
  monthly: 'monthly_report',
  weekly: 'weekly_report',
  custom: 'custom_report',
};

function getPeriodType(start: string, end: string): 'monthly' | 'weekly' | 'custom' {
  const s = new Date(start);
  const e = new Date(end);
  const diffDays = Math.round((e.getTime() - s.getTime()) / 86_400_000);
  if (diffDays >= 28 && diffDays <= 31) return 'monthly';
  if (diffDays >= 5 && diffDays <= 8) return 'weekly';
  return 'custom';
}

function getQuarterKey(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function formatPeriodTitle(start: string, locale: Locale): string {
  const s = new Date(start);
  return format(s, 'MMMM yyyy', { locale });
}

export default function ChildReports() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, memberships } = useAuth();
  const dateLocale = i18n.language === 'hi' ? hi : enUS;
  const { data: child, isLoading: childLoading, isError: childError } = useChild(id);
  const { data: reports, isLoading: reportsLoading } = useParentReports(id);
  const { data: parents } = useParents(id);
  const generateReport = useGenerateReport();
  const toast = useToast((s) => s.add);

  const centerId = memberships[0]?.center_id;

  const now = new Date();
  const lastMon = previousMonday(now);
  const lastSun = previousSunday(now);
  const defaultStart = lastMon <= lastSun ? format(lastMon, 'yyyy-MM-dd') : format(previousMonday(lastMon), 'yyyy-MM-dd');
  const defaultEnd = format(lastSun, 'yyyy-MM-dd');

  const primaryParent = parents?.find((p) => p.is_primary_contact) ?? parents?.[0];
  const defaultLang = primaryParent?.preferred_language ?? 'hi';

  const [modalOpen, setModalOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [language, setLanguage] = useState<LanguageCode>(defaultLang);
  const [activeFilter, setActiveFilter] = useState<ReportStatus | null>(null);

  // Compute stats
  const stats = useMemo(() => {
    if (!reports) return { total: 0, lastSent: null as string | null, thisQuarter: 0 };
    const total = reports.length;
    const sentReports = reports.filter(r => r.status === 'sent' && r.sent_at);
    const lastSent = sentReports.length > 0 ? sentReports[0].sent_at : null;

    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const thisQuarter = reports.filter(r => new Date(r.period_start) >= qStart).length;

    return { total, lastSent, thisQuarter };
  }, [reports]);

  // Filter reports
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    if (!activeFilter) return reports;
    return reports.filter(r => r.status === activeFilter);
  }, [reports, activeFilter]);

  // Group by quarter
  const groupedReports = useMemo(() => {
    const groups = new Map<string, typeof filteredReports>();
    for (const r of filteredReports) {
      const key = getQuarterKey(r.period_start);
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [filteredReports]);

  async function handleGenerate() {
    if (!id || !centerId || !user) return;
    try {
      const reportId = await generateReport.mutateAsync({
        childId: id,
        centerId,
        periodStart,
        periodEnd,
        language,
        actorId: user.id,
      });
      setModalOpen(false);
      navigate(`/children/${id}/reports/${reportId}`);
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  if (childLoading || reportsLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;
  }

  if (childError || !child) {
    return <div className="rounded-2xl border border-border bg-surface p-8 text-center"><p className="text-ink-secondary">{t('error_generic')}</p></div>;
  }

  const kpiTiles = [
    { label: t('total_reports'), value: stats.total },
    { label: t('last_sent'), value: stats.lastSent ? formatRelativeTime(stats.lastSent, t) : '\u2014' },
    { label: t('this_quarter'), value: stats.thisQuarter },
  ];

  return (
    <div>
      {/* REGION 1 — Header */}
      <div className="mb-5" style={{ minHeight: 80 }}>
        <button
          onClick={() => navigate(`/children/${id}`)}
          className="mb-2 flex items-center gap-1 text-sm text-primary-600 hover:underline"
        >
          <span aria-hidden="true">&larr;</span> {t('back')}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">
              {t('reports_for', { child: child?.full_name })}
            </h1>
          </div>
          <Button onClick={() => setModalOpen(true)}>+ {t('generate_new_report')}</Button>
        </div>
      </div>

      {/* REGION 2 — KPI Tiles */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {kpiTiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
              {tile.label}
            </p>
            <p className="mt-1.5 font-manrope text-2xl font-bold leading-tight text-ink-primary">
              {tile.value}
            </p>
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
          onClick={() => setActiveFilter(null)}
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
            onClick={() => setActiveFilter(activeFilter === status ? null : status)}
          >
            {t(statusKeys[status] ?? status)}
          </button>
        ))}
      </div>

      {/* REGION 4 — Quarter-grouped reports */}
      {groupedReports.length === 0 && !activeFilter ? (
        <EmptyState
          icon="&#x1F4CB;"
          title={t('empty_reports_title')}
          description={t('empty_reports_desc')}
        />
      ) : groupedReports.length === 0 && activeFilter ? (
        <EmptyState
          icon="&#x1F50D;"
          title={t('no_reports_match_filter')}
          description={t('try_different_filter')}
          action={{ label: t('clear_filters_cta'), onClick: () => setActiveFilter(null) }}
        />
      ) : (
        <div className="space-y-6">
          {groupedReports.map(([quarter, qReports]) => (
            <div key={quarter}>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                {quarter}
              </p>
              <div className="space-y-2">
                {qReports.map((r) => {
                  const periodType = getPeriodType(r.period_start, r.period_end);
                  const periodTitle = formatPeriodTitle(r.period_start, dateLocale);
                  const periodRange = `${format(new Date(r.period_start), 'MMM d', { locale: dateLocale })} - ${format(new Date(r.period_end), 'MMM d', { locale: dateLocale })}`;

                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(`/children/${id}/reports/${r.id}`)}
                      className="w-full text-left rounded-2xl border border-border bg-surface p-4 hover:border-primary-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink-primary text-lg">{periodTitle}</span>
                            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-ink-secondary">
                              {t(periodTypeKeys[periodType])}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-ink-muted">{periodRange}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {t(statusKeys[r.status] ?? r.status)}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-ink-secondary">
                          {r.language === 'hi' ? 'HI' : 'EN'}
                        </span>
                        {r.status === 'sent' && r.sent_at && primaryParent && (
                          <span className="text-xs text-ink-muted">
                            {t('sent_to', { name: primaryParent.full_name })} · {formatRelativeTime(r.sent_at, t)}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        {r.pdf_url && (
                          <span
                            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPdfFresh({ centerId: r.center_id, childId: r.child_id, reportId: r.id })
                                .catch(() => toast(t('pdf_link_expired'), 'error'));
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            {t('download_pdf')}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate report modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('generate_new_report')}>
        <div className="space-y-4">
          <Input
            label={t('report_period_start')}
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.currentTarget.value)}
          />
          <Input
            label={t('report_period_end')}
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.currentTarget.value)}
          />
          <Select
            label={t('report_language')}
            value={language}
            onChange={(e) => setLanguage(e.currentTarget.value as LanguageCode)}
            options={[
              { value: 'hi', label: t('lang_hi') },
              { value: 'en', label: t('lang_en') },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('modal_cancel')}
            </Button>
            <Button onClick={handleGenerate} disabled={generateReport.isPending}>
              {generateReport.isPending ? t('loading') : t('generate_new_report')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
