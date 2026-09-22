/* =====================================================================
 * Child State Engine
 * =====================================================================
 * Decides whether a child is regulated, amber, or dysregulated from the
 * band's signals, one second at a time.
 *
 * Adapted from the CTO's childStateEngine.ts. The design rules are
 * unchanged; the input and a few mechanics were corrected (see "CHANGES
 * FROM THE ORIGINAL" at the bottom).
 *
 * DESIGN RULES - do not change these without Dr. Anant's sign-off.
 *
 *   1. Every child is compared only to their own baseline. No absolute
 *      thresholds, no population norms, no age-based cutoffs. Age is used
 *      only as a plausibility filter, never for state.
 *   2. Direction must match arousal: GSR up, HRV down, motion up.
 *      A signal moving the wrong way scores nothing.
 *   3. At least two valid signals must agree. One signal is noise.
 *   4. A state change must persist before it is reported.
 *   5. An invalid signal is EXCLUDED, never scored zero.
 *   6. The engine returns 'establishing' or 'insufficient' rather than
 *      guessing. A dark card is honest; an unearned green card is not.
 * =====================================================================
 */

// =====================================================================
// 1. TYPES
// =====================================================================

/** One second of device time (a public.band_seconds row). Built by the
 *  wearable-ws Edge Function from that second's ~25 packets. null means
 *  the sensor gave no valid reading for most of that second. */
export interface SecondBin {
  secondAt: number;            // start of the second, epoch ms (real time)
  gsr: number | null;          // median raw ADC, uncalibrated
  temp: number | null;         // median skin temperature, degC
  motionEnergy: number | null; // median | |a| - 1 g |, in g
  hr: number | null;           // median bpm
  hrv: number | null;          // RMSSD, ms (computed in Postgres)
  flapping: boolean;           // 2-5 Hz rhythmic movement (gyroscope)
}

export type ChildState =
  | 'establishing'    // baseline not yet formed
  | 'insufficient'    // fewer than two valid signals, or state withheld
  | 'regulated'
  | 'amber'
  | 'dysregulated';

export interface StateResult {
  /** What the product may show. While CLINICAL_THRESHOLDS_SIGNED_OFF is
   *  false this is never regulated/amber/dysregulated. */
  state: ChildState;
  /** The state the engine would report with signed-off thresholds, with
   *  the same hold timers. Until sign-off the session header shows it to
   *  the therapist as a marked, unvalidated estimate (dashed, "not
   *  validated"), recorded as source 'band_estimate' for validation.
   *  Never shown to parents or in reports. */
  provisional: { state: ChildState; score: number | null };
  validSignalCount: number;
  contributions: {
    gsr: number | null;              // null = excluded, not zero
    hrv: number | null;
    motion: number | null;
  };
  deviations: {                      // robust z vs this child's baseline
    gsr: number | null;              // after temperature correction
    hrv: number | null;
    motion: number | null;
  };
  flappingDetected: boolean;         // reported, never scores
  baselineSeconds: number;           // largest baseline, for "establishing"
  secondAt: number;
  reason: string;                    // why this state, for the audit log
}

// =====================================================================
// 2. CONSTANTS
// =====================================================================

/* ---------------------------------------------------------------------
 * THRESHOLDS REQUIRING CLINICAL SIGN-OFF
 *
 * None of these are validated for 3-8 year olds on a wrist device during
 * live therapy. They must be set from our own labelled sessions, with
 * Dr. Anant marking what he observed against the timeline.
 *
 * While CLINICAL_THRESHOLDS_SIGNED_OFF is false the engine will not
 * report regulated / amber / dysregulated. This is deliberate.
 * ------------------------------------------------------------------- */
export const CLINICAL_THRESHOLDS_SIGNED_OFF = false;

/** Robust z units: 2 SD is the wearable-EDA convention; MAD x 1.4826
 *  makes one robust z unit comparable to one SD. ADULT-DERIVED. */
export const DEVIATION_1_POINT = 2.0;   // PROVISIONAL - adult-derived
export const DEVIATION_2_POINT = 3.0;   // PROVISIONAL - adult-derived

/** HRV must also fall at least this far below baseline, in percent, so a
 *  very steady rhythm (tiny MAD) cannot score on a trivial change.
 *  Schneider et al. ~35% SDNN; acute stress RMSSD ~62%. */
