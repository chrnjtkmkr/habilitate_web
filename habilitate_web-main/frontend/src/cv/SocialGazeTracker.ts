/**
 * SocialGazeTracker — measures directed gaze toward social partner.
 *
 * Based on ESDM assessment methodology (Rogers & Dawson, 2010):
 * "Frequency of directed gaze toward social partner" is a primary
 * outcome measure for social attention in young children with ASD.
 *
 * SETUP: Tablet camera near facilitator, aimed at child across the table.
 *
 * PITCH-BASED CLASSIFICATION (toys are ON the table, BELOW the child):
 * - Pitch < 10  -> social_gaze (looking straight/up at facilitator)
 * - Pitch 10-25  -> looking_at_toys (looking down at table/toys)
 * - Pitch > 25   -> head_down (looking far down -- lap/floor)
 * - |Yaw| > 30   -> looking_away (turned sideways -- disengaged)
 * - No face       -> not_visible
 *
 * FACE ANGLE CALCULATION FROM MEDIAPIPE LANDMARKS:
 * Yaw: nose tip (1), left ear (234), right ear (454)
 * Pitch: nose tip (1), forehead (10), chin (152)
 */

export type FaceState = 'social_gaze' | 'looking_at_toys' | 'head_down' | 'looking_away' | 'not_visible';

export interface SocialGazeMetrics {
  face_detected: boolean;
  social_gaze_active: boolean;
  social_gaze_events: number;
  social_gaze_total_sec: number;
  social_gaze_percentage: number;
  longest_gaze_episode_sec: number;
  current_episode_sec: number;
  gaze_away_events: number;
  face_yaw_degrees: number;
  face_pitch_degrees: number;
  face_state: FaceState;
  face_landmarks: Array<{ x: number; y: number }> | null;
  nose_direction: { x: number; y: number } | null;
}

interface GazeEpisode {
  start: number;
  end: number;
  duration: number;
}

export class SocialGazeTracker {
  // Pitch thresholds (degrees, positive = looking down)
  private socialGazePitchMax: number = 10;     // below this = looking at facilitator
  private toysPitchMax: number = 25;           // 10-25 = looking at toys on table
  // above 25 = head_down (lap/floor)
  private lookingAwayYawMin: number = 30;      // |yaw| above this = turned away
  private gazeAwayMinDuration: number = 3000;  // ms to count as gaze-away event

  // State
  private inSocialGaze: boolean = false;
  private socialGazeStart: number | null = null;
  private gazeAwayStart: number | null = null;
  private previousState: FaceState = 'not_visible';

  // Accumulated metrics
  private gazeEvents: number = 0;
  private gazeEpisodes: GazeEpisode[] = [];
  private gazeAwayEvents: number = 0;
  private totalGazeTime: number = 0;
  private activityStartTime: number = 0;
  private lastYaw: number = 0;
  private lastPitch: number = 0;
  private lastFaceState: FaceState = 'not_visible';

  start(): void {
    this.activityStartTime = Date.now();
    this.reset();
  }

  processFrame(
    faceLandmarks: Array<{ x: number; y: number; z: number }> | null
  ): SocialGazeMetrics {
    const now = Date.now();
    const elapsed = (now - this.activityStartTime) / 1000;

    if (!faceLandmarks || faceLandmarks.length < 468) {
      this.endCurrentGazeEpisode(now);
      this.previousState = 'not_visible';
      return this.buildMetrics(elapsed, null, null, 'not_visible', 0, 0);
    }

    const yaw = this.calculateYaw(faceLandmarks);
    const pitch = this.calculatePitch(faceLandmarks);

    // CORRECT pitch-based classification:
    // Toys are on the table (below), facilitator is across (straight ahead)
    let faceState: FaceState;

    if (Math.abs(yaw) > this.lookingAwayYawMin) {
      faceState = 'looking_away';           // Turned sideways -- disengaged
    } else if (pitch < this.socialGazePitchMax) {
      faceState = 'social_gaze';            // Looking straight/up at facilitator
    } else if (pitch < this.toysPitchMax) {
      faceState = 'looking_at_toys';        // Looking down at table/toys
    } else {
      faceState = 'head_down';              // Looking far down -- lap/floor
    }

    // Detect social gaze EVENT: child transitions from looking DOWN to looking at facilitator
    // This upward transition IS the clinically meaningful moment
    if (
      faceState === 'social_gaze' &&
      (this.previousState === 'looking_at_toys' || this.previousState === 'head_down')
    ) {
      this.gazeEvents++;
    }
    this.previousState = faceState;

    // Track social gaze episodes (duration)
    if (faceState === 'social_gaze') {
      if (!this.inSocialGaze) {
        this.socialGazeStart = now;
        this.inSocialGaze = true;
      }
      this.gazeAwayStart = null;
    } else {
      this.endCurrentGazeEpisode(now);

      // Track gaze-away events (>3s turned away)
      if (faceState === 'looking_away' || faceState === 'head_down') {
        if (this.gazeAwayStart === null) {
          this.gazeAwayStart = now;
        } else if (now - this.gazeAwayStart > this.gazeAwayMinDuration) {
          this.gazeAwayEvents++;
          this.gazeAwayStart = null;
        }
      } else {
        this.gazeAwayStart = null;
      }
    }

    const noseDir = this.calculateNoseDirection(yaw, pitch);
    const allLandmarks = faceLandmarks.map((l) => ({ x: l.x, y: l.y }));

    return this.buildMetrics(elapsed, allLandmarks, noseDir, faceState, yaw, pitch);
  }

