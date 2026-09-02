/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
/**
 * Orchestrates all CV modules into a unified pipeline.
 * Main entry point used by SessionRun.tsx.
 *
 * Runs at ~15fps (every 66ms) for face/hand tracking.
 * Audio pitch detection runs at 20Hz (every 50ms).
 * All processing on-device. No video frames leave the browser.
 *
 * MediaPipe is loaded from CDN at runtime via script tags
 * because the npm package has broken exports with Vite 8.
 */

import { CameraManager } from './CameraManager';
import { SocialGazeTracker } from './SocialGazeTracker';
import type { SocialGazeMetrics, FaceState } from './SocialGazeTracker';
import { AutoHandTracker } from './AutoHandTracker';
import type { AutoHandMetrics, PerHandGrip } from './AutoHandTracker';
import { ChildVoiceTracker } from './ChildVoiceTracker';
import type { ChildVoiceMetrics } from './ChildVoiceTracker';

export interface CVMetrics {
  // Social gaze (replaces simple gaze_on)
  face_detected: boolean;
  social_gaze_active: boolean;
  social_gaze_events: number;
  social_gaze_total_sec: number;
  social_gaze_percentage: number;
  longest_gaze_episode_sec: number;
  current_gaze_episode_sec: number;
  gaze_away_events: number;
  face_yaw_degrees: number;
  face_pitch_degrees: number;
  face_state: FaceState;
  face_landmarks: Array<{ x: number; y: number }> | null;
  nose_direction: { x: number; y: number } | null;

  // Child voice (replaces vocalization_count)
  total_child_sounds: number;
  prompted_sounds: number;
  spontaneous_sounds: number;
  avg_vocalization_duration_ms: number;
  avg_prompt_response_latency_ms: number;
  voice_state: 'child_speaking' | 'adult_speaking' | 'silence' | 'noise';
  audio_level: number;
  current_pitch_hz: number;
  pitch_classification: string;

  // Hand gestures
  hands_detected: number;
  hand_active: boolean;
  current_gesture: string;
  grip_label: string;
  reaching_events: number;
  pointing_events: number;
  grasp_events: number;
  pincer_grasp_events: number;
  power_grasp_events: number;
  successful_grasps: number;
  controlled_releases: number;
  wave_events: number;
  squeeze_events: number;
  hand_active_percentage: number;
  hand_landmarks: Array<{ x: number; y: number }> | null;
  all_hand_landmarks: Array<Array<{ x: number; y: number }>> | null;
  pointing_direction: { horizontal: string; vertical: string } | null;
  clap_events: number;
  per_hand_grips: PerHandGrip[];

  // Voice -- adult episode counter
  adult_voice_count: number;

  timestamp_ms: number;
}

export interface CVStatus {
  camera: boolean;
  microphone: boolean;
  faceMesh: boolean;
  hands: boolean;
}

declare const window: Window & {
  FaceLandmarker?: any;
  HandLandmarker?: any;
  FilesetResolver?: any;
};

/** Load MediaPipe tasks-vision from CDN */
async function loadMediaPipeVision(): Promise<any> {
  if (window.FilesetResolver) {
    return {
      FilesetResolver: window.FilesetResolver,
      FaceLandmarker: window.FaceLandmarker,
      HandLandmarker: window.HandLandmarker,
    };
  }

  return new Promise((resolve, reject) => {
    const moduleScript = document.createElement('script');
    moduleScript.type = 'module';
    moduleScript.textContent = `
      import { FaceLandmarker, HandLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
      window.__mediapipe_vision = { FaceLandmarker, HandLandmarker, FilesetResolver };
      window.dispatchEvent(new Event('mediapipe-loaded'));
    `;

    const onLoaded = () => {
      window.removeEventListener('mediapipe-loaded', onLoaded);
      const mp = (window as any).__mediapipe_vision;
      if (mp) {
        resolve(mp);
      } else {
        reject(new Error('MediaPipe vision failed to load'));
      }
    };

    window.addEventListener('mediapipe-loaded', onLoaded);
    setTimeout(() => {
      window.removeEventListener('mediapipe-loaded', onLoaded);
      reject(new Error('MediaPipe load timeout'));
    }, 30000);

    document.head.appendChild(moduleScript);
  });
}