export const HRV_MIN_PERCENT_DROP = 20;  // PROVISIONAL - adult-derived

export const SCORE_AMBER_MIN = 2;        // PROVISIONAL - requires sign-off
export const SCORE_DYSREG_MIN = 4;       // PROVISIONAL - requires sign-off

/* Structural constants: these follow from the physiology and the
 * measurement, not from clinical judgement. */

export const MIN_VALID_SIGNALS = 2;

/** One-second bins: one minute before any state, ten-minute window. */
export const BASELINE_MIN_SAMPLES = 60;
export const BASELINE_WINDOW = 600;

/** Escalation is faster than de-escalation: catching the rise early is
 *  the clinical value; flicker back to green destroys trust. */
export const HOLD_ESCALATE_MS = 12_000;
export const HOLD_DEESCALATE_MS = 30_000;

/** Motion above this robust z invalidates GSR and pulse for that second. */
export const MOTION_INVALIDATES_AT_Z = 2.5;

/** Below this (g) the limb is still, whatever the z score says.
 *  Production data from a stationary band (MPU-6500): median 0.0055 g,
 *  90th percentile 0.015 g. VERIFY ON A STILL WRIST. */
export const MOTION_NOISE_FLOOR_G = 0.02;

/** +1 if more sweat reads as a HIGHER ADC value, -1 if lower. Depends on
 *  the GSR module's divider. VERIFY ON THE BENCH (grip the electrodes). */
export const GSR_AROUSAL_DIRECTION: 1 | -1 = 1;

/** Temperature correction of GSR (see GsrBaseline). Needs this many
 *  paired seconds and this much temperature spread in the baseline
 *  before a slope is estimated; otherwise GSR is scored uncorrected. */
export const GSR_TEMP_MIN_PAIRS = 60;
export const GSR_TEMP_MIN_SPREAD_C = 0.3;

/** Age is used ONLY to reject impossible readings, never to set state. */
export const HR_PLAUSIBLE: Record<string, [number, number]> = {
  '3-5': [80, 160],
  '6-12': [65, 140],
  '13+': [50, 130],
};
/** Unknown age: only reject what no child could produce. */
export const HR_PLAUSIBLE_UNKNOWN_AGE: [number, number] = [50, 200];

/** Skin temperature outside this range is a bus glitch, not a child. */
export const TEMP_PLAUSIBLE: [number, number] = [20.0, 45.0];

// =====================================================================
// 3. ROBUST BASELINE
// =====================================================================

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median + MAD over the last BASELINE_WINDOW one-second values. The
 *  median ignores a movement artefact that would drag a mean. */
export class RobustBaseline {
  private samples: number[] = [];

  add(value: number): void {
    if (!Number.isFinite(value)) return;
    this.samples.push(value);
    if (this.samples.length > BASELINE_WINDOW) this.samples.shift();
  }

  get count(): number { return this.samples.length; }
  get isReady(): boolean { return this.samples.length >= BASELINE_MIN_SAMPLES; }
  values(): readonly number[] { return this.samples; }

  median(): number { return this.samples.length ? medianOf(this.samples) : NaN; }

  /** MAD scaled to be comparable to a standard deviation. */
  mad(): number {
    if (!this.samples.length) return NaN;
    const med = this.median();
    return medianOf(this.samples.map((v) => Math.abs(v - med))) * 1.4826;
  }

  /** Robust z. Positive means above this child's own baseline. */
  z(value: number): number | null {
    if (!this.isReady || !Number.isFinite(value)) return null;
    const scale = this.mad();
    // A flat signal (MAD ~ 0) would turn any change into a huge z: an
    // artefact of stillness, not a deviation. Decline to score.
    if (!Number.isFinite(scale) || scale < 1e-6) return null;
    return (value - this.median()) / scale;
  }

  reset(): void { this.samples = []; }
}

/**
 * GSR baseline with skin-temperature correction.
 *
 * Warmer skin conducts better and sweats more, so room heat raises GSR
 * without any arousal. The part of GSR explained by temperature is
 * removed using this child's own relation between the two:
 *
 *   gsr_corrected = gsr - slope * (temp - baseline median temp)
 *
 * slope is the Theil-Sen estimate (median of pairwise slopes, robust to
 * artefacts) over the baseline's paired seconds. With too few pairs or
 * too little temperature variation there is no relation to learn, and
 * GSR is used uncorrected. Temperature never scores by itself.
 */
