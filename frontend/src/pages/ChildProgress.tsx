import { useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { useChild } from '../lib/queries/children';
import { useAuth } from '../hooks/useAuth';
import { useMilestones, useBaselines, useAllAttributes } from '../lib/queries/progress';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';

const BRAND = '#6260D6';

interface AttributeData {
  attributeId: string;
  parentLabel: string;
  sortOrder: number;
  milestones: Record<string, { achievedAt: string; probeId: string | null }>;
  periodLookedCount: number;
  periodProbeCount: number;
  baselineValue: number | null;
  baselineWindow: string | null;
}

export default function ChildProgress() {
  const { t } = useTranslation();
  const { id: childId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { memberships } = useAuth();
  const centerName = (memberships[0] as Record<string, unknown>)?.centers
    ? ((memberships[0] as Record<string, unknown>).centers as Record<string, string>)?.name ?? ''
    : '';

  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Date range: default last 7 days → today
  const [periodEnd, setPeriodEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [periodStart, setPeriodStart] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));

  const { data: child, isLoading: childLoading } = useChild(childId);
  // Milestones are ALL-TIME (a "first" is a first regardless of window)
  const { data: milestones } = useMilestones(childId);
  // Totals for the selected date range only
  // Clinical record only — baselines are NOT rendered on the parent report (can regress)
  const { data: baselines } = useBaselines(childId);
  const { data: attributes } = useAllAttributes();

  // Build per-attribute data, filtered to those with real data
  const attrData = useMemo(() => {
    if (!attributes || !milestones) return [];

    const attrMap = new Map<string, AttributeData>();
    for (const a of attributes) {
      attrMap.set(a.id, {
        attributeId: a.id,
        parentLabel: a.parent_label,
        sortOrder: a.sort_order ?? 999,
        milestones: {},
        periodLookedCount: 0,
        periodProbeCount: 0,
        baselineValue: null,
        baselineWindow: null,
      });
    }

    for (const m of milestones) {
      const entry = attrMap.get(m.attribute_id);
      if (entry) {
        entry.milestones[m.milestone_key] = { achievedAt: m.achieved_at, probeId: m.probe_id };
      }
    }

    for (const b of baselines ?? []) {
      const entry = attrMap.get(b.attribute_id);
      if (entry) {
        entry.baselineValue = b.baseline_value;
        entry.baselineWindow = b.baseline_window;
      }
    }

    // Show attributes with a milestone OR period data
    return [...attrMap.values()]
      .filter((a) => Object.keys(a.milestones).length > 0 || a.periodProbeCount > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [attributes, milestones, baselines]);

  const childName = child?.full_name?.split(' ')[0] ?? '';

  const dateRangeLabel = useMemo(() => {
    const s = new Date(periodStart + 'T00:00:00');
    const e = new Date(periodEnd + 'T00:00:00');
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${format(s, 'd')}–${format(e, 'd MMMM yyyy')}`;
    }
    return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`;
  }, [periodStart, periodEnd]);

  // PDF: capture the visible report body (same visual, zero drift)
  const handleDownloadPdf = useCallback(async () => {
    const el = printRef.current;
    if (!el || downloading) return;
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const filename = `progress-${childName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

      // Save original styles
      const origWidth = el.style.width;
      const origMaxWidth = el.style.maxWidth;
      const origPadding = el.style.padding;
      const origBg = el.style.backgroundColor;

      // Temporarily style for A4 capture
      el.style.width = '210mm';
      el.style.maxWidth = '210mm';
      el.style.padding = '18mm 20mm';
      el.style.backgroundColor = '#FFFFFF';

      const pdfBlob: Blob = await html2pdf()
        .set({
          margin: [0, 0, 0, 0],
          filename,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .outputPdf('blob');

      // Restore styles
      el.style.width = origWidth;
      el.style.maxWidth = origMaxWidth;
      el.style.padding = origPadding;
      el.style.backgroundColor = origBg;

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [childName, downloading]);

  if (childLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F8FC' }}>
        <Skeleton className="h-60 w-96" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F8FC' }}>
        <p style={{ color: '#8E8EA0' }}>{t('error_generic')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F8FC' }}>
      {/* Nav header — NOT captured in PDF */}
      <header className="flex items-center px-6 shrink-0 gap-4" style={{ height: 60, backgroundColor: '#FEFEFE', borderBottom: '1px solid #EBEBF0' }}>
        <button onClick={() => navigate(-1)} className="text-[14px]" style={{ color: '#5E5E7A' }}>
          ← {t('back')}
        </button>
        <div className="flex-1 text-center">
          <span className="text-[16px] font-semibold" style={{ color: '#1B1B2E' }}>{t('progress_title')}</span>
        </div>
        <span className="text-[13px]" style={{ color: '#8E8EA0' }}>{child.full_name}</span>
      </header>

      {/* Date range picker — NOT captured in PDF */}
      <div className="mx-auto max-w-[640px] px-5 pt-5 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-[13px]" style={{ color: '#5E5E7A' }}>
            {t('progress_period_from')}
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border px-2 py-1 text-[13px]"
              style={{ borderColor: '#EBEBF0' }}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[13px]" style={{ color: '#5E5E7A' }}>
            {t('progress_period_to')}
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border px-2 py-1 text-[13px]"
              style={{ borderColor: '#EBEBF0' }}
            />
          </label>
        </div>
      </div>

      {/* ===== PRINTABLE REPORT BODY — this is what the PDF captures ===== */}
      <div ref={printRef} className="mx-auto max-w-[640px] px-5 py-4 space-y-5" style={{ backgroundColor: '#F8F8FC' }}>

        {/* Masthead: logo + center + child + date range */}
        <div className="flex items-center gap-4 pb-2">
          <img src="/logo.png" alt="" className="rounded-xl" style={{ width: 44, height: 44 }} />
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold" style={{ color: BRAND }}>{centerName}</p>
            <p className="text-[12px] mt-0.5" style={{ color: '#8E8EA0' }}>
              {child.full_name} · {dateRangeLabel}
            </p>
          </div>
        </div>

        {attrData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[15px]" style={{ color: '#8E8EA0' }}>{t('progress_empty')}</p>
          </div>
        )}

        {attrData.map((attr) => (
          <AttributeCard key={attr.attributeId} attr={attr} t={t} />
        ))}

        {/* Honesty line */}
        {attrData.length > 0 && (
          <p className="text-center text-[13px] pt-4 pb-2" style={{ color: '#A0A0B0', fontStyle: 'italic' }}>
            {t('progress_honesty', { name: childName })}
          </p>
        )}
      </div>
      {/* ===== END PRINTABLE BODY ===== */}

      {/* Download button — NOT captured in PDF */}
      {attrData.length > 0 && (
        <div className="flex justify-center pb-8">
          <Button onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? t('progress_pdf_generating') : t('progress_pdf_download')}
          </Button>
        </div>
      )}
    </div>
  );
}

function AttributeCard({ attr, t }: { attr: AttributeData; t: (k: string, opts?: Record<string, unknown>) => string }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFF', border: '1px solid #EBEBF0', boxShadow: '0 1px 3px rgba(230,230,235,0.4)' }}>
      <p className="text-[11px] font-semibold tracking-wider uppercase mb-3" style={{ color: BRAND }}>{attr.parentLabel}</p>
      <p className="text-[15px]" style={{ color: '#1B1B2E' }}>
        {t('progress_generic_total', { count: attr.periodLookedCount, total: attr.periodProbeCount })}
      </p>
    </div>
  );
}
