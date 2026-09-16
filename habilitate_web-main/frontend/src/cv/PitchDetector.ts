/**
 * PitchDetector — Production-grade real-time voice classification engine.
 *
 * Signal chain (per 50 ms frame):
 *   Float32Array[2048] PCM  (from AnalyserNode.getFloatTimeDomainData)
 *   → RMS gate                  ignore frames below -40 dBFS
 *   → Crest factor gate         reject sharp impulsive transients (knocks, taps, claps)
 *   → Hann window               spectral leakage prevention
 *   → Radix-2 FFT               frequency-domain analysis
 *   → spectral energy ratio     brightness = E(>2500 Hz) / total energy
 *   → Normalized autocorrelation F0   80–600 Hz search
 *   → Harmonicity (HNR) gate    reject non-tonal / percussive content
 *   → Strict decision tree      adult_voice / child_voice
 */

export interface PitchResult {
  frequency: number;
  confidence: number;
  rmsLevel: number;
  classification:
    | 'child_voice'
    | 'adult_voice'
    | 'adult_male'
    | 'adult_female'
    | 'child_speaking'
    | 'adult_speaking'
    | 'both_speaking'
    | 'silence'
    | 'noise'
    | 'background_noise'
    | 'noise_whistle'
    | 'synthetic_tone_or_whistle'
    | 'no_pitch_detected';
  brightnessScore?: number;
  isStable?: boolean;
  /** Spectral Flatness Measure 0–1 (0 = tonal, 1 = white noise) */
  sfm?: number;
  spectralCentroid?: number;
  zcr?: number;
  /** Peak/RMS ratio in dB. High values indicate a sharp transient (knock/tap/clap). */
  crestFactorDb?: number;
  /** Harmonics-to-noise ratio in dB, derived from the normalized autocorrelation peak. */
  hnrDb?: number;
}

// ─── PitchDetector ─────────────────────────────────────────────────────────

export class PitchDetector {
  static readonly BRIGHTNESS_THRESHOLD = 0.05;
  private static readonly MIN_FREQUENCY_HZ = 80;
  private static readonly MAX_FREQUENCY_HZ = 600;
  /** Minimum harmonics-to-noise ratio (dB) required to treat a frame as voiced.
   *  Below this, content is non-tonal (percussive noise, taps, claps) and is
   *  discarded as background_noise rather than classified as speech. */
  private static readonly MIN_HNR_DB = 5;
  /** Maximum peak/RMS ratio (dB) allowed before a frame is treated as an
   *  impulsive transient (knock/tap/clap) rather than sustained voiced speech.
   *  Starting value — validate against real knock/tap samples and tune. */
  private static readonly MAX_CREST_FACTOR_DB = 20;

  private sampleRate: number;
  /** -40 dBFS expressed as linear RMS. */
  private readonly rmsFloor = Math.pow(10, -40 / 20);

  // TTS suppression
  private lastSpeechEndTime: number | null = null;
  private wasSpeaking: boolean = false;

  // Hann window coefficient cache
  private hannCoeffs: Float32Array | null = null;
  private hannN: number = 0;