export class GsrBaseline {
  private pairs: Array<{ gsr: number; temp: number | null }> = [];
  private slope = 0;
  private tempMedian: number | null = null;
  private sinceFit = 0;

  add(gsr: number, temp: number | null): void {
    if (!Number.isFinite(gsr)) return;
    this.pairs.push({ gsr, temp: temp !== null && Number.isFinite(temp) ? temp : null });
    if (this.pairs.length > BASELINE_WINDOW) this.pairs.shift();
    if (++this.sinceFit >= 10) this.fit();
  }

  get count(): number { return this.pairs.length; }
  get isReady(): boolean { return this.pairs.length >= BASELINE_MIN_SAMPLES; }
  get temperatureSlope(): number { return this.slope; }

  private fit(): void {
    this.sinceFit = 0;
    const paired = this.pairs.filter((p): p is { gsr: number; temp: number } => p.temp !== null);
    if (paired.length < GSR_TEMP_MIN_PAIRS) { this.slope = 0; this.tempMedian = null; return; }
    const temps = paired.map((p) => p.temp);
    this.tempMedian = medianOf(temps);
    if (Math.max(...temps) - Math.min(...temps) < GSR_TEMP_MIN_SPREAD_C) { this.slope = 0; return; }
    // Every 4th pair keeps the pairwise count small (~11k for 600 s).
    const sample = paired.filter((_, i) => i % 4 === 0);
    const slopes: number[] = [];
    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        const dt = sample[j].temp - sample[i].temp;
        if (Math.abs(dt) >= 0.05) slopes.push((sample[j].gsr - sample[i].gsr) / dt);
      }
    }
    this.slope = slopes.length ? medianOf(slopes) : 0;
  }

  corrected(gsr: number, temp: number | null): number {
    if (this.slope === 0 || this.tempMedian === null || temp === null) return gsr;
    return gsr - this.slope * (temp - this.tempMedian);
  }

  /** Robust z of the corrected value against the corrected baseline. */
  z(gsr: number, temp: number | null): number | null {
    if (!this.isReady) return null;
    const base = new RobustBaseline();
    for (const p of this.pairs) base.add(this.corrected(p.gsr, p.temp));
    return base.z(this.corrected(gsr, temp));
  }

  reset(): void { this.pairs = []; this.slope = 0; this.tempMedian = null; this.sinceFit = 0; }
}

// =====================================================================
// 4. HELPERS
// =====================================================================

function ageBand(ageYears: number): keyof typeof HR_PLAUSIBLE {
  if (ageYears <= 5) return '3-5';
  if (ageYears <= 12) return '6-12';
  return '13+';
}

/** Age is a plausibility filter only. It never influences state. */
export function isHrPlausible(hr: number | null, ageYears: number | null): boolean {
  if (hr === null || !Number.isFinite(hr)) return false;
  const [lo, hi] = ageYears === null ? HR_PLAUSIBLE_UNKNOWN_AGE : HR_PLAUSIBLE[ageBand(ageYears)];
  return hr >= lo && hr <= hi;
}

function isTempPlausible(temp: number | null): temp is number {
  return temp !== null && Number.isFinite(temp) && temp >= TEMP_PLAUSIBLE[0] && temp <= TEMP_PLAUSIBLE[1];
}

/** Maps a deviation, in the arousal direction, to 0, 1 or 2 points. */
function deviationPoints(zInArousalDirection: number): number {
  if (zInArousalDirection >= DEVIATION_2_POINT) return 2;
  if (zInArousalDirection >= DEVIATION_1_POINT) return 1;
  return 0;
}

const SEVERITY: Record<ChildState, number> = {
  establishing: 0, insufficient: 0, regulated: 1, amber: 2, dysregulated: 3,
};
const isClaim = (s: ChildState) => s === 'regulated' || s === 'amber' || s === 'dysregulated';

// =====================================================================
// 5. STATE ENGINE
// =====================================================================

export class ChildStateEngine {
  private gsrBaseline = new GsrBaseline();
  private hrvBaseline = new RobustBaseline();
  private motionBaseline = new RobustBaseline();

  private currentState: ChildState = 'establishing';
  private candidateState: ChildState | null = null;
  private candidateSinceMs: number | null = null;
  private lastSecondAt: number | null = null;
  private last: StateResult | null = null;
  private readonly ageYears: number | null;

