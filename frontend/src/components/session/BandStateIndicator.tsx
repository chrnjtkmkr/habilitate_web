import { useTranslation } from 'react-i18next';

import { BASELINE_MIN_SAMPLES } from '../../lib/childState/engine';
import { bandReading, type StateOverride } from '../../lib/childState/header';
import type { LiveChildState } from '../../hooks/useChildState';

// Under the header's state pills: where the shown state comes from
// (therapist override, the band, or an unvalidated band estimate), what
// the band reads under an override, why the band has no state when it
// has none, and in ?debug=1 the engine's signal breakdown.

const CLAIM_STYLE: Record<'regulated' | 'amber' | 'dysregulated', { dot: string; color: string; key: string }> = {
  regulated:    { dot: '#0D9F7E', color: '#0B7A61', key: 'child_state_regulated' },
  amber:        { dot: '#E0A100', color: '#9A6B00', key: 'child_state_amber' },
  dysregulated: { dot: '#D64545', color: '#B03434', key: 'child_state_dysregulated' },
};

function points(label: string, p: number | null, z: number | null) {
  if (p === null) return `${label} –`;
  return `${label} ${p}${z === null ? '' : ` (z ${z >= 0 ? '+' : ''}${z.toFixed(1)})`}`;
}

interface Props {
  /** null when no band is paired with this device. */
  live: LiveChildState | null;
  debug: boolean;
  override: StateOverride | null;
  onBackToAuto: () => void;
  disabled?: boolean;
}

export default function BandStateIndicator({ live, debug, override, onBackToAuto, disabled }: Props) {
  const { t } = useTranslation();
  const result = live?.result ?? null;
  const stale = live?.stale ?? true;
  const reading = bandReading(result, stale);

  // What the band says, when it is not driving the header.
  let bandText: string | null = null;
  let bandDot = '#B8B8C4';
  let bandColor = '#8E8EA0';
  if (live) {
    if (reading) {
      if (override) {
        const style = CLAIM_STYLE[reading.state];
        bandText = t(reading.validated ? 'band_state_reads' : 'band_state_reads_estimate', { state: t(style.key) });
        bandDot = style.dot;
        bandColor = style.color;
      }
    } else if (!result || stale) {
      bandText = `${t('band_state_label')}: ${t('band_state_no_data')}`;
    } else if (result.state === 'establishing') {
      bandText = `${t('band_state_label')}: ${t('band_state_establishing', {
        seconds: Math.min(result.baselineSeconds, BASELINE_MIN_SAMPLES),
        total: BASELINE_MIN_SAMPLES,
      })}`;
    } else {
      bandText = `${t('band_state_label')}: ${t('band_state_insufficient')}`;
    }
  }

  const time = override
    ? new Date(override.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="mt-1 flex flex-col items-center gap-0.5" aria-live="polite">
      {override ? (
        <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#5B4BC4' }}>
          {t('child_state_set_by_therapist', { time })}
          <button type="button" onClick={onBackToAuto} disabled={disabled}
            className="rounded-full px-2 text-[10px] font-semibold transition-colors hover:bg-[#E6E1FF] disabled:opacity-40"
            style={{ backgroundColor: '#F1EEFF', color: '#5B4BC4', height: 18 }}>
            {t('child_state_back_to_auto')}
          </button>
        </span>
      ) : reading?.validated ? (
        <span className="text-[11px] font-medium" style={{ color: '#8E8EA0' }}>{t('child_state_auto_from_band')}</span>
      ) : reading ? (
        <span className="rounded-full px-2 text-[10px] font-semibold" style={{ border: '1px dashed #9A6B00', color: '#9A6B00' }}>
          {t('child_state_estimate_tag')}
        </span>
      ) : !live ? (
        <span className="text-[11px] font-medium" style={{ color: '#8E8EA0' }}>{t('child_state_no_band_hint')}</span>
      ) : null}

      {(bandText || (reading && result?.flappingDetected)) && (
        <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: bandColor }}>
          {bandText && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: bandDot }} />}
          {bandText}
          {result && !stale && result.flappingDetected && (
            <span className="rounded-full px-1.5 text-[10px]" style={{ backgroundColor: '#F1EEFF', color: '#5B4BC4' }}>
              {t('band_state_flapping')}
            </span>
          )}
        </span>
      )}

      {debug && result && (
        <span className="text-[10px] font-mono" style={{ color: '#8E8EA0' }}>
          {t('band_state_debug_provisional')}: {result.provisional.state}
          {result.provisional.score !== null ? ` · score ${result.provisional.score}` : ''}
          {' · '}{points('GSR', result.contributions.gsr, result.deviations.gsr)}
          {' · '}{points('HRV', result.contributions.hrv, result.deviations.hrv)}
          {' · '}{points('motion', result.contributions.motion, result.deviations.motion)}
          {' · '}signals {result.validSignalCount}/3
          {' · '}baseline {result.baselineSeconds} s
          {live?.latencyMs != null ? ` · latency ${(live.latencyMs / 1000).toFixed(1)} s` : ''}
        </span>
      )}
    </div>
  );
}
