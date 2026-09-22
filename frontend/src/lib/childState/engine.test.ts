import { describe, expect, it } from 'vitest';

import {
  CLINICAL_THRESHOLDS_SIGNED_OFF,
  ChildStateEngine,
  GsrBaseline,
  HOLD_DEESCALATE_MS,
  HOLD_ESCALATE_MS,
  type SecondBin,
} from './engine';

// Deterministic noise so every run is identical.
function noise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

const T0 = 1_700_000_000_000;

interface Calm { gsr?: number; hrv?: number; motion?: number; temp?: number; hr?: number }

// One calm second: GSR ~2400 (sd ~5), HRV ~60 ms, motion above the noise
// floor so it can score, skin 32 degC, HR 90 (plausible at age 6).
function calmBin(i: number, rnd: () => number, base: Calm = {}): SecondBin {
  return {
    secondAt: T0 + i * 1000,
    gsr: (base.gsr ?? 2400) + rnd() * 16,
    hrv: (base.hrv ?? 60) + rnd() * 8,
    motionEnergy: (base.motion ?? 0.04) + rnd() * 0.01,
    temp: base.temp ?? 32,
    hr: base.hr ?? 90,
    flapping: false,
  };
}

function engineWithBaseline(seconds = 90) {
  const engine = new ChildStateEngine(6);
  const rnd = noise(7);
  let i = 0;
  for (; i < seconds; i++) engine.update(calmBin(i, rnd));
  return { engine, rnd, next: () => i++ };
}

