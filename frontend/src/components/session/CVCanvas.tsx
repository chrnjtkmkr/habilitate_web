/**
 * CVCanvas -- draws full face mesh, hand skeleton, gaze arrows,
 * face state banner, and gesture labels on camera overlay.
 *
 * Color coding:
 * - Green (#0D9F7E): social gaze (looking at facilitator)
 * - Yellow (#D97706): looking at toys/table
 * - Red (#D85A30): looking away / no face
 */

import { useRef, useEffect } from 'react';
import type { CVMetrics } from '../../cv/CVPipeline';

interface CVCanvasProps {
  metrics: CVMetrics | null;
  width: number;
  height: number;
}

const STATE_COLORS: Record<string, string> = {
  social_gaze: '#0D9F7E',
  looking_at_toys: '#F59E0B',
  head_down: '#D85A30',
  looking_away: '#D85A30',
  not_visible: '#9C9C95',
  no_face: '#9C9C95',
};

const FACE_STATE_LABELS: Record<string, { label: string; icon: string }> = {
  social_gaze: { label: 'LOOKING AT FACILITATOR', icon: '' },
  looking_at_toys: { label: 'LOOKING AT TOYS', icon: '' },
  head_down: { label: 'HEAD DOWN', icon: '' },
  looking_away: { label: 'LOOKING AWAY', icon: '' },
  not_visible: { label: 'CHILD NOT VISIBLE', icon: '' },
  no_face: { label: 'CHILD NOT VISIBLE', icon: '' },
};

const GESTURE_LABELS: Record<string, { label: string; icon: string }> = {
  pincer_grasp: { label: 'PINCH GRIP', icon: '' },
  power_grasp: { label: 'POWER GRIP', icon: '' },
  pointing: { label: 'POINTING', icon: '' },
  open: { label: 'OPEN HAND', icon: '' },
  closed_fist: { label: 'FIST', icon: '' },
  waving: { label: 'WAVING', icon: '' },
  reaching: { label: 'REACHING', icon: '' },
  grasping: { label: 'GRASPING', icon: '' },
  resting: { label: '', icon: '' },
  none: { label: '', icon: '' },
};

// Face mesh connections for drawing the grid
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109, 10,
];
const LEFT_EYE = [33, 160, 158, 133, 153, 144, 163, 7, 33];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380, 381, 249, 362];
const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4, 1];
const MOUTH_OUTER = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0,
  37, 39, 40, 185, 61,
];
const LEFT_EYEBROW = [70, 63, 105, 66, 107];
const RIGHT_EYEBROW = [300, 293, 334, 296, 336];

// Hand skeleton connections
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

