import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Button from '../components/Button';
import Pill from '../components/Pill';
import { CVPipeline } from '../cv/CVPipeline';
import type { CVMetrics } from '../cv/CVPipeline';
import { CVAdapter, computeCompositeScore } from '../lib/measurement/cvAdapter';
import { countPending, clearAll } from '../lib/measurement/db';
import { start as startSync, stop as stopSync, flushNow, getLastSyncAt } from '../lib/measurement/sync';

const DIAG_SESSION_ID = '00000000-0000-0000-0000-000000000000';
const DIAG_ACTIVITY_ID = '00000000-0000-0000-0000-000000000001';

export default function CameraDiagnostics() {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pipelineRef = useRef<CVPipeline | null>(null);
  const adapterRef = useRef<CVAdapter | null>(null);
  const startTimeRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [permError, setPermError] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<CVMetrics | null>(null);
  const [compositeScore, setCompositeScore] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const audioLevel = latestMetrics?.audio_level ?? 0;
  const [samplingMode, setSamplingMode] = useState<string>('');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Poll pending count + last sync
  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      setPendingCount(await countPending());
      setLastSync(getLastSyncAt());
    }, 2000);
    return () => clearInterval(id);
  }, [running]);


  const handleStart = useCallback(async () => {
    setPermError(false);
    try {
      if (!videoRef.current) return;
      startTimeRef.current = Date.now();

      const pipeline = new CVPipeline();
      pipelineRef.current = pipeline;

      const status = await pipeline.initialize(videoRef.current, (m) => {
        setLatestMetrics(m);
        const sessionMin = (Date.now() - startTimeRef.current) / 60000;
        setCompositeScore(computeCompositeScore(m, sessionMin));
      });
      pipeline.start();

      const adapter = new CVAdapter();
      adapterRef.current = adapter;
      adapter.start({
        sessionId: DIAG_SESSION_ID,
        sessionActivityId: DIAG_ACTIVITY_ID,
        getMetrics: () => pipeline.getCurrentMetrics(),
      });

      setSamplingMode(status.faceMesh ? 'full' : 'trial-only');
      setRunning(true);
      startSync();
    } catch {
      setPermError(true);
    }
  }, []);

  const handleStop = useCallback(() => {
    pipelineRef.current?.stop();
    pipelineRef.current = null;
    adapterRef.current?.stop();
    adapterRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    stopSync();
    setRunning(false);
    setLatestMetrics(null);
    setCompositeScore(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pipelineRef.current?.stop();
      adapterRef.current?.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      stopSync();
    };
  }, []);

  const handleClear = async () => {
    if (!confirm(t('diag_clear_confirm'))) return;
    await clearAll();
    setPendingCount(0);
  };

  const compositeColor = compositeScore === 0
    ? 'bg-border'
    : compositeScore > 0.7
      ? 'bg-success/20 text-success'
      : compositeScore > 0.3
        ? 'bg-warning/20 text-warning'
        : 'bg-danger/20 text-danger';

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  const lastSyncText = !navigator.onLine
    ? t('diag_sync_offline')
    : lastSync
      ? t('diag_sync_last', { seconds: Math.round((now - lastSync.getTime()) / 1000) })
      : t('diag_sync_online');

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold text-ink-primary">{t('diag_camera_title')}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column — video + audio */}
        <div>
          <div className="relative overflow-hidden rounded-2xl bg-ink-primary">
            <video
              ref={videoRef}
              className="w-full scale-x-[-1]"
              playsInline
              muted
            />
            {!running && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-primary/80">
                <p className="text-sm text-ink-inverse">
                  {permError ? t('diag_permission_denied_title') : t('diag_camera_title')}
                </p>
              </div>
            )}
          </div>

          {/* VU meter */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-secondary">{t('diag_audio_level')}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary-500 transition-[width] duration-75"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </div>
            {latestMetrics && (
              <Pill variant={latestMetrics.voice_state !== 'silence' ? 'success' : 'neutral'}>
                {t('diag_audio_activity')}: {latestMetrics.voice_state !== 'silence' ? 'ON' : 'OFF'}
              </Pill>
            )}
          </div>

          {permError && (
            <div className="mt-4 rounded-lg border border-danger bg-danger/10 p-4">
              <p className="text-sm font-medium text-danger">{t('diag_permission_denied_title')}</p>
              <p className="mt-1 text-sm text-ink-secondary">{t('diag_permission_denied_body')}</p>
              <Button size="sm" className="mt-3" onClick={handleStart}>
                {t('diag_retry')}
              </Button>
            </div>
          )}
        </div>

        {/* Right column — readouts */}
        <div className="space-y-4">
          {/* Head pose */}
          <ReadoutCard label={t('diag_head_pose')}>
            {latestMetrics?.face_detected ? (
              <pre className="font-mono text-sm text-ink-primary">
                Y: {latestMetrics.face_yaw_degrees.toFixed(1)}°{'\n'}
                P: {latestMetrics.face_pitch_degrees.toFixed(1)}°{'\n'}
                State: {latestMetrics.face_state}
              </pre>
            ) : (
              <p className="text-sm text-ink-muted">—</p>
            )}
          </ReadoutCard>

          {/* Social Gaze */}
          <ReadoutCard label="Social Gaze">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-ink-primary">
                {latestMetrics ? `${latestMetrics.social_gaze_percentage.toFixed(0)}%` : '—'}
              </span>
              <span className="text-xs text-ink-secondary">
                {latestMetrics?.social_gaze_events ?? 0} events
              </span>
            </div>
          </ReadoutCard>

          {/* Audio */}
          <ReadoutCard label={t('diag_audio_activity')}>
            <div className="flex items-center gap-3">
              <Pill variant={latestMetrics?.voice_state !== 'silence' ? 'success' : 'neutral'}>
                {latestMetrics?.voice_state ?? 'Silent'}
              </Pill>
              <span className="font-mono text-sm text-ink-secondary">
                {t('diag_audio_level')}: {latestMetrics?.audio_level?.toFixed(2) ?? '—'}
              </span>
            </div>
          </ReadoutCard>

          {/* Composite */}
          <ReadoutCard label={t('diag_composite_engagement')}>
            <div className={clsx('inline-flex items-center rounded-lg px-4 py-2', compositeColor)}>
              <span className="text-2xl font-bold">
                {compositeScore > 0 ? compositeScore.toFixed(2) : '—'}
              </span>
            </div>
          </ReadoutCard>

          {/* Sampling mode */}
          <ReadoutCard label={t('diag_sampling_mode')}>
            <Pill variant={samplingMode === 'full' ? 'success' : 'warning'}>
              {samplingMode === 'full' ? t('diag_full_measurement') : t('diag_trial_only')}
            </Pill>
          </ReadoutCard>

          {/* Sync status */}
          <ReadoutCard label={t('diag_pending_count')}>
            <div className="space-y-1">
              <p className="font-mono text-sm text-ink-primary">{pendingCount}</p>
              <p className="text-xs text-ink-muted">{lastSyncText}</p>
            </div>
          </ReadoutCard>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {!running ? (
          <Button size="lg" onClick={handleStart}>
            {t('diag_start')}
          </Button>
        ) : (
          <Button size="lg" variant="danger" onClick={handleStop}>
            {t('diag_stop')}
          </Button>
        )}

        <button onClick={handleClear} className="text-sm text-ink-secondary hover:underline">
          {t('diag_clear_buffer')}
        </button>

        <button
          onClick={flushNow}
          className="text-sm text-primary-600 hover:underline"
        >
          {t('diag_force_sync')}
        </button>
      </div>
    </div>
  );
}

function ReadoutCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="mb-1 text-xs font-medium text-ink-secondary">{label}</p>
      {children}
    </div>
  );
}

