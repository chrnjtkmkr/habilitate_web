// Turns the band's ~25 packets per second into one row per second of
// device time (public.band_seconds), which the child-state engine scores.
// Pure logic, no I/O, so it can be unit-tested (aggregate_test.ts).

export type Sample = {
  t: number;              // band clock, ms since boot
  ax?: number | null;
  ay?: number | null;
  az?: number | null;
  gx?: number | null;
  gy?: number | null;
  gz?: number | null;
  temp?: number | null;
  gsr?: number | null;
  hr?: number | null;
};

export type SecondRow = {
  device_second: number;
  second_at: string;        // ISO, real time
  packets: number;
  gsr: number | null;
  temp: number | null;
  motion_energy: number | null;
  hr: number | null;
  hrv: number | null;
  gyro_sd: number | null;
  flap_hz: number | null;
  flapping: boolean;
};

// A field's median is only reported if at least half the second's packets
// carried it; otherwise the second has no valid reading for that sensor.
export const MIN_VALID_FRACTION = 0.5;

// Hand-flapping: rhythmic movement at 2-5 Hz (reported, never scored).
export const FLAP_MIN_HZ = 2.0;
export const FLAP_MAX_HZ = 5.0;
export const FLAP_WINDOW_MS = 2000;
// Below this the axis is not really moving, and its zero crossings are
// sensor noise (a still band reads ~1 dps). VERIFY ON THE BENCH.
export const FLAP_MIN_GYRO_SD_DPS = 30;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function validMedian(values: (number | null | undefined)[], packets: number): number | null {
  const valid = values.filter(isNum);
  return valid.length >= MIN_VALID_FRACTION * packets ? median(valid) : null;
}

// | |a| - 1 g |: movement with gravity removed, independent of orientation.
export function motionEnergy(s: Sample): number | null {
  if (!isNum(s.ax) || !isNum(s.ay) || !isNum(s.az)) return null;
  return Math.abs(Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az) - 1);
}

type GyroPoint = { t: number; x: number; y: number; z: number };

// Dominant frequency of the most active gyroscope axis over the window.
// The signed axis is used, never a magnitude: rectifying (|a| - 1 g, or
// |omega|) turns each movement cycle into two peaks and doubles the
// apparent frequency, which is what the earlier accelerometer version did.
export function detectFlapping(points: GyroPoint[]): { sd: number; hz: number; flapping: boolean } | null {
  if (points.length < 20) return null;
  const spanS = (points[points.length - 1].t - points[0].t) / 1000;
  if (spanS <= 0) return null;

  let best: number[] = [];
  let bestVar = -1;
  for (const axis of ["x", "y", "z"] as const) {
    const v = points.map((p) => p[axis]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length;
    if (variance > bestVar) {
      bestVar = variance;
      best = v.map((x) => x - mean);
    }
  }

  let crossings = 0;
  for (let i = 1; i < best.length; i++) {
    if (best[i - 1] * best[i] < 0) crossings++;
  }
  const hz = crossings / 2 / spanS;
  const sd = Math.sqrt(bestVar);
  return { sd, hz, flapping: sd >= FLAP_MIN_GYRO_SD_DPS && hz >= FLAP_MIN_HZ && hz <= FLAP_MAX_HZ };
}

// Maps the band clock (ms since boot) to real time for one connection.
// arrival - t is the band-to-server latency plus a constant offset; the
// smallest value seen is the best estimate of that offset, so late or
// bunched-up packets can never drag the mapping.
export class ClockMap {
  private offset: number | null = null;

  observe(tMs: number, arrivalMs: number): void {
    const candidate = arrivalMs - tMs;
    if (this.offset === null || candidate < this.offset) this.offset = candidate;
  }

  toWall(tMs: number): number | null {
    return this.offset === null ? null : this.offset + tMs;
  }
}

export class SecondAggregator {
  private second: number | null = null;
  private samples: Sample[] = [];
  private gyro: GyroPoint[] = [];

  constructor(
    private readonly clock: ClockMap,
    private readonly latestHrv: () => number | null,
    private readonly onRow: (row: SecondRow) => void,
  ) {}

  // Returns false for a packet from a second that was already closed
  // (it is still stored raw, just not part of a finished bin).
  add(s: Sample): boolean {
    const sec = Math.floor(s.t / 1000);
    if (this.second !== null && sec < this.second) return false;
    if (this.second !== null && sec > this.second) this.flush();
    if (this.second === null) this.second = sec;

    this.samples.push(s);
    if (isNum(s.gx) && isNum(s.gy) && isNum(s.gz)) {
      this.gyro.push({ t: s.t, x: s.gx, y: s.gy, z: s.gz });
      const cutoff = s.t - FLAP_WINDOW_MS;
      while (this.gyro.length && this.gyro[0].t < cutoff) this.gyro.shift();
    }
    return true;
  }

  flush(): void {
    if (this.second === null || this.samples.length === 0) {
      this.second = null;
      return;
    }
    const packets = this.samples.length;
    const wall = this.clock.toWall(this.second * 1000);
    const flap = detectFlapping(this.gyro);
    if (wall !== null) {
      this.onRow({
        device_second: this.second,
        second_at: new Date(wall).toISOString(),
        packets,
        gsr: validMedian(this.samples.map((x) => x.gsr), packets),
        temp: validMedian(this.samples.map((x) => x.temp), packets),
        motion_energy: validMedian(this.samples.map(motionEnergy), packets),
        hr: validMedian(this.samples.map((x) => (isNum(x.hr) && x.hr > 0 ? x.hr : null)), packets),
        hrv: this.latestHrv(),
        gyro_sd: flap?.sd ?? null,
        flap_hz: flap?.hz ?? null,
        flapping: flap?.flapping ?? false,
      });
    }
    this.second = null;
    this.samples = [];
  }
}