  constructor(ageYears: number | null) {
    this.ageYears = ageYears;
  }

  /** Warms the baselines from recent history (e.g. the last ten minutes
   *  after a page reload) without scoring or holding anything. */
  seed(history: SecondBin[]): void {
    for (const bin of [...history].sort((a, b) => a.secondAt - b.secondAt)) {
      const motionZ = bin.motionEnergy !== null && bin.motionEnergy >= MOTION_NOISE_FLOOR_G
        ? this.motionBaseline.z(bin.motionEnergy) : null;
      const corrupt = motionZ !== null && motionZ >= MOTION_INVALIDATES_AT_Z;
      if (bin.motionEnergy !== null) this.motionBaseline.add(bin.motionEnergy);
      if (!corrupt && bin.gsr !== null) this.gsrBaseline.add(bin.gsr, isTempPlausible(bin.temp) ? bin.temp : null);
      if (!corrupt && bin.hrv !== null && isHrPlausible(bin.hr, this.ageYears)) this.hrvBaseline.add(bin.hrv);
      this.lastSecondAt = bin.secondAt;
    }
  }

  update(bin: SecondBin): StateResult {
    // Bins are timestamped by the band's clock, so the timeline stays
    // correct when rows arrive late. A second older than the newest one
    // already scored cannot be scored again without corrupting the hold
    // timers, so it is skipped.
    if (this.lastSecondAt !== null && bin.secondAt <= this.lastSecondAt && this.last) {
      return this.last;
    }
    this.lastSecondAt = bin.secondAt;
    const nowMs = bin.secondAt;

    // Freeze the baselines while the child is aroused, so sustained
    // arousal is not absorbed as the new normal. Judged on the
    // provisional state, which is the only one that can be aroused while
    // thresholds are unsigned (otherwise the baseline would never freeze
    // during validation sessions and would chase the arousal).
    const frozen = this.currentState === 'amber' || this.currentState === 'dysregulated';

    // ---- Motion first: it decides whether the others can be trusted --
    const energy = bin.motionEnergy;
    const isStill = energy !== null && energy < MOTION_NOISE_FLOOR_G;
    const motionZ = energy !== null && !isStill ? this.motionBaseline.z(energy) : null;
    const movementCorrupts = motionZ !== null && motionZ >= MOTION_INVALIDATES_AT_Z;
    if (energy !== null && !frozen) this.motionBaseline.add(energy);

    let motionPoints: number | null = null;
    if (isStill) motionPoints = 0;                     // still is a valid reading
    else if (motionZ !== null) motionPoints = deviationPoints(motionZ);

    // ---- GSR (temperature-corrected) ---------------------------------
    const temp = isTempPlausible(bin.temp) ? bin.temp : null;
    let gsrPoints: number | null = null;
    let gsrZ: number | null = null;
    if (bin.gsr !== null && !movementCorrupts) {
      const z = this.gsrBaseline.z(bin.gsr, temp);
      if (z !== null) {
        gsrZ = GSR_AROUSAL_DIRECTION * z;
        gsrPoints = deviationPoints(gsrZ);
      }
      if (!frozen) this.gsrBaseline.add(bin.gsr, temp);
    }

    // ---- HRV ---------------------------------------------------------
    let hrvPoints: number | null = null;
    let hrvZ: number | null = null;
    if (bin.hrv !== null && !movementCorrupts && isHrPlausible(bin.hr, this.ageYears)) {
      const z = this.hrvBaseline.z(bin.hrv);
      if (z !== null) {
        hrvZ = z;
        // Arousal is a FALL in HRV (negative z). Rising HRV never scores.
        const candidate = deviationPoints(-z);
        if (candidate > 0) {
          const base = this.hrvBaseline.median();
          const percentDrop = base > 0 ? ((base - bin.hrv) / base) * 100 : 0;
          hrvPoints = percentDrop >= HRV_MIN_PERCENT_DROP ? candidate : 0;
        } else {
          hrvPoints = 0;
        }
      }
      if (!frozen) this.hrvBaseline.add(bin.hrv);
    }

    // ---- Decide ------------------------------------------------------
    const contributions = { gsr: gsrPoints, hrv: hrvPoints, motion: motionPoints };
    const deviations = { gsr: gsrZ, hrv: hrvZ, motion: motionZ };
    const validCount = [gsrPoints, hrvPoints, motionPoints].filter((p) => p !== null).length;
    const baselineSeconds = Math.max(this.gsrBaseline.count, this.hrvBaseline.count, this.motionBaseline.count);
    const common = { validSignalCount: validCount, contributions, deviations,
      flappingDetected: bin.flapping, baselineSeconds, secondAt: nowMs };

    let target: ChildState;
    let score: number | null = null;
    let reason: string;
    if (!this.gsrBaseline.isReady && !this.hrvBaseline.isReady && !this.motionBaseline.isReady) {
      target = 'establishing';
      reason = `Baseline forming (gsr ${this.gsrBaseline.count}, hrv ${this.hrvBaseline.count}, motion ${this.motionBaseline.count} of ${BASELINE_MIN_SAMPLES} s)`;
    } else if (validCount < MIN_VALID_SIGNALS) {
      target = 'insufficient';
      reason = movementCorrupts
        ? 'Movement is corrupting the sensors; too few trustworthy signals'
        : `Only ${validCount} valid signal(s); at least ${MIN_VALID_SIGNALS} required`;
    } else {
      score = (gsrPoints ?? 0) + (hrvPoints ?? 0) + (motionPoints ?? 0);
      target = score >= SCORE_DYSREG_MIN ? 'dysregulated' : score >= SCORE_AMBER_MIN ? 'amber' : 'regulated';
      reason = `Score ${score} from ${validCount} valid signal(s)`;
    }

    const provisional = this.hold(target, nowMs);
    const provisionalScore = provisional === target ? score : null;

    let state = provisional;
    if (!CLINICAL_THRESHOLDS_SIGNED_OFF && isClaim(provisional)) {
      state = 'insufficient';
      reason = `Thresholds not clinically signed off; state is withheld by design (${reason})`;
    }

    this.last = { state, provisional: { state: provisional, score: provisionalScore }, reason, ...common };
    return this.last;
  }

