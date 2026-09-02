/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Detects head turn response after name-call prompt.
 *
 * When facilitator taps "Name Called", starts a 5-second detection window.
 * If the child's head yaw changes by >15 degrees, a turn is detected.
 */

const DETECTION_WINDOW_MS = 5000;
const YAW_THRESHOLD_DEG = 15;

export class HeadTurnDetector {
  private detecting = false;
  private promptTimestamp = 0;
  private baselineYaw = 0;
  private detected = false;
  private latencyMs = 0;

  startDetection(): void {
    this.detecting = true;
    this.detected = false;
    this.latencyMs = 0;
    this.promptTimestamp = Date.now();
    this.baselineYaw = NaN; // will be set on first frame
  }

  processFrame(faceLandmarks: any[] | null): {
    head_turn_detected: boolean;
    head_turn_latency_ms: number | null;
    detecting: boolean;
  } {
    if (!this.detecting) {
      return {
        head_turn_detected: this.detected,
        head_turn_latency_ms: this.detected ? this.latencyMs : null,
        detecting: false,
      };
    }

    const now = Date.now();
    const elapsed = now - this.promptTimestamp;

    // Check timeout
    if (elapsed > DETECTION_WINDOW_MS) {
      this.detecting = false;
      return {
        head_turn_detected: this.detected,
        head_turn_latency_ms: this.detected ? this.latencyMs : null,
        detecting: false,
      };
    }

    if (!faceLandmarks || faceLandmarks.length === 0) {
      return { head_turn_detected: false, head_turn_latency_ms: null, detecting: true };
    }

    const yaw = this.calculateYaw(faceLandmarks[0]);

    // Set baseline on first frame after detection starts
    if (isNaN(this.baselineYaw)) {
      this.baselineYaw = yaw;
      return { head_turn_detected: false, head_turn_latency_ms: null, detecting: true };
    }

    const delta = Math.abs(yaw - this.baselineYaw);
    if (delta >= YAW_THRESHOLD_DEG) {
      this.detected = true;
      this.latencyMs = elapsed;
      this.detecting = false;
      return {
        head_turn_detected: true,
        head_turn_latency_ms: this.latencyMs,
        detecting: false,
      };
    }

    return { head_turn_detected: false, head_turn_latency_ms: null, detecting: true };
  }

  private calculateYaw(face: any): number {
    try {
      const noseTip = face[1] || face.keypoints?.[1];
      const leftEar = face[234] || face.keypoints?.[234];
      const rightEar = face[454] || face.keypoints?.[454];

      if (!noseTip || !leftEar || !rightEar) return 0;

      const noseX = noseTip.x ?? noseTip[0];
      const leftX = leftEar.x ?? leftEar[0];
      const rightX = rightEar.x ?? rightEar[0];

      const midX = (leftX + rightX) / 2;
      const faceWidth = Math.abs(rightX - leftX);

      if (faceWidth < 0.01) return 0;

      // Convert nose offset from center to approximate degrees
      const offset = (noseX - midX) / faceWidth;
      return offset * 90; // rough approximation: full offset = 90 degrees
    } catch {
      return 0;
    }
  }

  getResult(): { detected: boolean; latency_ms: number | null } {
    return { detected: this.detected, latency_ms: this.detected ? this.latencyMs : null };
  }
}