/** When multiple faces detected, pick the child (lower, more centered, smaller) */
function selectChildFace(faces: any[]): any {
  if (faces.length === 1) return faces[0];

  const scored = faces.map((face) => {
    // Use face landmarks to estimate center and size
    const lms = face as Array<{ x: number; y: number }>;
    let sumX = 0, sumY = 0, minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const lm of lms) {
      sumX += lm.x; sumY += lm.y;
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }
    const centerX = sumX / lms.length;
    const centerY = sumY / lms.length;
    const size = (maxX - minX) * (maxY - minY);

    // Prefer: lower in frame (higher Y = child), more centered, smaller
    const yScore = centerY;
    const centerScore = 1 - Math.abs(centerX - 0.5);
    const sizeScore = 1 - Math.min(size * 4, 1);
    return { face, score: yScore * 0.4 + centerScore * 0.3 + sizeScore * 0.3 };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].face;
}

export class CVPipeline {
  private camera: CameraManager;
  private gazeTracker: SocialGazeTracker;
  private handTracker: AutoHandTracker;
  private voiceTracker: ChildVoiceTracker;
  private faceLandmarker: any = null;
  private handLandmarker: any = null;
  private running = false;
  private onMetricsUpdate: ((metrics: CVMetrics) => void) | null = null;
  private cameraPermissionGranted = false;
  private micPermissionGranted = false;
  private audioInterval: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.camera = new CameraManager();
    this.gazeTracker = new SocialGazeTracker();
    this.handTracker = new AutoHandTracker();
    this.voiceTracker = new ChildVoiceTracker();
  }

  /**
   * @param audioCtx - AudioContext created and resumed inside the Start Session
   *                   click handler so it is guaranteed to be in 'running' state.
   *                   Passed through to ChildVoiceTracker.
   */
  async initialize(
    videoElement: HTMLVideoElement,
    onMetrics: (metrics: CVMetrics) => void,
    audioCtx?: AudioContext,
  ): Promise<CVStatus> {
    this.onMetricsUpdate = onMetrics;

    // 1. Initialize camera
    this.cameraPermissionGranted = await this.camera.initialize(videoElement);

    // 2. Initialize microphone with pitch-based voice tracking
    if (audioCtx) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await this.voiceTracker.initialize(micStream, audioCtx);
        this.micPermissionGranted = true;
        console.log('[CVPipeline] microphone initialized successfully');
      } catch (err) {
        this.micPermissionGranted = false;
        console.warn('[CVPipeline] microphone init failed:', err);
      }
    }

    // 3. Load MediaPipe from CDN and initialize landmarkers
    let faceMeshOk = false;
    let handsOk = false;

    try {
      const mp = await loadMediaPipeVision();
      const filesetResolver = await mp.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      try {
        this.faceLandmarker = await mp.FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          }
        );
        faceMeshOk = true;
      } catch {
        faceMeshOk = false;
      }

      try {
        this.handLandmarker = await mp.HandLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          }
        );
        handsOk = true;
      } catch {
        handsOk = false;
      }
    } catch {
      // MediaPipe CDN load failed -- CV will work without ML models
    }

    return {
      camera: this.cameraPermissionGranted,
      microphone: this.micPermissionGranted,
      faceMesh: faceMeshOk,
      hands: handsOk,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.gazeTracker.start();

    // Audio pitch processing at 50ms intervals (20Hz)
    let audioLogCounter = 0;
    let prevVoiceState = 'silence';
    // MEASURE 4: per-transition audio diagnostic + 30s distribution
    let audioConfSamples: { confidence: number; rms: number; classified: string }[] = [];
    let audioDistStart = 0;
    if (this.micPermissionGranted) {
      audioDistStart = Date.now();
      this.audioInterval = setInterval(() => {
        this.voiceTracker.process();
        const v = this.voiceTracker.getMetrics();
        const state = v.current_state;

        // Per-transition log: every time voice_state changes
        if (state !== prevVoiceState) {
          console.log('[AUDIO-DIAG] transition', prevVoiceState, '->', state,
            { audioLevel: v.audio_level.toFixed(4), pitchHz: v.current_pitch_hz.toFixed(0),
              confidence: v.pitch_confidence.toFixed(3), classification: v.pitch_classification });
          prevVoiceState = state;
        }

        // Collect distribution samples while speaking (non-silence)
        if (v.audio_level > 0.005) {
          audioConfSamples.push({ confidence: v.pitch_confidence, rms: v.audio_level, classified: v.pitch_classification });
        }

        // Print 30s distribution summary
        if (Date.now() - audioDistStart >= 30000 && audioConfSamples.length > 0) {
          const total = audioConfSamples.length;
          const adult = audioConfSamples.filter(s => s.classified === 'adult_voice').length;
          const child = audioConfSamples.filter(s => s.classified === 'child_voice').length;
          const noise = audioConfSamples.filter(s => s.classified === 'noise').length;
          const rmsVals = audioConfSamples.map(s => s.rms);
          const confVals = audioConfSamples.map(s => s.confidence);
          const confAboveThreshold = audioConfSamples.filter(s => s.confidence >= 0.3).length;
          console.log('[AUDIO-DIST] 30s summary', {
            totalNonSilentFrames: total,
            adultVoice: adult, adultPct: (adult / total * 100).toFixed(1) + '%',
            childVoice: child, childPct: (child / total * 100).toFixed(1) + '%',
            noise: noise, noisePct: (noise / total * 100).toFixed(1) + '%',
            rmsRange: [Math.min(...rmsVals).toFixed(4), Math.max(...rmsVals).toFixed(4)],
            confRange: [Math.min(...confVals).toFixed(3), Math.max(...confVals).toFixed(3)],
            confAbove03: confAboveThreshold, confAbove03Pct: (confAboveThreshold / total * 100).toFixed(1) + '%',
          });
          audioConfSamples = [];
          audioDistStart = Date.now();
        }

        // Existing periodic log every ~5 seconds
        audioLogCounter++;
        if (audioLogCounter % 100 === 0) {
          console.log('[audio]', { childSounds: v.total_child_sounds, adultVoiceCount: v.adult_voice_count, audioLevel: v.audio_level.toFixed(3), voiceState: v.current_state });
        }
      }, 50);
    }

    // FIX 3 / YAW-DIAG: rolling max |yaw| logged every ~2s
    let yawDiagMax = 0;
    let yawDiagStart = Date.now();

    const processFrame = () => {
      if (!this.running) return;

      const video = this.camera.getVideoElement();
      if (video && video.readyState >= 2) {
        const now = performance.now();

        // Run Face Mesh
        let faceLandmarks: any[] | null = null;
        if (this.faceLandmarker) {
          try {
            const faceResult = this.faceLandmarker.detectForVideo(video, now);
            if (faceResult?.faceLandmarks?.length > 0) {
              faceLandmarks = faceResult.faceLandmarks;
            }
          } catch {
            // Ignore frame processing errors
          }
        }

        // Run Hands
        let handLandmarks: any[] | null = null;
        if (this.handLandmarker) {
          try {
            const handResult = this.handLandmarker.detectForVideo(video, now);
            if (handResult?.landmarks?.length > 0) {
              handLandmarks = handResult.landmarks;
            }
          } catch {
            // Ignore frame processing errors
          }
        }

        // Select child face if multiple detected
        const selectedFace = faceLandmarks
          ? selectChildFace(faceLandmarks)
          : null;

        // Process through trackers
        const gaze: SocialGazeMetrics = this.gazeTracker.processFrame(
          selectedFace
        );
        const hand: AutoHandMetrics = this.handTracker.processFrame(handLandmarks);
        const voice: ChildVoiceMetrics = this.voiceTracker.getMetrics();

        // [YAW-DIAG] track rolling max |yaw| and log every ~2s
        if (gaze.face_detected) {
          const absYaw = Math.abs(gaze.face_yaw_degrees);
          if (absYaw > yawDiagMax) yawDiagMax = absYaw;
        }
        const yawNow = Date.now();
        if (yawNow - yawDiagStart >= 2000) {
          console.log('[YAW-DIAG] max |yaw| last 2s:', yawDiagMax.toFixed(1) + '°',
            '| current:', gaze.face_yaw_degrees.toFixed(1) + '°',
            '| face:', gaze.face_state);
          yawDiagMax = 0;
          yawDiagStart = yawNow;
        }

        const metrics: CVMetrics = {
          // Social gaze
          face_detected: gaze.face_detected,
          social_gaze_active: gaze.social_gaze_active,
          social_gaze_events: gaze.social_gaze_events,
          social_gaze_total_sec: gaze.social_gaze_total_sec,
          social_gaze_percentage: gaze.social_gaze_percentage,
          longest_gaze_episode_sec: gaze.longest_gaze_episode_sec,
          current_gaze_episode_sec: gaze.current_episode_sec,
          gaze_away_events: gaze.gaze_away_events,
          face_yaw_degrees: gaze.face_yaw_degrees,
          face_pitch_degrees: gaze.face_pitch_degrees,
          face_state: gaze.face_state,
          face_landmarks: gaze.face_landmarks,
          nose_direction: gaze.nose_direction,

          // Child voice
          total_child_sounds: voice.total_child_sounds,
          prompted_sounds: voice.prompted_sounds,
          spontaneous_sounds: voice.spontaneous_sounds,
          avg_vocalization_duration_ms: voice.avg_vocalization_duration_ms,
          avg_prompt_response_latency_ms: voice.avg_prompt_response_latency_ms,
          voice_state: voice.current_state,
          audio_level: voice.audio_level,
          current_pitch_hz: voice.current_pitch_hz,
          pitch_classification: voice.pitch_classification,

          // Hand gestures
          hands_detected: hand.hands_detected,
          hand_active: hand.hand_active,
          current_gesture: hand.current_gesture,
          grip_label: hand.grip_label,
          reaching_events: hand.reaching_events,
          pointing_events: hand.pointing_events,
          grasp_events: hand.grasp_events,
          pincer_grasp_events: hand.pincer_grasp_events,
          power_grasp_events: hand.power_grasp_events,
          successful_grasps: hand.successful_grasps,
          controlled_releases: hand.controlled_releases,
          wave_events: hand.wave_events,
          squeeze_events: hand.squeeze_events,
          hand_active_percentage: hand.hand_active_percentage,
          hand_landmarks: hand.hand_landmarks,
          all_hand_landmarks: hand.all_hand_landmarks,
          pointing_direction: hand.pointing_direction,
          clap_events: hand.clap_events,
          per_hand_grips: hand.per_hand_grips,

          adult_voice_count: voice.adult_voice_count,

          timestamp_ms: Date.now(),
        };

        if (this.onMetricsUpdate) {
          this.onMetricsUpdate(metrics);
        }
      }

      if (this.running) {
        this.timeoutId = setTimeout(processFrame, 66); // ~15fps
      }
    };

    processFrame();
  }

  getCurrentMetrics(): CVMetrics {
    const gaze = this.gazeTracker.getMetrics();
    const voice = this.voiceTracker.getMetrics();

    return {
      face_detected: gaze.face_detected,
      social_gaze_active: gaze.social_gaze_active,
      social_gaze_events: gaze.social_gaze_events,
      social_gaze_total_sec: gaze.social_gaze_total_sec,
      social_gaze_percentage: gaze.social_gaze_percentage,
      longest_gaze_episode_sec: gaze.longest_gaze_episode_sec,
      current_gaze_episode_sec: gaze.current_episode_sec,
      gaze_away_events: gaze.gaze_away_events,
      face_yaw_degrees: gaze.face_yaw_degrees,
      face_pitch_degrees: gaze.face_pitch_degrees,
      face_state: gaze.face_state,
      face_landmarks: null,
      nose_direction: null,

      total_child_sounds: voice.total_child_sounds,
      prompted_sounds: voice.prompted_sounds,
      spontaneous_sounds: voice.spontaneous_sounds,
      avg_vocalization_duration_ms: voice.avg_vocalization_duration_ms,
      avg_prompt_response_latency_ms: voice.avg_prompt_response_latency_ms,
      voice_state: voice.current_state,
      audio_level: voice.audio_level,
      current_pitch_hz: voice.current_pitch_hz,
      pitch_classification: voice.pitch_classification,

      hands_detected: 0,
      hand_active: false,
      current_gesture: 'none',
      grip_label: '',
      reaching_events: 0,
      pointing_events: 0,
      grasp_events: 0,
      pincer_grasp_events: 0,
      power_grasp_events: 0,
      successful_grasps: 0,
      controlled_releases: 0,
      wave_events: 0,
      squeeze_events: 0,
      hand_active_percentage: 0,
      hand_landmarks: null,
      all_hand_landmarks: null,
      pointing_direction: null,
      clap_events: 0,
      per_hand_grips: [],

      adult_voice_count: voice.adult_voice_count,

      timestamp_ms: Date.now(),
    };
  }

  /** Slim payload for backend events -- excludes landmarks and display-only fields. */
  getMetricsForBackend(): Record<string, any> {
    const full = this.getCurrentMetrics();
    return {
      social_gaze_total_sec: full.social_gaze_total_sec,
      social_gaze_percentage: full.social_gaze_percentage,
      social_gaze_events: full.social_gaze_events,
      longest_gaze_episode_sec: full.longest_gaze_episode_sec,
      gaze_away_events: full.gaze_away_events,
      total_child_sounds: full.total_child_sounds,
      prompted_sounds: full.prompted_sounds,
      spontaneous_sounds: full.spontaneous_sounds,
      adult_voice_count: full.adult_voice_count,
      reaching_events: full.reaching_events,
      pointing_events: full.pointing_events,
      grasp_events: full.grasp_events,
      pincer_grasp_events: full.pincer_grasp_events,
      power_grasp_events: full.power_grasp_events,
      successful_grasps: full.successful_grasps,
      controlled_releases: full.controlled_releases,
      clap_events: full.clap_events,
      wave_events: full.wave_events,
      squeeze_events: full.squeeze_events,
      hands_detected: full.hands_detected,
    };
  }

  resetForNewActivity(): void {
    this.gazeTracker.reset();
    this.handTracker.reset();
    this.voiceTracker.reset();
  }

  /** Re-acquire camera stream without resetting metrics */
  async recoverCamera(videoElement: HTMLVideoElement): Promise<boolean> {
    try {
      const ok = await this.camera.initialize(videoElement);
      this.cameraPermissionGranted = ok;
      return ok;
    } catch {
      return false;
    }
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.audioInterval) {
      clearInterval(this.audioInterval);
      this.audioInterval = null;
    }
    this.camera.stop();
    this.voiceTracker.stop();
    if (this.faceLandmarker) {
      try {
        this.faceLandmarker.close();
      } catch {}
      this.faceLandmarker = null;
    }
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch {}
      this.handLandmarker = null;
    }
  }
}
