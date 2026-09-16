import type { PitchResult } from './PitchDetector';

type SpeakerClass = 'adult_voice' | 'child_voice';

export class AudioSegmentTracker {
  private static readonly REQUIRED_FRAMES = 3;
  private static readonly WORD_HANG_TIME_MS = 150;
  private static readonly ENERGY_DIP_RATIO = Math.pow(10, -6 / 20);
  private static readonly RMS_FLOOR = Math.pow(10, -40 / 20);

  onChildSegment: (segmentStartMs: number, segmentEndMs: number) => void = () => {};
  onAdultSegment: (segmentStartMs: number, segmentEndMs: number) => void = () => {};

  private frameBuffer: SpeakerClass[] = [];
  private activeSpeaker: SpeakerClass | null = null;
  private segmentStartTime: number | null = null;
  private lastValidSpeechTime: number | null = null;
  private lastRmsLevel: number | null = null;

  processFrame(pitch: PitchResult, timestampMs = Date.now()): void {
    const isNoPitch = pitch.classification === 'no_pitch_detected';
    const currentClass = this.speakerClass(pitch.classification);
    const isSilenceOrNoise = pitch.rmsLevel < AudioSegmentTracker.RMS_FLOOR
      || (!currentClass && !isNoPitch)
      || pitch.classification.includes('noise');

    // A no-pitch frame is inconclusive and must not break a valid streak.
    if (isNoPitch) return;

    if (
      this.activeSpeaker !== null
      && currentClass === this.activeSpeaker
      && !isSilenceOrNoise
      && this.lastRmsLevel !== null
      && pitch.rmsLevel < this.lastRmsLevel * AudioSegmentTracker.ENERGY_DIP_RATIO
    ) {
      this.emitWord(timestampMs);
    }

    this.lastRmsLevel = pitch.rmsLevel;

    if (currentClass) {
      if (this.activeSpeaker !== null && currentClass !== this.activeSpeaker) {
        this.emitWord(timestampMs);
      }

      if (this.frameBuffer.length > 0 && this.frameBuffer[0] !== currentClass) {
        this.frameBuffer = [];
      }
      this.frameBuffer.push(currentClass);
      if (this.frameBuffer.length > AudioSegmentTracker.REQUIRED_FRAMES) {
        this.frameBuffer.shift();
      }

      const wordValidated = this.frameBuffer.length === AudioSegmentTracker.REQUIRED_FRAMES
        && this.frameBuffer.every(frameClass => frameClass === currentClass);
      if (wordValidated) {
        if (this.activeSpeaker === null) {
          this.activeSpeaker = currentClass;
          this.segmentStartTime = timestampMs - (AudioSegmentTracker.REQUIRED_FRAMES - 1) * 50;
        }
        this.lastValidSpeechTime = timestampMs;
      }
      return;
    }

    this.frameBuffer = [];
    if (
      isSilenceOrNoise
      && this.activeSpeaker !== null
      && this.lastValidSpeechTime !== null
      && timestampMs - this.lastValidSpeechTime >= AudioSegmentTracker.WORD_HANG_TIME_MS
    ) {
      this.emitWord(this.lastValidSpeechTime);
    }
  }

  forceClose(): void {
    if (this.activeSpeaker !== null && this.lastValidSpeechTime !== null) {
      this.emitWord(this.lastValidSpeechTime);
    }
    this.reset();
  }

  private emitWord(endTimeMs: number): void {
    if (this.activeSpeaker === null || this.segmentStartTime === null) return;

    const endTime = Math.max(endTimeMs, this.segmentStartTime + 150);
    if (this.activeSpeaker === 'child_voice') {
      this.onChildSegment(this.segmentStartTime, endTime);
    } else {
      this.onAdultSegment(this.segmentStartTime, endTime);
    }

    this.activeSpeaker = null;
    this.segmentStartTime = null;
    this.lastValidSpeechTime = null;
    this.frameBuffer = [];
  }

  private speakerClass(classification: PitchResult['classification']): SpeakerClass | null {
    if (classification === 'adult_voice' || classification === 'adult_male' || classification === 'adult_female') {
      return 'adult_voice';
    }
    if (classification === 'child_voice' || classification === 'child_speaking') return 'child_voice';
    return null;
  }

  private reset(): void {
    this.frameBuffer = [];
    this.activeSpeaker = null;
    this.segmentStartTime = null;
    this.lastValidSpeechTime = null;
    this.lastRmsLevel = null;
  }
}
