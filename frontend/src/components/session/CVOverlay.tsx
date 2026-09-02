import type { CVMetrics } from '../../cv/CVPipeline';

interface CVOverlayProps {
  metrics: CVMetrics | null;
  cameraActive: boolean;
}

export default function CVOverlay({ metrics, cameraActive }: CVOverlayProps) {
  if (!cameraActive) return null;

  const gazeActive = metrics?.social_gaze_active ?? false;
  const gazeTime = metrics?.social_gaze_total_sec ?? 0;
  const gazePct = metrics?.social_gaze_percentage ?? 0;
  const gazeEvents = metrics?.social_gaze_events ?? 0;
  const childSounds = metrics?.total_child_sounds ?? 0;
  const handActive = metrics?.hand_active ?? false;
  const gesture = metrics?.current_gesture ?? 'none';

  const engagementColor =
    gazePct >= 60 ? '#0D9F7E' : gazePct >= 30 ? '#D97706' : '#D85A30';

  const gestureLabel = gesture !== 'none' && gesture !== 'resting' ? gesture : '';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-black/60 rounded-lg text-white text-xs">
      {/* Social gaze */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: gazeActive ? '#0D9F7E' : '#9C9C95' }}
        />
        <span>Social Gaze {gazeTime.toFixed(1)}s ({gazeEvents}x)</span>
      </div>

      {/* Child sounds */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            metrics?.voice_state === 'child_speaking' ? 'animate-pulse' : ''
          }`}
          style={{
            backgroundColor:
              metrics?.voice_state === 'child_speaking'
                ? '#0D9F7E'
                : metrics?.voice_state === 'adult_speaking'
                  ? '#3730A3'
                  : '#9C9C95',
          }}
        />
        <span>Sounds: {childSounds}</span>
      </div>

      {/* Hand */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: handActive ? '#0D9F7E' : '#9C9C95' }}
        />
        <span>{gestureLabel || 'Hand'}</span>
      </div>

      {/* Engagement bar */}
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, gazePct)}%`,
              backgroundColor: engagementColor,
            }}
          />
        </div>
        <span style={{ color: engagementColor }}>{gazePct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