describe('child-state engine', () => {
  it('ships with the clinical flag off', () => {
    expect(CLINICAL_THRESHOLDS_SIGNED_OFF).toBe(false);
  });

  it('establishes a baseline for the first minute', () => {
    const engine = new ChildStateEngine(6);
    const rnd = noise(1);
    let r = engine.update(calmBin(0, rnd));
    for (let i = 1; i < 59; i++) r = engine.update(calmBin(i, rnd));
    expect(r.state).toBe('establishing');
    r = engine.update(calmBin(60, rnd));
    expect(r.state).not.toBe('establishing');
  });

  it('withholds every clinical state while thresholds are unsigned, but computes it', () => {
    const { engine, rnd, next } = engineWithBaseline();
    const r = engine.update(calmBin(next(), rnd));
    expect(r.provisional.state).toBe('regulated');
    expect(r.state).toBe('insufficient');
    expect(r.reason).toMatch(/not clinically signed off/);
  });

  it('escalates to amber only after the arousal has held for 12 s', () => {
    const { engine, rnd, next } = engineWithBaseline();
    const aroused = () => ({ ...calmBin(next(), rnd), gsr: 2460 }); // far above baseline: 2 points
    const first = engine.update(aroused());
    expect(first.contributions.gsr).toBe(2);
    expect(first.provisional.state).toBe('regulated');       // not yet: hold
    let r = first;
    for (let s = 1; s * 1000 < HOLD_ESCALATE_MS; s++) r = engine.update(aroused());
    expect(r.provisional.state).toBe('regulated');
    r = engine.update(aroused());
    expect(r.provisional.state).toBe('amber');
  });

  it('de-escalates only after calm has held for 30 s', () => {
    const { engine, rnd, next } = engineWithBaseline();
    for (let s = 0; s <= 13; s++) engine.update({ ...calmBin(next(), rnd), gsr: 2460 });
    let r = engine.update(calmBin(next(), rnd));
    expect(r.provisional.state).toBe('amber');
    for (let s = 1; s * 1000 < HOLD_DEESCALATE_MS; s++) r = engine.update(calmBin(next(), rnd));
    expect(r.provisional.state).toBe('amber');
    r = engine.update(calmBin(next(), rnd));
    expect(r.provisional.state).toBe('regulated');
  });

  it('never scores rising HRV as arousal', () => {
    const { engine, rnd, next } = engineWithBaseline();
    const r = engine.update({ ...calmBin(next(), rnd), hrv: 140 });
    expect(r.deviations.hrv).toBeGreaterThan(3);
    expect(r.contributions.hrv).toBe(0);
  });

  it('scores falling HRV, but not a drop too small in absolute terms', () => {
    const { engine, rnd, next } = engineWithBaseline();
    expect(engine.update({ ...calmBin(next(), rnd), hrv: 30 }).contributions.hrv).toBe(2); // -50%
    const steady = new ChildStateEngine(6);
    const r2 = noise(3);
    for (let i = 0; i < 90; i++) steady.update({ ...calmBin(i, r2), hrv: 60 + r2() * 0.4 });
    const small = steady.update({ ...calmBin(90, r2), hrv: 57 });                           // -5%
    expect(small.deviations.hrv).toBeLessThan(-3);
    expect(small.contributions.hrv).toBe(0);
  });

  it('excludes a missing signal instead of scoring it as calm', () => {
    const { engine, rnd, next } = engineWithBaseline();
    const r = engine.update({ ...calmBin(next(), rnd), hrv: null, motionEnergy: null });
    expect(r.contributions).toEqual({ gsr: expect.any(Number), hrv: null, motion: null });
    expect(r.validSignalCount).toBe(1);
    expect(r.provisional.state).toBe('insufficient');
    expect(r.provisional.score).toBeNull();
  });

  it('drops to insufficient at once when signals fail, without waiting for a hold', () => {
    const { engine, rnd, next } = engineWithBaseline();
    expect(engine.update(calmBin(next(), rnd)).provisional.state).toBe('regulated');
    const r = engine.update({ ...calmBin(next(), rnd), gsr: null, hrv: null });
    expect(r.provisional.state).toBe('insufficient');
  });

  it('excludes GSR and HRV while heavy movement corrupts them', () => {
    const { engine, rnd, next } = engineWithBaseline();
    const r = engine.update({ ...calmBin(next(), rnd), motionEnergy: 0.5, gsr: 2460, hrv: 30 });
    expect(r.contributions.gsr).toBeNull();
    expect(r.contributions.hrv).toBeNull();
    expect(r.contributions.motion).toBe(2);
    expect(r.reason).toMatch(/Movement is corrupting/);
  });

  it('treats a still limb as a valid zero, not as missing', () => {
    const { engine, rnd, next } = engineWithBaseline();
    const r = engine.update({ ...calmBin(next(), rnd), motionEnergy: 0.005 });
    expect(r.contributions.motion).toBe(0);
  });

  it('freezes the baselines while aroused, so sustained arousal stays visible', () => {
    const { engine, rnd, next } = engineWithBaseline();
    let r = engine.update({ ...calmBin(next(), rnd), gsr: 2460 });
    for (let s = 0; s < 120; s++) r = engine.update({ ...calmBin(next(), rnd), gsr: 2460 });
    expect(r.provisional.state).toBe('amber');
    expect(r.contributions.gsr).toBe(2);   // two minutes on, still far above baseline
  });

  it('skips a second that arrives after a newer one', () => {
    const { engine, rnd, next } = engineWithBaseline();
    const now = engine.update(calmBin(next(), rnd));
    const late = engine.update({ ...calmBin(0, rnd), gsr: 99999 });
    expect(late).toBe(now);
  });

  it('reports flapping without scoring it', () => {
    const { engine, rnd, next } = engineWithBaseline();
    const r = engine.update({ ...calmBin(next(), rnd), flapping: true });
    expect(r.flappingDetected).toBe(true);
    expect(r.provisional.state).toBe('regulated');
  });
});

describe('GSR temperature correction', () => {
  // Baseline where GSR follows skin temperature: +40 ADC per degC.
  function warmingBaseline() {
    const b = new GsrBaseline();
    const rnd = noise(11);
    for (let i = 0; i < 200; i++) {
      const temp = 31 + (i % 50) / 25;          // 31-33 degC
      b.add(2400 + 40 * (temp - 31) + rnd() * 4, temp);
    }
    return b;
  }

  it('learns the child’s own GSR-temperature slope', () => {
    expect(warmingBaseline().temperatureSlope).toBeCloseTo(40, 0);
  });

  it('does not score a GSR rise that warm skin explains', () => {
    const b = warmingBaseline();
    // 34 degC: warmer than anything in the baseline; GSR up by exactly
    // what temperature predicts.
    expect(Math.abs(b.z(2400 + 40 * 3, 34)!)).toBeLessThan(1);
  });

  it('still scores a GSR rise beyond what temperature explains', () => {
    const b = warmingBaseline();
    expect(b.z(2400 + 40 * 1 + 200, 32)!).toBeGreaterThan(3);
  });

  it('uses GSR uncorrected when temperature is missing', () => {
    const b = warmingBaseline();
    expect(b.corrected(2440, null)).toBe(2440);
  });
});
