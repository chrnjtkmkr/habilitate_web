import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AudioSegmentTracker } from './AudioSegmentTracker';
import { PitchDetector } from './PitchDetector';
import type { PitchResult } from './PitchDetector';

const SAMPLE_RATE = 48_000;
const FRAME_SIZE = 2_048;

function harmonicFrame(f0: number, partials: Array<[multiple: number, amplitude: number]>): Float32Array {
  return Float32Array.from({ length: FRAME_SIZE }, (_, sample) => {
    const time = sample / SAMPLE_RATE;
    return partials.reduce(
      (value, [multiple, amplitude]) => value + amplitude * Math.sin(2 * Math.PI * f0 * multiple * time),
      0,
    );
  });
}

function pitch(classification: 'adult_voice' | 'child_voice', rmsLevel = 0.1): PitchResult {
  return { frequency: 300, confidence: 1, rmsLevel, classification };
}

describe('PitchDetector speaker boundaries', () => {
  it('separates adult female and child speech with the same F0 by >2500 Hz brightness', () => {
    const detector = new PitchDetector(SAMPLE_RATE);
    const adultFemale = detector.detectPitch(harmonicFrame(300, [[1, 0.12], [2, 0.02]]));
    const child = detector.detectPitch(harmonicFrame(300, [[1, 0.06], [10, 0.10]]));

    expect(adultFemale.frequency).toBeGreaterThanOrEqual(260);
    expect(adultFemale.frequency).toBeLessThanOrEqual(450);
    expect(adultFemale.brightnessScore).toBeLessThan(0.35);
    expect(adultFemale.classification).toBe('adult_voice');

    expect(child.frequency).toBeGreaterThanOrEqual(260);
    expect(child.frequency).toBeLessThanOrEqual(450);
    expect(child.brightnessScore).toBeGreaterThanOrEqual(0.35);
    expect(child.classification).toBe('child_voice');
  });

  it('classifies F0 below 250 Hz as adult voice and rejects sub--40 dBFS noise', () => {
    const detector = new PitchDetector(SAMPLE_RATE);
    expect(detector.detectPitch(harmonicFrame(200, [[1, 0.1]])).classification).toBe('adult_voice');
    expect(detector.detectPitch(harmonicFrame(300, [[1, 0.001]])).classification).toBe('background_noise');
  });
});

describe('AudioSegmentTracker word validation', () => {
  it('validates words after three frames and closes them after a 150ms pause', () => {
    const tracker = new AudioSegmentTracker();
    let adults = 0;
    let children = 0;
    tracker.onAdultSegment = () => adults++;
    tracker.onChildSegment = () => children++;

    for (let frame = 0; frame < 3; frame++) tracker.processFrame(pitch('adult_voice'), frame * 50);
    for (const timestamp of [150, 200, 250]) {
      tracker.processFrame({ ...pitch('adult_voice'), classification: 'background_noise', rmsLevel: 0.001 }, timestamp);
    }
    for (let frame = 0; frame < 3; frame++) tracker.processFrame(pitch('child_voice'), 200 + frame * 50);
    for (const timestamp of [350, 400, 450]) {
      tracker.processFrame({ ...pitch('child_voice'), classification: 'background_noise', rmsLevel: 0.001 }, timestamp);
    }

    expect(adults).toBe(1);
    expect(children).toBe(1);
  });

  it('splits continuous speech after a one-frame energy dip greater than 6 dB', () => {
    const tracker = new AudioSegmentTracker();
    let adults = 0;
    tracker.onAdultSegment = () => adults++;

    for (let frame = 0; frame < 3; frame++) tracker.processFrame(pitch('adult_voice'), frame * 50);
    tracker.processFrame(pitch('adult_voice', 0.04), 150); // 20 log10(0.04 / 0.1) < -6 dB
    for (let frame = 0; frame < 3; frame++) tracker.processFrame(pitch('adult_voice'), 200 + frame * 50);
    tracker.forceClose();

    expect(adults).toBe(2);
  });

  it('counts each validated word separately across a pause', () => {
    const tracker = new AudioSegmentTracker();
    let children = 0;
    tracker.onChildSegment = () => children++;

    for (let frame = 0; frame < 3; frame++) tracker.processFrame(pitch('child_voice'), frame * 50);
    for (const timestamp of [150, 200, 250]) {
      tracker.processFrame({ ...pitch('child_voice'), classification: 'noise', rmsLevel: 0.001 }, timestamp);
    }
    for (let frame = 0; frame < 3; frame++) tracker.processFrame(pitch('child_voice'), 300 + frame * 50);
    tracker.forceClose();

    expect(children).toBe(2);
  });

  it('ignores no-pitch frames without breaking a valid streak', () => {
    const tracker = new AudioSegmentTracker();
    let adults = 0;
    tracker.onAdultSegment = () => adults++;

    tracker.processFrame(pitch('adult_voice'), 0);
    tracker.processFrame({ ...pitch('adult_voice'), classification: 'no_pitch_detected' }, 50);
    tracker.processFrame(pitch('adult_voice'), 100);
    tracker.processFrame(pitch('adult_voice'), 150);
    tracker.forceClose();

    expect(adults).toBe(1);
  });
});