  private calculateYaw(
    landmarks: Array<{ x: number; y: number; z: number }>
  ): number {
    const nose = landmarks[1];
    const leftEar = landmarks[234];
    const rightEar = landmarks[454];

    const leftDist = Math.sqrt(
      Math.pow(nose.x - leftEar.x, 2) + Math.pow(nose.y - leftEar.y, 2)
    );
    const rightDist = Math.sqrt(
      Math.pow(nose.x - rightEar.x, 2) + Math.pow(nose.y - rightEar.y, 2)
    );

    return (
      Math.atan2(leftDist - rightDist, leftDist + rightDist) *
      (180 / Math.PI) *
      2
    );
  }

  private calculatePitch(
    landmarks: Array<{ x: number; y: number; z: number }>
  ): number {
    const nose = landmarks[1];
    const forehead = landmarks[10];
    const chin = landmarks[152];

    const faceHeight = Math.sqrt(
      Math.pow(forehead.x - chin.x, 2) + Math.pow(forehead.y - chin.y, 2)
    );
    const nosePosition = (nose.y - forehead.y) / faceHeight;

    // Calibrated: looking straight ~ 0.38-0.42, down at table ~ 0.50+
    return (nosePosition - 0.40) * 180;
  }

  private endCurrentGazeEpisode(now: number): void {
    if (this.inSocialGaze && this.socialGazeStart !== null) {
      const duration = (now - this.socialGazeStart) / 1000;
      this.gazeEpisodes.push({ start: this.socialGazeStart, end: now, duration });
      this.totalGazeTime += duration;
      this.inSocialGaze = false;
      this.socialGazeStart = null;
    }
  }

  private buildMetrics(
    elapsed: number,
    landmarks: Array<{ x: number; y: number }> | null,
    noseDir: { x: number; y: number } | null,
    faceState: FaceState,
    yaw: number,
    pitch: number
  ): SocialGazeMetrics {
    this.lastYaw = yaw;
    this.lastPitch = pitch;
    this.lastFaceState = faceState;
    const currentEpisodeSec =
      this.inSocialGaze && this.socialGazeStart
        ? (Date.now() - this.socialGazeStart) / 1000
        : 0;

    const totalWithCurrent = this.totalGazeTime + currentEpisodeSec;
    const longestPast =
      this.gazeEpisodes.length > 0
        ? Math.max(...this.gazeEpisodes.map((e) => e.duration))
        : 0;

    return {
      face_detected: faceState !== 'not_visible',
      social_gaze_active: faceState === 'social_gaze',
      social_gaze_events: this.gazeEvents,
      social_gaze_total_sec: totalWithCurrent,
      social_gaze_percentage: elapsed > 0 ? (totalWithCurrent / elapsed) * 100 : 0,
      longest_gaze_episode_sec: Math.max(longestPast, currentEpisodeSec),
      current_episode_sec: currentEpisodeSec,
      gaze_away_events: this.gazeAwayEvents,
      face_yaw_degrees: yaw,
      face_pitch_degrees: pitch,
      face_state: faceState,
      face_landmarks: landmarks,
      nose_direction: noseDir,
    };
  }

  getMetrics(): SocialGazeMetrics {
    const elapsed = (Date.now() - this.activityStartTime) / 1000;
    return this.buildMetrics(elapsed, null, null, this.lastFaceState, this.lastYaw, this.lastPitch);
  }

  reset(): void {
    this.gazeEvents = 0;
    this.gazeEpisodes = [];
    this.gazeAwayEvents = 0;
    this.totalGazeTime = 0;
    this.inSocialGaze = false;
    this.socialGazeStart = null;
    this.gazeAwayStart = null;
    this.previousState = 'not_visible';
    this.activityStartTime = Date.now();
  }

  private calculateNoseDirection(
    yaw: number,
    pitch: number
  ): { x: number; y: number } {
    return {
      x: Math.sin((yaw * Math.PI) / 180) * 30,
      y: Math.sin((pitch * Math.PI) / 180) * 30,
    };
  }
}
