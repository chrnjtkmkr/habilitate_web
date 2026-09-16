/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-assignment */
/**
 * AutoHandTracker — comprehensive hand gesture classification
 * with grip states mapped to developmental milestones.
 *
 * Grip States:
 * - pincer_grasp: thumb+index meeting (fine motor, 9-12mo milestone)
 * - power_grasp: fingers curled around object (gross motor, 6-9mo)
 * - pointing: index extended, others curled (communication, 9-14mo)
 * - open: all fingers extended (ready to grasp)
 * - closed_fist: all fingers tight (squeezing)
 * - waving: open hand oscillating (social gesture, 9-12mo)
 * - resting / none
 *
 * Sequences: open->grip->lift = successful grasp, grip->lower->open = release
 */

export type GripState = 'open' | 'pincer_grasp' | 'power_grasp' | 'pointing' | 'closed_fist' | 'waving' | 'resting' | 'none';

export interface PerHandGrip {
  hand_index: number;
  grip: GripState;
  grip_label: string;
  confidence: number;
  pointing_direction: { horizontal: string; vertical: string } | null;
}

export interface AutoHandMetrics {
  hands_detected: number;
  hand_active: boolean;
  current_gesture: GripState;
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
}

const GRIP_LABELS: Record<GripState, string> = {
  open: 'Open Hand',
  pincer_grasp: 'Pinch Grip',
  power_grasp: 'Power Grip',
  pointing: 'Pointing',
  closed_fist: 'Fist',
  waving: 'Waving',
  resting: '',
  none: '',
};

// Priority ordering for selecting the most significant grip across hands
const GRIP_PRIORITY: Record<GripState, number> = {
  pointing: 7,
  pincer_grasp: 6,
  power_grasp: 5,
  waving: 4,
  closed_fist: 3,
  open: 2,
  resting: 1,
  none: 0,
};

interface PerHandState {
  lastGesture: GripState;
  wristHistory: Array<{ x: number; y: number; t: number }>;
  gripHistory: Array<{ state: GripState; y: number; t: number }>;
  squeezeHistory: Array<{ state: GripState; t: number }>;
  lastGraspTime: number;
  lastReleaseTime: number;
  lastSqueezeTime: number;
}

export class AutoHandTracker {
  private reachingEvents = 0;
  private pointingEvents = 0;
  private graspEvents = 0;
  private pincerGraspEvents = 0;
  private powerGraspEvents = 0;
  private successfulGrasps = 0;
  private controlledReleases = 0;
  private waveEvents = 0;
  private squeezeEvents = 0;
  private clapEvents = 0;

  private handDistanceHistory: Array<{ d: number; t: number }> = [];
  private lastClapTime = 0;

  private activeFrames = 0;
  private totalFrames = 0;

  private handStates: PerHandState[] = [];
  private lastPointingDir: { horizontal: string; vertical: string } | null = null;

  processFrame(handLandmarks: any[] | null): AutoHandMetrics {
    this.totalFrames++;

    if (!handLandmarks || handLandmarks.length === 0) {
      this.lastPointingDir = null;
      this.handDistanceHistory = [];
      return this.buildResult(0, false, 'none');
    }

    // Extract landmarks for ALL detected hands (for drawing overlay)
    const allLandmarks: Array<Array<{ x: number; y: number }>> = handLandmarks.map(h =>
      this.extractLandmarks(h)
    );

    // Detect clapping when 2 hands are visible
    if (handLandmarks.length >= 2) {
      this.detectClapping(handLandmarks[0], handLandmarks[1]);
    } else {
      this.handDistanceHistory = [];
    }

    this.activeFrames++;

    // Ensure per-hand state slots exist
    while (this.handStates.length < handLandmarks.length) {
      this.handStates.push({
        lastGesture: 'none',
        wristHistory: [],
        gripHistory: [],
        squeezeHistory: [],
        lastGraspTime: 0,
        lastReleaseTime: 0,
        lastSqueezeTime: 0,
      });
    }

    // Classify EACH hand
    const perHandGrips: PerHandGrip[] = [];
    let overallPointingDir: { horizontal: string; vertical: string } | null = null;

    for (let hIdx = 0; hIdx < handLandmarks.length; hIdx++) {
      const result = this.classifyHand(handLandmarks[hIdx], this.handStates[hIdx]);
      perHandGrips.push({
        hand_index: hIdx,
        grip: result.grip,
        grip_label: GRIP_LABELS[result.grip] || '',
        confidence: result.confidence,
        pointing_direction: result.pointingDir,
      });
      if (result.pointingDir && !overallPointingDir) {
        overallPointingDir = result.pointingDir;
      }
    }

    // Select most significant grip across all hands
    let bestGrip: GripState = 'none';
    let bestPriority = -1;
    for (const g of perHandGrips) {
      const pri = GRIP_PRIORITY[g.grip] ?? 0;
      if (pri > bestPriority) {
        bestPriority = pri;
        bestGrip = g.grip;
      }
    }

    this.lastPointingDir = overallPointingDir;

    const primaryLandmarks = allLandmarks[0];
    return this.buildResult(handLandmarks.length, true, bestGrip, primaryLandmarks, allLandmarks, perHandGrips);
  }