function readWavFrames(filePath: string): { sampleRate: number; frames: Float32Array[] } {
  const wav = readFileSync(filePath);
  const sampleRate = wav.readUInt32LE(24);
  const dataOffset = wav.indexOf(Buffer.from('data')) + 8;
  const samples = new Int16Array(wav.buffer, wav.byteOffset + dataOffset, (wav.length - dataOffset) / 2);
  const frames: Float32Array[] = [];
  for (let offset = 0; offset + FRAME_SIZE <= samples.length; offset += FRAME_SIZE) {
    frames.push(Float32Array.from(samples.slice(offset, offset + FRAME_SIZE), sample => sample / 32768));
  }
  return { sampleRate, frames };
}

describe('real speech diagnostics', () => {
  it('prints per-frame tables and observed ranges for labeled WAV samples', () => {
    const datasetRoot = resolve(process.cwd(), '../dataset');
    const summaries: Array<Record<string, string | number>> = [];

    for (const speaker of ['adult_speech', 'child_speech'] as const) {
      const files = readdirSync(resolve(datasetRoot, speaker))
        .filter(file => file.endsWith('.wav'))
        .sort()
        .slice(0, 10);
      const observations: Array<{ f0: number; brightness: number; rmsDbfs: number; classification: string }> = [];
      let childSegments = 0;
      let adultSegments = 0;

      for (const file of files) {
        const { sampleRate, frames } = readWavFrames(resolve(datasetRoot, speaker, file));
        const detector = new PitchDetector(sampleRate);
        const tracker = new AudioSegmentTracker();
        tracker.onChildSegment = () => childSegments++;
        tracker.onAdultSegment = () => adultSegments++;
        detector.setDebugLogging(file === files[0]);
        for (const [frameIndex, frame] of frames.entries()) {
          const result = detector.detectPitch(frame);
          tracker.processFrame(result, frameIndex * 50);
          if (result.rmsLevel >= Math.pow(10, -40 / 20)) {
            observations.push({
              f0: Number(result.frequency.toFixed(1)),
              brightness: Number((result.brightnessScore ?? 0).toFixed(4)),
              rmsDbfs: Number((20 * Math.log10(Math.max(result.rmsLevel, 1e-12))).toFixed(1)),
              classification: result.classification,
            });
          }
        }
      }

      console.log(`[Pitch diagnostics] ${speaker}`);
      console.table(observations.slice(0, 20));
      const f0s = observations.map(observation => observation.f0).filter(f0 => f0 > 0);
      const brightness = observations.map(observation => observation.brightness);
      const summary = {
        speaker,
        frames: observations.length,
        f0Min: Math.min(...f0s),
        f0Max: Math.max(...f0s),
        brightnessMin: Math.min(...brightness),
        brightnessMax: Math.max(...brightness),
      };
      console.log('[Pitch diagnostics range]', summary);
      console.log('[Segment diagnostics]', { speaker, childSegments, adultSegments });
      summaries.push(summary);
    }

    expect(summaries).toHaveLength(2);
  });
});