function drawLandmarkPath(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<{ x: number; y: number }>,
  indices: number[],
  w: number,
  h: number,
  color: string,
  lineWidth: number = 1
) {
  if (indices.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  const first = landmarks[indices[0]];
  if (!first) return;
  ctx.moveTo(first.x * w, first.y * h);
  for (let i = 1; i < indices.length; i++) {
    const lm = landmarks[indices[i]];
    if (lm) ctx.lineTo(lm.x * w, lm.y * h);
  }
  ctx.stroke();
}

export default function CVCanvas({ metrics, width, height }: CVCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !metrics) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const faceColor = STATE_COLORS[metrics.face_state] || '#9C9C95';
    const meshAlpha = metrics.face_state === 'social_gaze' ? '90' : '70';

    // === FACE MESH ===
    if (metrics.face_landmarks && metrics.face_landmarks.length >= 468) {
      const lms = metrics.face_landmarks;
      const meshColor = faceColor + meshAlpha;

      // Draw face mesh grid lines
      drawLandmarkPath(ctx, lms, FACE_OVAL, width, height, meshColor, 1.5);
      drawLandmarkPath(ctx, lms, LEFT_EYE, width, height, meshColor, 1.5);
      drawLandmarkPath(ctx, lms, RIGHT_EYE, width, height, meshColor, 1.5);
      drawLandmarkPath(ctx, lms, NOSE_BRIDGE, width, height, meshColor, 1);
      drawLandmarkPath(ctx, lms, MOUTH_OUTER, width, height, meshColor, 1.5);
      drawLandmarkPath(ctx, lms, LEFT_EYEBROW, width, height, meshColor, 1);
      drawLandmarkPath(ctx, lms, RIGHT_EYEBROW, width, height, meshColor, 1);

      // Draw key landmark dots (larger at this scale)
      const keyIndices = [
        1, 4, 5, 6, 10, 33, 61, 133, 152, 159, 168, 195, 234, 263, 291, 362,
        386, 454,
      ];
      ctx.fillStyle = faceColor;
      for (const idx of keyIndices) {
        const lm = lms[idx];
        if (lm) {
          ctx.beginPath();
          ctx.arc(lm.x * width, lm.y * height, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // === NOSE DIRECTION ARROW (big, white, with shadow) ===
      if (metrics.nose_direction) {
        const nose = lms[1];
        if (nose) {
          const nx = nose.x * width;
          const ny = nose.y * height;
          // Scale arrow to 50px
          const mag = Math.sqrt(
            metrics.nose_direction.x ** 2 + metrics.nose_direction.y ** 2
          );
          const scale = mag > 0 ? 50 / mag : 1;
          const dx = metrics.nose_direction.x * scale;
          const dy = metrics.nose_direction.y * scale;

          // Shadow
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          // Arrow line
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.lineTo(nx + dx, ny + dy);
          ctx.stroke();

          // Arrowhead
          const angle = Math.atan2(dy, dx);
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(nx + dx, ny + dy);
          ctx.lineTo(
            nx + dx - 10 * Math.cos(angle - 0.5),
            ny + dy - 10 * Math.sin(angle - 0.5)
          );
          ctx.lineTo(
            nx + dx - 10 * Math.cos(angle + 0.5),
            ny + dy - 10 * Math.sin(angle + 0.5)
          );
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      }
    } else if (metrics.face_landmarks && metrics.face_landmarks.length > 0) {
      // Fallback: fewer landmarks -- draw dots and bounding box
      const xs = metrics.face_landmarks.map((l) => l.x * width);
      const ys = metrics.face_landmarks.map((l) => l.y * height);
      const minX = Math.min(...xs) - 8;
      const minY = Math.min(...ys) - 8;
      const maxX = Math.max(...xs) + 8;
      const maxY = Math.max(...ys) + 8;

      ctx.strokeStyle = faceColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

      ctx.fillStyle = faceColor;
      for (const lm of metrics.face_landmarks) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === FACE STATE BANNER (top of camera) ===
    const stateInfo = FACE_STATE_LABELS[metrics.face_state] || FACE_STATE_LABELS.no_face;
    const bannerH = 24;
    ctx.fillStyle = faceColor;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, width, bannerH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${stateInfo.icon} ${stateInfo.label}`.trim(),
      width / 2,
      bannerH - 7
    );
    ctx.textAlign = 'start';

    // === HAND SKELETONS (draw ALL detected hands) ===
    const handsList = metrics.all_hand_landmarks && metrics.all_hand_landmarks.length > 0
      ? metrics.all_hand_landmarks
      : (metrics.hand_landmarks ? [metrics.hand_landmarks] : []);

    handsList.forEach((lms, handIdx) => {
      if (!lms || lms.length < 21) return;
      const handColor = handIdx === 0 ? '#00E5FF' : '#80DFFF';

      // Connections
      ctx.strokeStyle = handColor;
      ctx.lineWidth = 2;
      for (const [a, b] of HAND_CONNECTIONS) {
        if (lms[a] && lms[b]) {
          ctx.beginPath();
          ctx.moveTo(lms[a].x * width, lms[a].y * height);
          ctx.lineTo(lms[b].x * width, lms[b].y * height);
          ctx.stroke();
        }
      }

      // Joint dots -- white fill, colored border
      for (const lm of lms) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = handColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

    });

    // Gesture label near wrist -- for EACH hand
    const perHandGrips = metrics.per_hand_grips;
    if (perHandGrips && perHandGrips.length > 0) {
      ctx.font = 'bold 12px system-ui, sans-serif';
      perHandGrips.forEach((handGrip) => {
        const handLms = handsList[handGrip.hand_index];
        if (!handLms || !handLms[0]) return;
        if (handGrip.grip === 'none' || handGrip.grip === 'resting') return;
        const gesture = GESTURE_LABELS[handGrip.grip];
        if (!gesture || !gesture.label) return;

        const wrist = handLms[0];
        const labelText = `${gesture.icon} ${gesture.label}`.trim();
        const textW = ctx.measureText(labelText).width;

        const lx = wrist.x * width - 10;
        const ly = wrist.y * height + 12;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(lx - 4, ly - 12, textW + 12, 18);

        const handColor = handGrip.hand_index === 0 ? '#00E5FF' : '#80DFFF';
        ctx.fillStyle = handColor;
        ctx.fillText(labelText, lx, ly + 2);
      });
    }

    // Hands detected badge (top-right)
    if (metrics.hands_detected > 0) {
      const hdText = `${metrics.hands_detected} hand${metrics.hands_detected > 1 ? 's' : ''}`;
      ctx.font = 'bold 11px system-ui, sans-serif';
      const tw = ctx.measureText(hdText).width;
      ctx.fillStyle = 'rgba(0,229,255,0.85)';
      ctx.fillRect(width - tw - 14, 28, tw + 10, 18);
      ctx.fillStyle = '#000';
      ctx.fillText(hdText, width - tw - 9, 41);
    }

    // === GAZE DURATION COUNTER (bottom-left) ===
    const gazeText = `Social Gaze: ${metrics.social_gaze_total_sec.toFixed(1)}s`;
    const soundsText = `Sounds: ${metrics.total_child_sounds}`;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, height - 28, width, 28);

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = metrics.social_gaze_active ? '#0D9F7E' : '#AAAAAA';
    ctx.fillText(gazeText, 8, height - 9);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px system-ui, sans-serif';
    const soundsW = ctx.measureText(soundsText).width;
    ctx.fillText(soundsText, width - soundsW - 8, height - 9);
  }, [metrics, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