  private classifyHand(
    hand: any,
    state: PerHandState
  ): { grip: GripState; confidence: number; pointingDir: { horizontal: string; vertical: string } | null } {
    const lm = (idx: number) => {
      const p = hand[idx] || hand.keypoints?.[idx];
      if (!p) return null;
      return { x: (p.x ?? p[0]) as number, y: (p.y ?? p[1]) as number };
    };

    const wrist = lm(0);
    const thumbTip = lm(4);
    const indexTip = lm(8);
    const middleTip = lm(12);
    const ringTip = lm(16);
    const pinkyTip = lm(20);
    const indexMcp = lm(5);
    const middleMcp = lm(9);
    const ringMcp = lm(13);
    const pinkyMcp = lm(17);

    if (!wrist || !thumbTip || !indexTip || !middleTip || !ringTip || !pinkyTip ||
        !indexMcp || !middleMcp || !ringMcp || !pinkyMcp) {
      return { grip: state.lastGesture, confidence: 0, pointingDir: null };
    }

    const now = Date.now();
    state.wristHistory.push({ x: wrist.x, y: wrist.y, t: now });
    if (state.wristHistory.length > 20) state.wristHistory.shift();

    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    const handSize = dist(wrist, middleMcp);
    if (handSize < 0.01) return { grip: 'resting', confidence: 0.3, pointingDir: null };

    // Finger curl ratios (tip-to-MCP distance normalized by hand size)
    const indexCurl = dist(indexTip, indexMcp) / handSize;
    const middleCurl = dist(middleTip, middleMcp) / handSize;
    const ringCurl = dist(ringTip, ringMcp) / handSize;
    const pinkyCurl = dist(pinkyTip, pinkyMcp) / handSize;
    const thumbIndexDist = dist(thumbTip, indexTip) / handSize;

    const indexExtended = indexCurl > 0.6;
    const othersCurled = middleCurl < 0.4 && ringCurl < 0.4 && pinkyCurl < 0.4;
    const allCurled = indexCurl < 0.4 && middleCurl < 0.4 && ringCurl < 0.4 && pinkyCurl < 0.4;
    const allExtended = indexCurl > 0.5 && middleCurl > 0.5 && ringCurl > 0.5 && pinkyCurl > 0.5;

    // Classify grip
    let gesture: GripState;
    let confidence = 0.7;

    if (thumbIndexDist < 0.25 && !allCurled) {
      gesture = 'pincer_grasp';
      confidence = 0.9;
    } else if (indexExtended && othersCurled) {
      gesture = 'pointing';
      confidence = 0.9;
    } else if (allCurled && indexCurl < 0.25 && middleCurl < 0.25) {
      gesture = 'closed_fist';
      confidence = 0.85;
    } else if ([indexCurl, middleCurl, ringCurl, pinkyCurl].filter(c => c < 0.5 && c > 0.2).length >= 3) {
      gesture = 'power_grasp';
      confidence = 0.8;
    } else if (allExtended) {
      if (this.detectWavingForHand(state)) {
        gesture = 'waving';
        confidence = 0.85;
      } else {
        gesture = 'open';
        confidence = 0.8;
      }
    } else {
      if (this.detectReachingForHand(state)) {
        gesture = 'open';
        confidence = 0.6;
        if (state.lastGesture !== 'open') this.reachingEvents++;
      } else {
        gesture = 'resting';
        confidence = 0.5;
      }
    }

    // Count events on transitions (per hand)
    if (gesture !== state.lastGesture) {
      if (gesture === 'pointing') {
        this.pointingEvents++;
      }
      if (gesture === 'pincer_grasp') { this.pincerGraspEvents++; this.graspEvents++; }
      if (gesture === 'power_grasp') { this.powerGraspEvents++; this.graspEvents++; }
      if (gesture === 'waving') this.waveEvents++;
    }

    // Track grip history for grasp sequences
    state.gripHistory.push({ state: gesture, y: wrist.y, t: now });
    if (state.gripHistory.length > 30) state.gripHistory.shift();

    // Detect grasp sequence (open -> grip -> lift)
    this.detectGraspSequenceForHand(state);

    // Detect squeeze cycles
    state.squeezeHistory.push({ state: gesture, t: now });
    if (state.squeezeHistory.length > 45) state.squeezeHistory.shift();
    this.detectSqueezeCyclesForHand(state);

    // Pointing direction
    let pointingDir: { horizontal: string; vertical: string } | null = null;
    if (gesture === 'pointing') {
      const horizontal = indexTip.x < 0.33 ? 'left' : indexTip.x > 0.66 ? 'right' : 'center';
      const vertical = indexTip.y < 0.33 ? 'up' : indexTip.y > 0.66 ? 'down' : 'middle';
      pointingDir = { horizontal, vertical };
    }

    if (gesture === 'pointing' && state.lastGesture !== 'pointing') {
      console.log('[pointing] event #', this.pointingEvents, 'direction:', pointingDir);
    }
    state.lastGesture = gesture;
    return { grip: gesture, confidence, pointingDir };
  }