  /** Hold timers: a claim changes only after the new claim has persisted.
   *  Entering a non-claim state (establishing / insufficient) is
   *  immediate, so a state the sensors no longer support clears at once. */
  private hold(target: ChildState, nowMs: number): ChildState {
    if (target === this.currentState) {
      this.candidateState = null;
      this.candidateSinceMs = null;
      return this.currentState;
    }
    if (!isClaim(target) || !isClaim(this.currentState)) {
      this.currentState = target;
      this.candidateState = null;
      this.candidateSinceMs = null;
      return this.currentState;
    }
    if (this.candidateState !== target) {
      this.candidateState = target;
      this.candidateSinceMs = nowMs;
    }
    const escalating = SEVERITY[target] > SEVERITY[this.currentState];
    const required = escalating ? HOLD_ESCALATE_MS : HOLD_DEESCALATE_MS;
    if (nowMs - (this.candidateSinceMs ?? nowMs) >= required) {
      this.currentState = target;
      this.candidateState = null;
      this.candidateSinceMs = null;
    }
    return this.currentState;
  }

  get state(): ChildState { return this.currentState; }
}

/* =====================================================================
 * CHANGES FROM THE ORIGINAL (childStateEngine.ts)
 * =====================================================================
 * - Input is one bin per second of device time (median of ~25 packets),
 *   built server-side. The original scored single packets against a
 *   baseline of one-second medians; single packets vary far more, which
 *   inflated every z score and made motion invalidate GSR and HRV far
 *   too often.
 * - z is computed against the baseline BEFORE the current second is
 *   added, so a spike is not part of its own reference.
 * - Flapping comes from the gyroscope (signed axis, 2-5 Hz, with an
 *   amplitude gate), computed server-side. The original counted zero
 *   crossings of | |a| - 1 g |, which doubles the frequency, and had no
 *   amplitude gate, so sensor noise could read as flapping.
 * - Temperature now corrects GSR (GsrBaseline); the original only
 *   defined an unused TEMP_PLAUSIBLE constant.
 * - Time is the band's clock mapped to real time, so late or
 *   out-of-order rows keep their true place on the timeline.
 * - Baselines freeze on the provisional state, which is the only state
 *   that can show arousal while thresholds are unsigned.
 * - With unknown age, HR plausibility uses a wide 50-200 bpm range.
 * - The would-be state is exposed as `provisional` for validation
 *   sessions; `state` never shows a claim until sign-off.
 * ===================================================================== */