  private debugLogging = false;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
  }

  setDebugLogging(enabled: boolean): void {
    this.debugLogging = enabled;
  }

  detectPitch(audioData: Float32Array): PitchResult {
    const N = audioData.length;

    const emit = (
      cls: PitchResult['classification'],
      rms = 0, freq = 0, conf = 0,
      brightness = 0, sfm = 0,
      centroid = 0, zcr = 0,
      crestFactorDb = 0, hnrDb = 0
    ): PitchResult => ({
      frequency: freq,
      confidence: conf,
      rmsLevel: rms,
      classification: this.updatePersistence(cls),
      brightnessScore: brightness,
      sfm,
      spectralCentroid: centroid,
      zcr,
      crestFactorDb,
      hnrDb
    });

    // ── TTS guard ─────────────────────────────────────────────────────────
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (synth && (synth.speaking || synth.pending)) {
      this.wasSpeaking = true;
      return emit('silence');
    }
    if (synth && !synth.speaking && !synth.pending && this.wasSpeaking) {
      this.lastSpeechEndTime = Date.now();
      this.wasSpeaking = false;
    }
    if (this.lastSpeechEndTime && Date.now() - this.lastSpeechEndTime < 1000) {
      return emit('silence');
    }

    // ── 1. RMS gate + peak tracking: ignore frames below -40 dBFS ─────────
    let sumSq = 0;
    let peakAbs = 0;
    for (let i = 0; i < N; i++) {
      const s = audioData[i];
      sumSq += s * s;
      const a = Math.abs(s);
      if (a > peakAbs) peakAbs = a;
    }
    const rms = Math.sqrt(sumSq / N);

    if (rms < this.rmsFloor) {
      const result = emit('background_noise', rms);
      this.logFrame(result);
      return result;
    }

    // ── 2. Crest factor gate: reject sharp impulsive transients ───────────
    // Knocks, taps, and claps have a very short, sharp peak against a
    // otherwise-quiet frame — a much higher peak/RMS ratio than sustained
    // voiced speech. This must run before FFT/autocorrelation so obvious
    // percussive hits never reach classification at all.
    const crestFactorDb = 20 * Math.log10((peakAbs / (rms + 1e-12)) + 1e-12);
    if (crestFactorDb > PitchDetector.MAX_CREST_FACTOR_DB) {
      const result = emit('background_noise', rms, 0, 0, 0, 0, 0, 0, crestFactorDb, 0);
      this.logFrame(result);
      return result;
    }

    // ── 3. Zero-Crossing Rate (ZCR) ───────────────────────────────────────
    let zeroCrossings = 0;
    for (let i = 1; i < N; i++) {
      if ((audioData[i] >= 0 && audioData[i - 1] < 0) || (audioData[i] < 0 && audioData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const zcr = zeroCrossings / N;

    // ── 4. Hann window & FFT ──────────────────────────────────────────────
    const windowed = this.applyHannWindow(audioData);
    const fftResult = this.computeFFT(windowed);
    
    const { 
      sfm, spectralCentroid, eAbove2k5_ratio
    } = this.analyzeSpectrum(fftResult, N);

    // ── 5. Normalized autocorrelation F0 (80–600 Hz) ─────────────────────
    const minLag = Math.floor(this.sampleRate / PitchDetector.MAX_FREQUENCY_HZ);
    const maxLag = Math.floor(this.sampleRate / PitchDetector.MIN_FREQUENCY_HZ);
    let bestCorr = 0;
    let bestLag = 0;
    for (let lag = minLag; lag <= maxLag && lag < N; lag++) {
      let corr = 0, n1 = 0, n2 = 0;
      for (let i = 0; i < N - lag; i++) {
        corr += audioData[i] * audioData[i + lag];
        n1   += audioData[i] * audioData[i];
        n2   += audioData[i + lag] * audioData[i + lag];
      }
      const nc = corr / (Math.sqrt(n1 * n2) + 1e-10);
      if (nc > bestCorr) { bestCorr = nc; bestLag = lag; }
    }
    const frequency = bestLag > 0 ? this.sampleRate / bestLag : 0;
    const confidence = bestCorr;

    // Harmonics-to-noise ratio derived from the normalized autocorrelation
    // peak: HNR(dB) = 10*log10(r / (1-r)). A knock's decaying resonance can
    // clear a raw-correlation bar of ~0.3 easily; requiring HNR >= 3dB (r
    // ~= 0.666) is what the original spec actually called for.
    const r = Math.min(Math.max(bestCorr, 0), 0.999999);
    const hnrDb = 10 * Math.log10(r / (1 - r) + 1e-12);

    if (
      !Number.isFinite(frequency)
      || frequency <= 0
      || hnrDb < PitchDetector.MIN_HNR_DB
    ) {
      const result = emit('no_pitch_detected', rms, frequency, confidence, eAbove2k5_ratio, sfm, spectralCentroid, zcr, crestFactorDb, hnrDb);
      this.logFrame(result);
      return result;
    }

    // Reject aerodynamic and broadband noise based on spectral flatness.
    if (sfm > 0.4) {
      const result = emit('background_noise', rms, frequency, confidence, eAbove2k5_ratio, sfm, spectralCentroid, zcr, crestFactorDb, hnrDb);
      this.logFrame(result);
      return result;
    }

    // If the signal crosses zero more like white noise than a voice wave,
    // reject the autocorrelation peak as a false pitch.
    if (zcr > 0.25 && hnrDb < 10) {
      const result = emit('background_noise', rms, frequency, confidence, eAbove2k5_ratio, sfm, spectralCentroid, zcr, crestFactorDb, hnrDb);
      this.logFrame(result);
      return result;
    }

    // ── 6. Classification ─────────────────────────────────────────────────
    // Do not add per-detector persistence here. The tracker owns the exact
    // three-frame (150 ms) validation window.
    const classification = this.classify(frequency, eAbove2k5_ratio, zcr, hnrDb);

    const result = emit(classification, rms, frequency, confidence, eAbove2k5_ratio, sfm, spectralCentroid, zcr, crestFactorDb, hnrDb);
    this.logFrame(result);
    return result;
  }

  setSilenceThreshold(threshold?: number): void {
    // Kept for API compatibility. The required -40 dBFS threshold is fixed.
    void threshold;
  }

  // ── Classification decision tree ──────────────────────────────────────────

  private classify(
    f0: number,
    brightnessScore: number,
    zcr: number,
    hnrDb: number,
  ): PitchResult['classification'] {
    // If the signal crosses zero more like white noise than a voice wave.
    if (zcr > 0.25 && hnrDb < 10) return 'background_noise';

    // Adult male
    if (f0 < 250) return 'adult_voice';

    // Explicitly keep the 250–260 Hz transition in the adult class.
    if (f0 < 260) return 'adult_voice';

    // Adult female / child speaking: the brightness definition is exactly
    // E(>2500 Hz) / total spectral energy.
    if (f0 >= 260 && f0 <= 450) {
      return brightnessScore < PitchDetector.BRIGHTNESS_THRESHOLD ? 'adult_voice' : 'child_voice';
    }

    // High-pitched mechanical whines must still have child-like brightness.
    if (f0 > 450) return brightnessScore >= 0.25 ? 'child_voice' : 'background_noise';

    return 'no_pitch_detected';
  }

  private logFrame(result: PitchResult): void {
    if (!this.debugLogging) return;
    console.debug('[PitchDetector frame]', {
      f0: Number(result.frequency.toFixed(1)),
      brightness: Number((result.brightnessScore ?? 0).toFixed(4)),
      rmsDbfs: Number((20 * Math.log10(Math.max(result.rmsLevel, 1e-12))).toFixed(1)),
      rms: Number(result.rmsLevel.toFixed(6)),
      confidence: Number(result.confidence.toFixed(3)),
      crestFactorDb: Number((result.crestFactorDb ?? 0).toFixed(1)),
      hnrDb: Number((result.hnrDb ?? 0).toFixed(1)),
      classification: result.classification,
    });
  }

  // ── Signal processing ─────────────────────────────────────────────────────

  private applyHannWindow(buffer: Float32Array): Float32Array {
    const N = buffer.length;
    if (this.hannN !== N || !this.hannCoeffs) {
      this.hannCoeffs = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        this.hannCoeffs[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
      }
      this.hannN = N;
    }
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = buffer[i] * this.hannCoeffs[i];
    return out;
  }

  private analyzeSpectrum(
    fftResult: { real: Float32Array; imag: Float32Array },
    N: number,
  ) {
    const halfN = N >> 1;
    let sfmLogSum = 0, sfmLinSum = 0, sfmBins = 0;
    
    let totalEnergy = 0;
    let centroidNum = 0;
    let eAbove2k5 = 0;

    for (let k = 0; k < halfN; k++) {
      const freq = (k * this.sampleRate) / N;
      const mag2 = fftResult.real[k] ** 2 + fftResult.imag[k] ** 2;
      totalEnergy += mag2;
      
      centroidNum += freq * mag2;
      
      if (freq >= 2500) eAbove2k5 += mag2;
      
      if (freq >= 300 && freq <= 4000) {
        const v = mag2 + 1e-12;
        sfmLogSum += Math.log(v);
        sfmLinSum += v;
        sfmBins++;
      }
    }

    const spectralCentroid = totalEnergy > 0 ? centroidNum / totalEnergy : 0;
    const eAbove2k5_ratio = totalEnergy > 0 ? eAbove2k5 / totalEnergy : 0;
    const sfm = sfmBins > 0
      ? Math.min(1, Math.exp(sfmLogSum / sfmBins) / (sfmLinSum / sfmBins + 1e-12))
      : 0;

    return { 
      sfm, spectralCentroid, eAbove2k5_ratio,
    };
  }

  private computeFFT(buffer: Float32Array): { real: Float32Array; imag: Float32Array } {
    const N = buffer.length;
    const real = new Float32Array(buffer);
    const imag = new Float32Array(N);

    let j = 0;
    for (let i = 0; i < N - 1; i++) {
      if (i < j) { const t = real[i]; real[i] = real[j]; real[j] = t; }
      let k = N >> 1;
      while (k <= j) { j -= k; k >>= 1; }
      j += k;
    }

    for (let len = 2; len <= N; len <<= 1) {
      const halfLen = len >> 1;
      const ang = (-2 * Math.PI) / len;
      const wsr = Math.cos(ang), wsi = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let wr = 1, wi = 0;
        for (let k = 0; k < halfLen; k++) {
          const p = i + k, q = i + k + halfLen;
          const ur = real[p], ui = imag[p];
          const vr = real[q] * wr - imag[q] * wi;
          const vi = real[q] * wi + imag[q] * wr;
          real[p] = ur + vr; imag[p] = ui + vi;
          real[q] = ur - vr; imag[q] = ui - vi;
          const nwr = wr * wsr - wi * wsi;
          wi = wr * wsi + wi * wsr; wr = nwr;
        }
      }
    }
    return { real, imag };
  }

  private updatePersistence(rawState: PitchResult['classification']): PitchResult['classification'] {
    return rawState;
  }
}