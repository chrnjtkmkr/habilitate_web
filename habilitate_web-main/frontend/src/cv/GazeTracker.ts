/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tracks where the child is looking using MediaPipe Face Mesh.
 *
 * Simplified MVP: face detected + roughly frontal = gaze_on.
 * Uses nose tip (landmark 1) vs left/right face edges (234, 454)
 * to determine face orientation.
 */

interface GazeEpisode {
  start: number;
  end: number;
  duration: number;
}

export class GazeTracker {
  private gazeOn = false;
  private currentEpisodeStart: number | null = null;
  private totalGazeTime = 0;
  private startTime = 0;
  private episodes: GazeEpisode[] = [];

  start(): void {
    this.startTime = Date.now();
    this.totalGazeTime = 0;
    this.gazeOn = false;
    this.currentEpisodeStart = null;
    this.episodes = [];
  }

  processFrame(faceLandmarks: any[] | null): {
    gaze_on: boolean;
    gaze_duration_sec: number;
    total_gaze_time_sec: number;
    gaze_percentage: number;
  } {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;

    if (!faceLandmarks || faceLandmarks.length === 0) {
      // No face detected -- gaze off
      this.endEpisode(now);
      this.gazeOn = false;
      return this.buildResult(elapsed);
    }

    const face = faceLandmarks[0];
    const isFrontal = this.isFaceFrontal(face);

    if (isFrontal && !this.gazeOn) {
      // Gaze just started
      this.gazeOn = true;
      this.currentEpisodeStart = now;
    } else if (!isFrontal && this.gazeOn) {
      // Gaze just ended
      this.endEpisode(now);
      this.gazeOn = false;
    }

    return this.buildResult(elapsed);
  }

  private isFaceFrontal(face: any): boolean {
    // Face landmarks: nose tip (1), left cheek (234), right cheek (454)
    // If the nose tip x is roughly centered between the cheeks, face is frontal
    try {
      const noseTip = face[1] || face.keypoints?.[1];
      const leftEdge = face[234] || face.keypoints?.[234];
      const rightEdge = face[454] || face.keypoints?.[454];

      if (!noseTip || !leftEdge || !rightEdge) {
        // Fallback: if we have face landmarks at all, assume roughly frontal
        return true;
      }

      const noseX = noseTip.x ?? noseTip[0];
      const leftX = leftEdge.x ?? leftEdge[0];
      const rightX = rightEdge.x ?? rightEdge[0];
      const faceWidth = Math.abs(rightX - leftX);

      if (faceWidth < 0.01) return false;

      const noseRatio = (noseX - leftX) / faceWidth;
      // Frontal if nose is roughly centered (ratio between 0.30-0.70)
      return noseRatio >= 0.30 && noseRatio <= 0.70;
    } catch {
      return false;
    }
  }

  private endEpisode(now: number): void {
    if (this.currentEpisodeStart !== null) {
      const duration = (now - this.currentEpisodeStart) / 1000;
      this.totalGazeTime += duration;
      this.episodes.push({
        start: this.currentEpisodeStart,
        end: now,
        duration,
      });
      this.currentEpisodeStart = null;
    }
  }

  private buildResult(elapsed: number) {
    const currentDuration =
      this.gazeOn && this.currentEpisodeStart
        ? (Date.now() - this.currentEpisodeStart) / 1000
        : 0;

    const totalWithCurrent = this.totalGazeTime + currentDuration;
    const percentage = elapsed > 0 ? (totalWithCurrent / elapsed) * 100 : 0;

    return {
      gaze_on: this.gazeOn,
      gaze_duration_sec: Math.round(currentDuration * 10) / 10,
      total_gaze_time_sec: Math.round(totalWithCurrent * 10) / 10,
      gaze_percentage: Math.round(percentage * 10) / 10,
    };
  }

  getMetrics() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return this.buildResult(elapsed);
  }

  reset(): void {
    this.start();
  }
}
