import { useTranslation } from 'react-i18next';

import {
  BASELINE_MIN_SAMPLES,
  type ChildState,
} from '../../lib/childState/engine';
import type { LiveChildState } from '../../hooks/useChildState';

// The band's reading of the child's state, shown under the therapist's
// own state selector. It never replaces the therapist's choice.

const CLAIM_STYLE: Record<'regulated' | 'amber' | 'dysregulated', { dot: string; color: string; key: string }> = {
  regulated:    { dot: '#0D9F7E', color: '#0B7A61', key: 'child_state_regulated' },
  amber:        { dot: '#E0A100', color: '#9A6B00', key: 'child_state_amber' },
  dysregulated: { dot: '#D64545', color: '#B03434', key: 'child_state_dysregulated' },
};

const isClaim = (s: ChildState): s is 'regulated' | 'amber' | 'dysregulated' =>
  s === 'regulated' || s === 'amber' || s === 'dysregulated';

function points(label: string, p: number | null, z: number | null) {
  if (p === null) return `${label} –`;
  return `${label} ${p}${z === null ? '' : ` (z ${z >= 0 ? '+' : ''}${z.toFixed(1)})`}`;
}

export default function BandStateIndicator({ live, debug }: { live: LiveChildState; debug: boolean }) {
  const { t } = useTranslation();
  const { result, stale, latencyMs } = live;

  let text: string;
  let dot = '#B8B8C4';
  let color = '#8E8EA0';
  if (!result || stale) {
    text = t('band_state_no_data');
  } else if (result.state === 'establishing') {
    text = t('band_state_establishing', {
      seconds: Math.min(result.baselineSeconds, BASELINE_MIN_SAMPLES),
      total: BASELINE_MIN_SAMPLES,
    });
  } else if (isClaim(result.state)) {
    const style = CLAIM_STYLE[result.state];
    text = t(style.key);
    dot = style.dot;
    color = style.color;
  } else if (isClaim(result.provisional.state)) {
    // Enough valid signals to score, but thresholds are not signed off.
    text = t('band_state_withheld');
  } else {
    text = t('band_state_insufficient');
  }

  return (
    <div className="mt-1 flex flex-col items-center gap-0.5" aria-live="polite">
      <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
        {t('band_state_label')}: {text}
        {result && !stale && result.flappingDetected && (
          <span className="rounded-full px-1.5 text-[10px]" style={{ backgroundColor: '#F1EEFF', color: '#5B4BC4' }}>
            {t('band_state_flapping')}
          </span>
        )}
      </span>

      {debug && result && (
        <span className="text-[10px] font-mono" style={{ color: '#8E8EA0' }}>
          {t('band_state_debug_provisional')}: {result.provisional.state}
          {result.provisional.score !== null ? ` · score ${result.provisional.score}` : ''}
          {' · '}{points('GSR', result.contributions.gsr, result.deviations.gsr)}
          {' · '}{points('HRV', result.contributions.hrv, result.deviations.hrv)}
          {' · '}{points('motion', result.contributions.motion, result.deviations.motion)}
          {' · '}signals {result.validSignalCount}/3
          {' · '}baseline {result.baselineSeconds} s
          {latencyMs !== null ? ` · latency ${(latencyMs / 1000).toFixed(1)} s` : ''}
        </span>
      )}
    </div>
  );
}
