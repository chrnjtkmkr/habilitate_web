import { assert, assertAlmostEquals, assertEquals } from "@std/assert";

import {
  ClockMap,
  detectFlapping,
  median,
  motionEnergy,
  SecondAggregator,
  type SecondRow,
} from "./aggregate.ts";

Deno.test("median of odd and even counts", () => {
  assertEquals(median([3, 1, 2]), 2);
  assertEquals(median([4, 1, 3, 2]), 2.5);
  assertEquals(median([]), null);
});

Deno.test("motion energy removes gravity and needs all three axes", () => {
  assertAlmostEquals(motionEnergy({ t: 0, ax: 0, ay: 0.6, az: 0.8 })!, 0, 1e-12);
  assertEquals(motionEnergy({ t: 0, ax: null, ay: 0, az: 1 }), null);
});

// 25 samples/s gyro: a sine on one axis at `hz`, noise on the others.
function gyroSine(hz: number, amplitude: number, seconds = 2) {
  const pts = [];
  for (let i = 0; i < seconds * 25; i++) {
    const t = i * 40;
    pts.push({ t, x: amplitude * Math.sin(2 * Math.PI * hz * t / 1000 + 0.3), y: Math.sin(i), z: Math.cos(i * 1.7) });
  }
  return pts;
}

Deno.test("flapping: 3 Hz reads as 3 Hz, not doubled", () => {
  const r = detectFlapping(gyroSine(3, 150))!;
  assertAlmostEquals(r.hz, 3, 0.35);
  assert(r.flapping);
});

Deno.test("flapping: slow waving (1 Hz) and fast tremor (8 Hz) are not flapping", () => {
  assert(!detectFlapping(gyroSine(1, 150))!.flapping);
  assert(!detectFlapping(gyroSine(8, 150))!.flapping);
});

Deno.test("flapping: a still band's noise never counts, whatever its crossing rate", () => {
  const still = gyroSine(3, 2);
  assert(!detectFlapping(still)!.flapping);
});

Deno.test("clock map keeps the smallest offset, so late packets cannot drag it", () => {
  const c = new ClockMap();
  c.observe(10_000, 1_000_000_100); // 100 ms latency
  c.observe(10_040, 1_000_000_160); // 120 ms
  c.observe(10_080, 1_000_000_580); // arrived half a second late
  assertEquals(c.toWall(20_000), 1_000_010_100);
});

function collect() {
  const rows: SecondRow[] = [];
  const clock = new ClockMap();
  clock.observe(0, 1_000_000);
  const agg = new SecondAggregator(clock, () => 42.5, (r) => rows.push(r));
  return { rows, agg };
}

Deno.test("one row per device second, with medians and the latest hrv", () => {
  const { rows, agg } = collect();
  for (let i = 0; i < 50; i++) {
    agg.add({ t: i * 40, ax: 0, ay: 0, az: 1, gx: 0, gy: 0, gz: 0, gsr: 2400 + (i % 5), temp: 31, hr: 72 });
  }
  agg.flush();
  assertEquals(rows.length, 2);
  assertEquals(rows[0].device_second, 0);
  assertEquals(rows[0].packets, 25);
  assertEquals(rows[0].gsr, 2402);
  assertEquals(rows[0].hrv, 42.5);
  assertEquals(rows[1].second_at, new Date(1_001_000).toISOString());
});

Deno.test("a sensor missing in most packets gives NULL for that second, not a number", () => {
  const { rows, agg } = collect();
  for (let i = 0; i < 25; i++) {
    agg.add({ t: i * 40, ax: null, ay: null, az: null, gsr: i < 5 ? 2400 : null, temp: 31, hr: -1 });
  }
  agg.flush();
  assertEquals(rows[0].gsr, null);
  assertEquals(rows[0].motion_energy, null);
  assertEquals(rows[0].hr, null);
  assertEquals(rows[0].temp, 31);
});

Deno.test("a packet from an already closed second is not folded into a later bin", () => {
  const { rows, agg } = collect();
  agg.add({ t: 100, gsr: 1 });
  agg.add({ t: 1100, gsr: 2 });  // closes second 0
  assert(!agg.add({ t: 900, gsr: 999 }));
  agg.flush();
  assertEquals(rows.map((r) => r.gsr), [1, 2]);
});