  private detectClapping(h1: any, h2: any): void {
    // Get center of palm (average of landmarks 0, 5, 9, 13, 17)
    const centerOf = (h: any): { x: number; y: number } | null => {
      const idx = [0, 5, 9, 13, 17];
      let sx = 0, sy = 0, n = 0;
      for (const i of idx) {
        const p = h[i] || h.keypoints?.[i];
        if (p) {
          sx += (p.x ?? p[0]) as number;
          sy += (p.y ?? p[1]) as number;
          n++;
        }
      }
      return n > 0 ? { x: sx / n, y: sy / n } : null;
    };

    const c1 = centerOf(h1);
    const c2 = centerOf(h2);
    if (!c1 || !c2) return;

    const d = Math.sqrt((c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2);
    const now = Date.now();
    this.handDistanceHistory.push({ d, t: now });
    if (this.handDistanceHistory.length > 20) this.handDistanceHistory.shift();

    // Clap: hands come close together (< 0.1) after being apart (> 0.2)
    if (this.handDistanceHistory.length >= 8) {
      const recent = this.handDistanceHistory.slice(-8);
      const maxD = Math.max(...recent.map(h => h.d));
      const minD = Math.min(...recent.map(h => h.d));
      if (maxD > 0.2 && minD < 0.1 && now - this.lastClapTime > 800) {
        this.clapEvents++;
        this.lastClapTime = now;
      }
    }
  }

  private detectReachingForHand(state: PerHandState): boolean {
    if (state.wristHistory.length < 8) return false;
    const oldest = state.wristHistory[state.wristHistory.length - 8];
    const newest = state.wristHistory[state.wristHistory.length - 1];
    return oldest.y - newest.y > 0.08;
  }

  private detectWavingForHand(state: PerHandState): boolean {
    if (state.wristHistory.length < 12) return false;
    const recent = state.wristHistory.slice(-12);
    let direction_changes = 0;
    let prevDx = 0;
    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].x - recent[i - 1].x;
      if (prevDx !== 0 && Math.sign(dx) !== Math.sign(prevDx) && Math.abs(dx) > 0.005) {
        direction_changes++;
      }
      if (Math.abs(dx) > 0.005) prevDx = dx;
    }
    return direction_changes >= 3;
  }

  private detectGraspSequenceForHand(state: PerHandState): void {
    if (state.gripHistory.length < 15) return;
    const recent = state.gripHistory.slice(-15);
    const early = recent.slice(0, 5);
    const mid = recent.slice(5, 10);
    const late = recent.slice(10);

    const wasOpen = early.some(h => h.state === 'open');
    const isGripping = mid.some(h => h.state === 'pincer_grasp' || h.state === 'power_grasp');
    const movedUp = late.length > 0 && early.length > 0 && late[late.length - 1].y < early[0].y - 0.05;

    if (wasOpen && isGripping && movedUp) {
      if (Date.now() - state.lastGraspTime > 2000) {
        this.successfulGrasps++;
        state.lastGraspTime = Date.now();
      }
    }

    const wasGripping = early.some(h => h.state === 'pincer_grasp' || h.state === 'power_grasp');
    const movedDown = late.length > 0 && early.length > 0 && late[late.length - 1].y > early[0].y + 0.05;
    const isOpen = late.some(h => h.state === 'open');

    if (wasGripping && movedDown && isOpen) {
      if (Date.now() - state.lastReleaseTime > 2000) {
        this.controlledReleases++;
        state.lastReleaseTime = Date.now();
      }
    }
  }

  private detectSqueezeCyclesForHand(state: PerHandState): void {
    if (state.squeezeHistory.length < 20) return;
    const recent = state.squeezeHistory.slice(-30);
    const recentTime = recent[recent.length - 1].t - recent[0].t;
    if (recentTime > 5000) return;

    let cycles = 0;
    let wasOpen = false;
    for (const h of recent) {
      if (h.state === 'open' && !wasOpen) wasOpen = true;
      if ((h.state === 'closed_fist' || h.state === 'power_grasp') && wasOpen) {
        cycles++;
        wasOpen = false;
      }
    }
    if (cycles >= 3) {
      if (Date.now() - state.lastSqueezeTime > 5000) {
        this.squeezeEvents++;
        state.lastSqueezeTime = Date.now();
      }
    }
  }

  private extractLandmarks(hand: any): Array<{ x: number; y: number }> {
    const result: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 21; i++) {
      const p = hand[i] || hand.keypoints?.[i];
      if (p) result.push({ x: p.x ?? p[0], y: p.y ?? p[1] });
    }
    return result;
  }

  private buildResult(
    handsCount: number,
    active: boolean,
    gesture: GripState,
    landmarks?: Array<{ x: number; y: number }>,
    allLandmarks?: Array<Array<{ x: number; y: number }>>,
    perHandGrips?: PerHandGrip[]
  ): AutoHandMetrics {
    return {
      hands_detected: handsCount,
      hand_active: active,
      current_gesture: gesture,
      grip_label: GRIP_LABELS[gesture] || '',
      reaching_events: this.reachingEvents,
      pointing_events: this.pointingEvents,
      grasp_events: this.graspEvents,
      pincer_grasp_events: this.pincerGraspEvents,
      power_grasp_events: this.powerGraspEvents,
      successful_grasps: this.successfulGrasps,
      controlled_releases: this.controlledReleases,
      wave_events: this.waveEvents,
      squeeze_events: this.squeezeEvents,
      hand_active_percentage: this.totalFrames > 0 ? (this.activeFrames / this.totalFrames) * 100 : 0,
      hand_landmarks: landmarks || null,
      all_hand_landmarks: allLandmarks || null,
      pointing_direction: this.lastPointingDir,
      clap_events: this.clapEvents,
      per_hand_grips: perHandGrips || [],
    };
  }

  reset(): void {
    this.reachingEvents = 0;
    this.pointingEvents = 0;
    this.graspEvents = 0;
    this.pincerGraspEvents = 0;
    this.powerGraspEvents = 0;
    this.successfulGrasps = 0;
    this.controlledReleases = 0;
    this.waveEvents = 0;
    this.squeezeEvents = 0;
    this.clapEvents = 0;
    this.handDistanceHistory = [];
    this.lastClapTime = 0;
    this.activeFrames = 0;
    this.totalFrames = 0;
    this.handStates = [];
    this.lastPointingDir = null;
  }
}
