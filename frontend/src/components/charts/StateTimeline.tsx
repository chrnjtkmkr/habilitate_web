import { useTranslation } from 'react-i18next';

interface StateSegment {
  state: 'regulated' | 'amber' | 'dysregulated';
  durationSec: number;
}

const STATE_COLORS: Record<string, string> = {
  regulated: '#E8F5F0',
  amber: '#FEF3E2',
  dysregulated: '#FCEEF0',
};

const STATE_DOT_COLORS: Record<string, string> = {
  regulated: '#4ADE80',
  amber: '#FBBF24',
  dysregulated: '#FB7185',
};

export default function StateTimeline({ segments, totalSec }: { segments: StateSegment[]; totalSec: number }) {
  const { t } = useTranslation();

  if (segments.length === 0 || totalSec <= 0) {
    return <p className="text-[13px] text-[#8E8EA0]">{t('no_state_data')}</p>;
  }

  // Aggregate time per state
  const totals: Record<string, number> = { regulated: 0, amber: 0, dysregulated: 0 };
  for (const s of segments) totals[s.state] = (totals[s.state] ?? 0) + s.durationSec;

  return (
    <div>
      {/* Proportional bar */}
      <div className="flex rounded-lg overflow-hidden h-10">
        {segments.map((s, i) => {
          const pct = (s.durationSec / totalSec) * 100;
          if (pct < 0.5) return null;
          return (
            <div key={i} style={{ width: `${pct}%`, backgroundColor: STATE_COLORS[s.state] }}
              className="flex items-center justify-center transition-all" />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex gap-4 mt-3 justify-center">
        {(['regulated', 'amber', 'dysregulated'] as const).map((state) => {
          const pct = totalSec > 0 ? ((totals[state] ?? 0) / totalSec) * 100 : 0;
          return (
            <div key={state} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATE_DOT_COLORS[state] }} />
              <span className="text-[12px] font-medium" style={{ color: '#1B1B2E' }}>
                {t(`child_state_${state}`)} {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
