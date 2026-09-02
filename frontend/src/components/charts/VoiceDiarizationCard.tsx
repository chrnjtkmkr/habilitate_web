import { useMemo, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { computeVoiceMetrics } from '../../lib/utils/voiceMetrics';

interface Sample {
  voiceState: string | null;
  time: number;
}

interface VoiceDiarizationCardProps {
  samples: Sample[];
  durationSec: number;
}

const COLORS = {
  adult: 'hsl(260, 45%, 65%)',
  child: 'hsl(150, 45%, 60%)',
  silence: 'hsl(240, 10%, 88%)',
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceDiarizationCard({ samples, durationSec }: VoiceDiarizationCardProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(() => [...samples].sort((a, b) => a.time - b.time), [samples]);

  const metrics = useMemo(() => computeVoiceMetrics(samples), [samples]);

  // Check if we have any real voice data
  const hasVoiceData = sorted.some(s => s.voiceState === 'child_speaking' || s.voiceState === 'adult_speaking');

  if (sorted.length === 0 || !hasVoiceData) {
    return (
      <div className="text-center py-6">
        <p className="text-[13px]" style={{ color: '#8E8EA0' }}>{t('no_voice_activity')}</p>
      </div>
    );
  }

  const segCount = sorted.length;
  const barH = 24;
  const timeAxisH = 18;
  const svgH = barH + 6 + timeAxisH;
  const segW = width / segCount;
  const r = 4; // corner radius

  return (
    <div>
      {/* Timeline SVG */}
      <div ref={containerRef} className="w-full">
        <svg width={width} height={svgH} className="block w-full" style={{ overflow: 'visible' }}>
          {/* Rounded clip path for the whole bar */}
          <defs>
            <clipPath id="bar-clip">
              <rect x={0} y={0} width={width} height={barH} rx={r} ry={r} />
            </clipPath>
          </defs>

          {/* Background */}
          <rect x={0} y={0} width={width} height={barH} rx={r} ry={r} fill={COLORS.silence} />

          {/* Segments */}
          <g clipPath="url(#bar-clip)">
            {sorted.map((s, i) => {
              const vs = s.voiceState;
              const color = vs === 'child_speaking' ? COLORS.child
                : vs === 'adult_speaking' ? COLORS.adult
                : COLORS.silence;
              return (
                <rect
                  key={i}
                  x={i * segW}
                  y={0}
                  width={Math.ceil(segW) + 0.5}
                  height={barH}
                  fill={color}
                />
              );
            })}
          </g>

          {/* Time axis */}
          <text x={0} y={barH + 6 + 12} fill="#8E8EA0" fontSize={11} fontFamily="system-ui">
            0:00
          </text>
          <text x={width} y={barH + 6 + 12} fill="#8E8EA0" fontSize={11} fontFamily="system-ui" textAnchor="end">
            {formatDuration(durationSec)}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-5">
        <LegendItem color={COLORS.adult} label={t('adult_voice_legend')} pct={metrics.adultPct} />
        <LegendItem color={COLORS.child} label={t('child_voice_legend')} pct={metrics.childPct} />
        <LegendItem color={COLORS.silence} label={t('silence_legend')} pct={metrics.silencePct} />
      </div>

      {/* Turn-taking dynamics */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: '#EBEBF0' }}>
        <p className="mb-3" style={{ color: '#7A7A92', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>
          {t('turn_taking_dynamics')}
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <MetricRow label={t('therapist_to_child_transitions')} value={String(metrics.therapistToChildTransitions)} />
          <MetricRow label={t('longest_child_speech')} value={`${metrics.longestChildSpeechSec} ${t('seconds_short')}`} />
          <MetricRow label={t('child_to_therapist_transitions')} value={String(metrics.childToTherapistTransitions)} />
          <MetricRow label={t('longest_silence')} value={`${metrics.longestSilenceSec} ${t('seconds_short')}`} />
          <MetricRow label={t('total_voice_segments')} value={String(metrics.totalVoiceSegments)} />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px]" style={{ color: '#1B1B2E' }}>
      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label} {pct.toFixed(0)}%
    </span>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: '#5E5E7A' }}>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: '#1B1B2E' }}>{value}</span>
    </div>
  );
}
