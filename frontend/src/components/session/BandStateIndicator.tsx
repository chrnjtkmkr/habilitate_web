import { useTranslation } from 'react-i18next';

import { BASELINE_MIN_SAMPLES } from '../../lib/childState/engine';
import { bandReading, type StateOverride } from '../../lib/childState/header';
import type { LiveChildState } from '../../hooks/useChildState';

// One fixed-height status row under the header's state pills, plus the
// ?debug=1 breakdown. The pills themselves carry the state: dashed for an
// unvalidated band estimate, solid for a therapist's selection. Neither
// the override nor what the band reads under it is spelled out here; both
// are still recorded in session_events.
//
// Rows have a fixed height and never widen the header column (w-0
// min-w-full), so a state change cannot move the rest of the page.

const ROW = 'h-4 w-0 min-w-full truncate text-center leading-4';

function points(label: string, p: number | null, z: number | null) {
  if (p === null) return `${label} –`;
  return `${label} ${p}${z === null ? '' : ` (z ${z >= 0 ? '+' : ''}${z.toFixed(1)})`}`;
}

interface Props {
  /** null when no band is paired with this device. */
  live: LiveChildState | null;
  debug: boolean;
  override: StateOverride | null;
}

export default function BandStateIndicator({ live, debug, override }: Props) {
  const { t } = useTranslation();
  const result = live?.result ?? null;
  const stale = live?.stale ?? true;
  const reading = bandReading(result, stale);

  let status: { text: string; tag?: boolean; dot?: boolean } | null = null;
  if (!live) {
    if (!override) status = { text: t('child_state_no_band_hint') };
  } else if (reading) {
    if (!override) {
      status = reading.validated
        ? { text: t('child_state_auto_from_band') }
        : { text: t('child_state_estimate_tag'), tag: true };
    }
  } else if (!result || stale) {
    status = { text: `${t('band_state_label')}: ${t('band_state_no_data')}`, dot: true };
  } else if (result.state === 'establishing') {
    status = {
      text: `${t('band_state_label')}: ${t('band_state_establishing', {
        seconds: Math.min(result.baselineSeconds, BASELINE_MIN_SAMPLES),
        total: BASELINE_MIN_SAMPLES,
      })}`,
      dot: true,
    };
  } else {
    status = { text: `${t('band_state_label')}: ${t('band_state_insufficient')}`, dot: true };
  }
  const flapping = !!result && !stale && result.flappingDetected;

  const debugText = debug && result
    ? `${t('band_state_debug_provisional')}: ${result.provisional.state}`
      + (result.provisional.score !== null ? ` · score ${result.provisional.score}` : '')
      + ` · ${points('GSR', result.contributions.gsr, result.deviations.gsr)}`
      + ` · ${points('HRV', result.contributions.hrv, result.deviations.hrv)}`
      + ` · ${points('motion', result.contributions.motion, result.deviations.motion)}`
      + ` · signals ${result.validSignalCount}/3`
      + ` · baseline ${result.baselineSeconds} s`
      + (live?.latencyMs != null ? ` · latency ${(live.latencyMs / 1000).toFixed(1)} s` : '')
    : '';

  return (
    <div className="mt-0.5 flex w-0 min-w-full flex-col items-center" aria-live="polite">
      <span className={`${ROW} text-[11px] font-medium`} style={{ color: '#8E8EA0' }}>
        {status?.dot && (
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: '#B8B8C4' }} />
        )}
        {status && (status.tag ? (
          <span className="rounded-full px-2 text-[10px] font-semibold"
            style={{ border: '1px dashed #9A6B00', color: '#9A6B00' }}>
            {status.text}
          </span>
        ) : status.text)}
        {flapping && (
          <span className="ml-1.5 rounded-full px-1.5 text-[10px]" style={{ backgroundColor: '#F1EEFF', color: '#5B4BC4' }}>
            {t('band_state_flapping')}
          </span>
        )}
      </span>

      {debug && (
        <span className={`${ROW} text-[10px] font-mono`} style={{ color: '#8E8EA0' }} title={debugText}>
          {debugText}
        </span>
      )}
    </div>
  );
}
