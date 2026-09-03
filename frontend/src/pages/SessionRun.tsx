import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { differenceInMonths } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useScrollLock } from '../hooks/useScrollLock';
import {
  useSession,
  useSessionActivities,
  useEndSessionActivity,
  useStartSessionActivity,
  useUpdateSessionActivityNotes,
} from '../lib/queries/sessions';
import { useActiveGoals } from '../lib/queries/goals';
import { useCreateTrial, useTrialsBySession } from '../lib/queries/trials';
import { useCreateSessionEvent } from '../lib/queries/sessionEvents';
import { useRecommendPlan, useAcceptPlan } from '../lib/queries/planRecommender';
import { useToast } from '../lib/toastStore';
import { CVPipeline } from '../cv/CVPipeline';
import type { CVMetrics } from '../cv/CVPipeline';
import { ResponseToNameDetector } from '../cv/ResponseToNameDetector';
import type { RTNCandidate } from '../cv/ResponseToNameDetector';
import CVCanvas from '../components/session/CVCanvas';
import { CVAdapter, computeCompositeScore } from '../lib/measurement/cvAdapter';
import { useAttributeConfig, useChildPersonalBests } from '../lib/queries/attributes';
import { useInsertManualProbe } from '../lib/queries/probes';
import { domainI18nKeys } from '../lib/domainLabels';
import { getDomainIcon, getSimplifiedGoal, getHelpLadder, pickField, pickArrayField, formatAgeRange } from '../lib/activity/content';
import { useActivityLookup } from '../lib/queries/activities';
import ActivityPicker from '../components/ActivityPicker';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Pill from '../components/Pill';
import Skeleton from '../components/Skeleton';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import type { RecommendedActivity } from '../lib/planRecommender/types';

type TrialResponse = Database['public']['Enums']['trial_response'];

type ChildState = 'regulated' | 'amber' | 'dysregulated';

const CHILD_STATES: { value: ChildState; i18nKey: string; captionKey: string; descKey: string; seeKey: string }[] = [
  { value: 'regulated', i18nKey: 'child_state_regulated', captionKey: 'child_state_caption_regulated', descKey: 'child_state_regulated_desc', seeKey: 'child_state_regulated_see' },
  { value: 'amber', i18nKey: 'child_state_amber', captionKey: 'child_state_caption_amber', descKey: 'child_state_amber_desc', seeKey: 'child_state_amber_see' },
  { value: 'dysregulated', i18nKey: 'child_state_dysregulated', captionKey: 'child_state_caption_dysregulated', descKey: 'child_state_dysregulated_desc', seeKey: 'child_state_dysregulated_see' },
];

export default function SessionRun() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, memberships } = useAuth();
  const centerId = memberships[0]?.center_id ?? '';

  const toast = useToast((s) => s.add);
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';

  const { data: session, isLoading: sessionLoading } = useSession(sessionId);
  const { data: sessionActivities } = useSessionActivities(sessionId);
  const { data: activeGoals } = useActiveGoals(session?.child?.id);
  // Fetch existing trials for resume after refresh
  const { data: existingTrials } = useTrialsBySession(
    session?.status === 'in_progress' ? sessionId : undefined,
  );

  // Phase: 'preflight' | 'live'
  const [phase, setPhase] = useState<'preflight' | 'live'>('preflight');

  // Preflight state
  const [mediaStatus, setMediaStatus] = useState<'none' | 'granted' | 'denied'>('none');
  const [measurementStatus, setMeasurementStatus] = useState<'loading' | 'ready' | 'trial-only'>('loading');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [planEdits, setPlanEdits] = useState<RecommendedActivity[] | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Live state
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [, setCompositeScore] = useState(0.5);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [showNotes, setShowNotes] = useState(false);
  useScrollLock(showNotes);
  const [noteText, setNoteText] = useState('');
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Single-selection state per activity: stores the ONE active TrialResponse or null.
  // Replaces the old cumulative counter map — clicking a response overwrites the
  // previous selection for that activity; clicking the same response toggles it off.
  const [stepResponses, setStepResponses] = useState<Record<string, TrialResponse | null>>({});
  const [trialPending, setTrialPending] = useState(false);
  // Ref mirrors stepResponses to avoid stale closures in rapid-tap scenarios
  const stepResponsesRef = useRef(stepResponses);
  useEffect(() => { stepResponsesRef.current = stepResponses; }, [stepResponses]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMetrics, setShowMetrics] = useState(false);
  const [narrowHintDismissed] = useState(() => localStorage.getItem('habilitate_narrow_hint_dismissed') === '1');

  // CV Pipeline state
  const [cvMetrics, setCvMetrics] = useState<CVMetrics | null>(null);
  const cvMetricsLatestRef = useRef<CVMetrics | null>(null);
  const [frozenMetrics, setFrozenMetrics] = useState<CVMetrics | null>(null);
  const displayMetrics = isPaused ? frozenMetrics : cvMetrics;
  const [cvStatus, setCvStatus] = useState<{ camera: boolean; microphone: boolean; faceMesh: boolean; hands: boolean } | null>(null);

  const preflightVideoRef = useRef<HTMLVideoElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const cvPipelineRef = useRef<CVPipeline | null>(null);
  const cvAdapterRef = useRef<CVAdapter | null>(null);
  const cvInitializedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const engagementSamplesRef = useRef<{ time: number; score: number }[]>([]);
  const startTimeRef = useRef(0);

  // Response-to-name detection
  const { data: rtnConfig } = useAttributeConfig('response_to_name');
  // Personal best detection — gaze only
  const { data: gazeConfig } = useAttributeConfig('looks_at_you');
  const { data: childBests } = useChildPersonalBests(session?.child?.id);
  const [gazeBestNotice, setGazeBestNotice] = useState(false);
  const gazeBestFiredRef = useRef(false); // once per activity
  const rtnDetectorRef = useRef<ResponseToNameDetector | null>(null);
  const insertProbe = useInsertManualProbe(sessionId);

  // Stable refs for RTN probe writes (avoids stale closures in CV callback)
  const insertProbeRef = useRef(insertProbe);
  useEffect(() => { insertProbeRef.current = insertProbe; }, [insertProbe]);
  const childIdRef = useRef(session?.child?.id);
  useEffect(() => { childIdRef.current = session?.child?.id; }, [session?.child?.id]);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Instantiate RTN detector when config loads
  useEffect(() => {
    if (!rtnConfig) return;
    const cfg = rtnConfig as Record<string, unknown>;
    const detector = new ResponseToNameDetector({
      windowMs: typeof cfg.window_ms === 'number' ? cfg.window_ms : 3000,
      validAngleDeg: typeof cfg.valid_angle_deg === 'number' ? cfg.valid_angle_deg : 30,
      debug: import.meta.env.DEV,
    });
    rtnDetectorRef.current = detector;
    if (import.meta.env.DEV) console.log('[RTN-diag] detector CREATED | config:', cfg);
    return () => { rtnDetectorRef.current = null; };
  }, [rtnConfig]);

  const sessionDuration = session?.duration_minutes ?? 45;
  const { data: recommendedPlan, isLoading: planLoading } = useRecommendPlan(
    sessionId,
    session?.child?.id,
    sessionDuration,
    session?.discipline_id,
  );
  const acceptPlan = useAcceptPlan(centerId);

  // Capture the original AI plan before any therapist edits
  const originalPlanRef = useRef<typeof recommendedPlan | null>(null);
  useEffect(() => {
    if (recommendedPlan && !originalPlanRef.current) {
      originalPlanRef.current = recommendedPlan;
    }
  }, [recommendedPlan]);

  // Derived plan: use edits if therapist has modified, otherwise use recommended
  const planActivities = planEdits ?? recommendedPlan?.activities ?? [];
  const setPlanActivities = setPlanEdits;

  // Lookup activity metadata (name, domain, duration) for all plan IDs.
  // The recommender's activityNames only covers validated catalogue activities,
  // so therapist-added and custom activities would show their ID instead.
  const planActivityIds = useMemo(
    () => (planEdits ?? recommendedPlan?.activities ?? []).map((pa) => pa.activityId),
    [planEdits, recommendedPlan?.activities],
  );
  const { data: activityLookup = {} } = useActivityLookup(planActivityIds);

  // Therapist inputs
  const [childState, setChildState] = useState<ChildState>('regulated');
  const [spontPulse, setSpontPulse] = useState(false);
  const [spontMoments, setSpontMoments] = useState<number[]>([]);
  const [spontSuggestPulse, setSpontSuggestPulse] = useState(false);
  const [showSpontOnboarding, setShowSpontOnboarding] = useState(() => !localStorage.getItem('habilitate_spont_onboarded'));
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [showChildStateInfo, setShowChildStateInfo] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const lastTrialTimeRef = useRef(0);
  const lastSpontTimeRef = useRef(0);
  const prevChildSoundsRef = useRef(0);
  const [lastTrialResponse, setLastTrialResponse] = useState<string | null>(null);

  const endActivityMut = useEndSessionActivity();
  const startActivityMut = useStartSessionActivity();
  const createTrial = useCreateTrial();
  const createSessionEvent = useCreateSessionEvent();
  const updateNotes = useUpdateSessionActivityNotes();

  // Resume session after refresh: detect in_progress session with existing activities.
  // Guard: only runs when phase is still 'preflight' — once we enter 'live', never re-runs.
  const applyResume = useCallback((
    resumeIndex: number,
    responses: Record<string, TrialResponse | null>,
  ) => {
    setCurrentActivityIndex(resumeIndex);
    setStepResponses(responses);
    stepResponsesRef.current = responses;
    setPhase('live');
  }, []);

  useEffect(() => {
    if (phase !== 'preflight') return;
    if (!session || !sessionActivities || session.status !== 'in_progress') return;
    if (sessionActivities.length === 0) return;
    // Wait for existingTrials to load — without this, trialCounts initializes empty
    if (!existingTrials) return;

    // Find the current activity: first with started_at but no ended_at
    const inProgressIdx = sessionActivities.findIndex(sa => sa.started_at && !sa.ended_at);
    const pendingIdx = sessionActivities.findIndex(sa => !sa.started_at);
    const resumeIndex = inProgressIdx >= 0 ? inProgressIdx : pendingIdx >= 0 ? pendingIdx : -1;

    if (resumeIndex < 0) {
      navigate(`/sessions/${sessionId}/summary`, { replace: true });
      return;
    }

    // Rebuild stepResponses from existing trials: each activity keeps only the
    // last recorded response (most-recent trial wins as the active selection).
    const responses: Record<string, TrialResponse | null> = {};
    for (const trial of existingTrials) {
      const saId = trial.session_activity_id;
      responses[saId] = trial.response as TrialResponse;
    }

    // Schedule outside synchronous effect to satisfy lint rule
    queueMicrotask(() => applyResume(resumeIndex, responses));
  }, [phase, session, sessionActivities, existingTrials, sessionId, navigate, applyResume]);

  // Keep cvMetrics ref in sync for use in event handlers with stale closures
  useEffect(() => { cvMetricsLatestRef.current = cvMetrics; }, [cvMetrics]);

  // Online/offline tracking
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Initialize CV pipeline when entering live phase
  useEffect(() => {
    if (phase !== 'live' || cvInitializedRef.current) return;
    const video = liveVideoRef.current;
    if (!video || !sessionId) return;

    // Stop preflight stream — CVPipeline manages its own camera
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    const pipeline = new CVPipeline();
    cvPipelineRef.current = pipeline;
    cvInitializedRef.current = true;

    cvAdapterRef.current = new CVAdapter();

    startTimeRef.current = Date.now();

    const initCV = async () => {
      // If no AudioContext was created inside a click handler (e.g. session
      // resume after refresh), create one now. It may start suspended, but
      // the visibilitychange handler in ChildVoiceTracker will resume it
      // on the next user interaction.
      if (!audioContextRef.current) {
        const ctx = new AudioContext();
        ctx.resume().catch(() => {});
        audioContextRef.current = ctx;
      }

      const status = await pipeline.initialize(video, (m) => {
        setCvMetrics(m);
        if (!isPausedRef.current) {
          const sessionMin = (Date.now() - startTimeRef.current) / 60000;
          const score = computeCompositeScore(m, sessionMin);
          setCompositeScore(score);
          engagementSamplesRef.current.push({ time: Date.now(), score });

          // Response-to-name detection
          const detector = rtnDetectorRef.current;
          const cId = childIdRef.current;
          const sId = sessionIdRef.current;
          if (detector && cId && sId) {
            const candidate: RTNCandidate | null = detector.tick(m);
            if (candidate) {
              insertProbeRef.current.mutate({
                session_id: sId,
                child_id: cId,
                attribute_id: 'response_to_name',
                method: 'system_auto',
                therapist_confirmed: false,
                valid: true,
                captured_at: candidate.capturedAt,
                raw: {
                  latency_ms: candidate.latencyMs,
                  orientation: candidate.looked ? 'looked' : 'did_not_look',
                  target: 'therapist',
                  detection: 'plausible_moment',
                },
                score: candidate.looked ? 1 : 0,
              });
            }
          }
        }
      }, audioContextRef.current ?? undefined);
      setCvStatus(status);
      setMeasurementStatus(status.faceMesh ? 'ready' : 'trial-only');
      pipeline.start();
    };

    initCV();

    return () => {
      pipeline.stop();
      cvAdapterRef.current?.stop();
      cvInitializedRef.current = false;
    };
  }, [phase, sessionId]);

  // Start the adapter only once we have a real session_activity_id.
  // Deferred start avoids writing samples with pending_activity_link: true.
  const adapterStartedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'live') return;
    if (!cvAdapterRef.current || !cvPipelineRef.current) return;
    if (adapterStartedRef.current) return;
    if (!sessionActivities || sessionActivities.length === 0) return;
    if (!sessionId) return;

    const firstActivityId = sessionActivities[0].id;
    cvAdapterRef.current.start({
      sessionId,
      sessionActivityId: firstActivityId,
      getMetrics: () => cvPipelineRef.current!.getCurrentMetrics(),
    });
    adapterStartedRef.current = true;
  }, [phase, sessionActivities, sessionId]);

  // When the therapist advances to a different activity, update the adapter
  useEffect(() => {
    if (!adapterStartedRef.current || !cvAdapterRef.current) return;
    if (!sessionActivities || sessionActivities.length === 0) return;
    const currentId = sessionActivities[currentActivityIndex]?.id;
    if (currentId) {
      cvAdapterRef.current.updateSessionActivityId(currentId);
    }
  }, [currentActivityIndex, sessionActivities]);

  // Visibility change: pause/resume
  useEffect(() => {
    function handleVisibility() {
      if (phase !== 'live') return;
      if (document.hidden) {
        setIsPaused(true);
        isPausedRef.current = true;
        setFrozenMetrics(cvMetricsLatestRef.current);
        cvAdapterRef.current?.pause();
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase]);

  // Session timer
  useEffect(() => {
    if (phase !== 'live' || isPaused) return;
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cvPipelineRef.current?.stop();
      cvAdapterRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function requestMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setMediaStatus('granted');
      if (preflightVideoRef.current) {
        preflightVideoRef.current.srcObject = stream;
      }
    } catch {
      setMediaStatus('denied');
    }
  }

  async function handleStartSession() {
    if (!user || !sessionId || !originalPlanRef.current) return;

    // Create and resume AudioContext synchronously inside this click handler.
    // Browsers require AudioContext.resume() to be called within a user gesture's
    // synchronous call stack. After await boundaries the gesture is no longer active.
    const audioCtx = new AudioContext();
    audioCtx.resume().catch(() => {});
    audioContextRef.current = audioCtx;

    const wasEdited = planEdits !== null;
    try {
      await acceptPlan.mutateAsync({
        sessionId,
        originalPlan: originalPlanRef.current,
        finalActivities: planActivities,
        wasEdited,
        actorId: user.id,
      });
      // Mark the first activity as started so resume logic can find it after refresh.
      // acceptPlan just inserted the activity rows; fetch the first one's ID to start it.
      const { data: newActivities } = await supabase
        .from('session_activities')
        .select('id')
        .eq('session_id', sessionId)
        .order('ordering')
        .limit(1);
      if (newActivities?.[0]) {
        await startActivityMut.mutateAsync({ sessionActivityId: newActivities[0].id });
      }
      setPhase('live');
      // Record initial child state
      createSessionEvent.mutate({
        sessionId,
        eventType: 'state_change',
        stateValue: 'regulated',
        recordedByUserId: user.id,
      });
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  function handleChildStateChange(newState: ChildState) {
    if (isPaused || newState === childState || !sessionId || !user) return;
    setChildState(newState);
    createSessionEvent.mutate({
      sessionId,
      sessionActivityId: currentActivity?.id ?? null,
      eventType: 'state_change',
      stateValue: newState,
      recordedByUserId: user.id,
    });
  }

  function handleMovePlanActivity(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= planActivities.length) return;
    const updated = [...planActivities];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setPlanActivities(updated.map((a, i) => ({ ...a, sequenceIndex: i })));
  }

  function handleRemovePlanActivity(index: number) {
    const updated = planActivities.filter((_, i) => i !== index);
    setPlanActivities(updated.map((a, i) => ({ ...a, sequenceIndex: i })));
  }

  function handleAddActivityFromPicker(ids: string[]) {
    if (replacingIndex !== null) {
      // Replace mode: swap the activity at replacingIndex with the first picked
      const newId = ids.find((id) => !planActivities.some((pa) => pa.activityId === id));
      if (newId) {
        const updated = [...planActivities];
        updated[replacingIndex] = {
          ...updated[replacingIndex],
          activityId: newId,
          rationale: [{ key: 'rationale_new_activity' }],
        };
        setPlanActivities(updated);
      }
      setReplacingIndex(null);
    } else {
      // Add mode: append new activities
      const existing = new Set(planActivities.map((pa) => pa.activityId));
      const newIds = ids.filter((id) => !existing.has(id));
      const newActivities: RecommendedActivity[] = newIds.map((id, i) => ({
        activityId: id,
        goalId: null,
        sequenceIndex: planActivities.length + i,
        durationMinutes: 10,
        rationale: [{ key: 'rationale_new_activity' }],
      }));
      setPlanActivities([...planActivities, ...newActivities]);
    }
    setPickerOpen(false);
  }

  const currentActivity = sessionActivities && sessionActivities.length > 0
    ? (sessionActivities[currentActivityIndex] ?? null)
    : null;

  async function handleRecordTrial(response: TrialResponse) {
    if (isPaused || !currentActivity) return;
    const saId = currentActivity.id;
    // Read the current single-selection from the ref (avoids stale closures on rapid taps)
    const previousSelection = stepResponsesRef.current[saId] ?? null;

    // Toggle off if the same button is tapped again; otherwise switch to the new selection.
    // We do NOT block on trialPending when switching to a different response — this ensures
    // clicking e.g. "Partial" right after "Responded" registers immediately without dropping.
    const newSelection: TrialResponse | null = previousSelection === response ? null : response;

    // Only debounce re-taps of the already-pending same selection
    if (trialPending && previousSelection === response) return;

    // Optimistic update — write to both state and ref immediately so the UI reflects
    // the new selection before the network round-trip completes.
    setStepResponses((prev) => ({ ...prev, [saId]: newSelection }));
    stepResponsesRef.current = { ...stepResponsesRef.current, [saId]: newSelection };
    setTrialPending(true);

    try {
      if (newSelection !== null) {
        // Record the newly selected response (trialNumber = 1 — single selection per step)
        await createTrial.mutateAsync({
          sessionActivityId: saId,
          response: newSelection,
          trialNumber: 1,
        });
      }
      // If toggled off (newSelection === null) we simply clear the UI state;
      // the DB row from the previous selection stays as an audit record.
    } catch (err) {
      // Rollback to previous selection on unexpected errors
      setStepResponses((prev) => ({ ...prev, [saId]: previousSelection }));
      stepResponsesRef.current = { ...stepResponsesRef.current, [saId]: previousSelection };
      const msg = err instanceof Error ? err.message : t('error_generic');
      toast(msg, 'error');
    } finally {
      setTrialPending(false);
    }
  }

  async function navigateActivity(direction: 'next' | 'prev') {
    if (isPaused || !sessionActivities) return;
    const nextIndex = direction === 'next' ? currentActivityIndex + 1 : currentActivityIndex - 1;
    if (nextIndex < 0 || nextIndex >= sessionActivities.length) return;

    // End current
    if (currentActivity) {
      await endActivityMut.mutateAsync({ sessionActivityId: currentActivity.id });
    }
    // Start next
    const nextSa = sessionActivities[nextIndex];
    if (nextSa) {
      await startActivityMut.mutateAsync({ sessionActivityId: nextSa.id });
      cvPipelineRef.current?.resetForNewActivity();
      gazeBestFiredRef.current = false;
      setGazeBestNotice(false);
      // adapter activity ID update handled by the currentActivityIndex effect
    }
    setCurrentActivityIndex(nextIndex);
    setNoteText('');
    setShowNotes(false);
  }

  async function handleEndSession() {
    // End current activity
    if (currentActivity) {
      await endActivityMut.mutateAsync({ sessionActivityId: currentActivity.id });
    }
    cvPipelineRef.current?.stop();
    cvAdapterRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());

    // Store engagement samples in sessionStorage for the summary page
    sessionStorage.setItem(
      `engagement-${sessionId}`,
      JSON.stringify(engagementSamplesRef.current),
    );
    navigate(`/sessions/${sessionId}/summary`);
  }

  async function handleSaveNote() {
    if (isPaused || !currentActivity || !noteText.trim()) return;
    try {
      await updateNotes.mutateAsync({
        sessionActivityId: currentActivity.id,
        notes: noteText.trim(),
      });
      toast(t('note_saved'), 'success');
      setShowNotes(false);
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  function togglePause() {
    if (isPaused) {
      setIsPaused(false);
      isPausedRef.current = false;
      setFrozenMetrics(null);
      cvAdapterRef.current?.resume();
    } else {
      setIsPaused(true);
      isPausedRef.current = true;
      setFrozenMetrics(cvMetrics);
      cvAdapterRef.current?.pause();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Mic availability: true when getUserMedia succeeded and the pipeline has mic access.
  // This does NOT depend on current audio level — a quiet room is not "unavailable".
  const micAvailable = cvStatus?.microphone === true;

  // V2 candidate: prompt_level inferred from sensors — column stays in DB

  // Spontaneous moment smart-suggestion pulse
  // When CV detects a child voice spike with no trial action in the last ~8 seconds,
  // pulse the Spontaneous button to suggest the therapist tap it.
  //
  // Thresholds (tune as needed):
  //   DELTA_THRESHOLD = 2   — filters single-sample noise; require real spike
  //   TRIAL_COOLDOWN  = 8s  — don't pulse too soon after a trial tap
  //   SPONT_COOLDOWN  = 15s — don't re-pulse within 15s of last spontaneous capture
  //   AUTO_EXPIRE     = 5s  — pulse auto-clears if therapist doesn't tap
  //
  // NOTE: cvMetrics updates per-frame (~30fps). total_child_sounds increments per
  // completed episode (>200ms voice + >500ms silence gap). Between frames the delta
  // is almost always 0 or 1, so delta >= 2 rarely fires within a single render cycle.
  // We throttle the check to every 2 seconds and accumulate delta over that window.
  const pulseCheckRef = useRef(0);
  const pulseBaselineRef = useRef(0);
  // Debug state — mirrored from refs so it's safe to render
  const [pulseDebug, setPulseDebug] = useState({ delta: 0, timeSinceTrial: 0 });
  useEffect(() => {
    if (!cvMetrics || isPaused) return;
    const childSounds = cvMetrics.total_child_sounds ?? 0;
    const now = Date.now();

    // Throttle: only evaluate every 2 seconds
    if (now - pulseCheckRef.current < 2000) return;

    const delta = childSounds - pulseBaselineRef.current;
    const timeSinceTrial = now - lastTrialTimeRef.current;
    const timeSinceSpont = now - lastSpontTimeRef.current;
    const willTrigger = delta >= 2 && timeSinceTrial > 8000 && timeSinceSpont > 15000;

    // Diagnostic logging — only with ?debug=1
    if (isDebugMode) {
      console.log('[smartPulse]', {
        totalChildSounds: childSounds,
        baseline: pulseBaselineRef.current,
        delta,
        adultVoiceCount: cvMetrics.adult_voice_count ?? 0,
        timeSinceTrialMs: timeSinceTrial,
        timeSinceSpontMs: timeSinceSpont,
        suggestionActive: spontSuggestPulse,
        willTrigger,
        voiceState: cvMetrics.voice_state,
        audioLevel: cvMetrics.audio_level?.toFixed(3),
      });
    }

    setPulseDebug({ delta, timeSinceTrial });
    pulseCheckRef.current = now;
    pulseBaselineRef.current = childSounds;

    if (willTrigger) {
      setSpontSuggestPulse(true);
      const timer = setTimeout(() => setSpontSuggestPulse(false), 5000);
      return () => clearTimeout(timer);
    }
    // Also update the legacy ref for other consumers
    prevChildSoundsRef.current = childSounds;
  }, [cvMetrics, isPaused, spontSuggestPulse, isDebugMode]);

  // Personal best detection — gaze: compare live longest_gaze_episode_sec to stored best
  useEffect(() => {
    if (!cvMetrics || isPaused || gazeBestFiredRef.current) return;
    if (!childBests || !gazeConfig) return;
    const stored = childBests.find(b => b.attribute_id === 'looks_at_you' && b.metric === 'longest_duration_ms');
    if (!stored) return;
    const marginMs = typeof (gazeConfig as Record<string, unknown>).best_margin_ms === 'number'
      ? ((gazeConfig as Record<string, unknown>).best_margin_ms as number)
      : 500;
    const liveMs = (cvMetrics.longest_gaze_episode_sec ?? 0) * 1000;
    if (liveMs > stored.value + marginMs) {
      gazeBestFiredRef.current = true;
      queueMicrotask(() => setGazeBestNotice(true));
      const timer = setTimeout(() => setGazeBestNotice(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [cvMetrics, isPaused, childBests, gazeConfig]);

  function handleSpontaneousCapture() {
    if (isPaused || !sessionId || !user) return;
    // eslint-disable-next-line react-hooks/purity -- event handler only
    lastSpontTimeRef.current = Date.now();
    setSpontMoments((prev) => [...prev, elapsedSeconds]);
    setSpontPulse(true);
    setSpontSuggestPulse(false);
    setTimeout(() => setSpontPulse(false), 600);
    createSessionEvent.mutate({
      sessionId,
      sessionActivityId: currentActivity?.id ?? null,
      eventType: 'spontaneous_initiation',
      recordedByUserId: user.id,
    });
    const timeStr = formatTime(elapsedSeconds);
    toast(t('spontaneous_recorded_at', { time: timeStr }), 'success');
    if (showSpontOnboarding) {
      setShowSpontOnboarding(false);
      localStorage.setItem('habilitate_spont_onboarded', '1');
    }
  }

  function handleRemoveSpontMoment(index: number) {
    setSpontMoments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleRecordTrialWrapped(response: TrialResponse) {
    if (isPaused) return;
    // eslint-disable-next-line react-hooks/purity -- event handler only
    lastTrialTimeRef.current = Date.now();
    // Note: lastTrialResponse is kept for the smart-pulse cooldown ref only.
    // We no longer render it as an inline toast — that was visually misleading
    // and made it appear the selection had snapped back to "Responded".
    setLastTrialResponse(response);
    await handleRecordTrial(response);
  }

  if (sessionLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-black"><Skeleton className="h-40 w-80" /></div>;
  }

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center bg-black"><p className="text-white">{t('error_generic')}</p></div>;
  }

  // ─── Ownership guard ──────────────────────────────────────────────
  // Wait for auth to resolve before deciding. While loading, show skeleton
  // (NOT the blocked screen — that was the previous bug).
  const guardLoading = authLoading || !user;
  const guardBlocked = !guardLoading && session.therapist_id !== user?.id;

  if (guardLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-black"><Skeleton className="h-40 w-80" /></div>;
  }

  if (guardBlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <span className="text-[48px]">🔒</span>
        <h2 className="text-xl font-semibold text-ink-primary">{t('session_assigned_other')}</h2>
        <p className="max-w-md text-sm text-ink-secondary">{t('session_assigned_other_body')}</p>
        <button onClick={() => navigate('/sessions')} className="mt-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-ink-inverse hover:bg-primary-700">
          {t('back_to_sessions')}
        </button>
      </div>
    );
  }

  const childAge = session.child ? differenceInMonths(new Date(), new Date(session.child.date_of_birth)) : 0;
  const childAgeStr = `${Math.floor(childAge / 12)}y ${childAge % 12}m`;

  // =================== PREFLIGHT SCREEN ===================
  if (phase === 'preflight') {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto w-full max-w-2xl p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-ink-primary">{t('session_run_title')}</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {session.child?.full_name} ({childAgeStr})
            </p>
            {session.child?.diagnostic_profile && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(session.child.diagnostic_profile as string[]).map((d) => (
                  <Pill key={d}>{d}</Pill>
                ))}
              </div>
            )}
            {activeGoals && activeGoals.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {activeGoals.map((g) => (
                  <Pill key={g.id} variant="success">{g.name}</Pill>
                ))}
              </div>
            )}
          </div>

          {/* Cards */}
          <div className="space-y-4">
            {/* Camera & Microphone */}
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-ink-primary">{t('camera_mic_status')}</h3>
                {mediaStatus === 'granted' ? (
                  <Pill variant="success">{t('camera_mic_ready')}</Pill>
                ) : mediaStatus === 'denied' ? (
                  <Pill variant="danger">{t('camera_mic_denied')}</Pill>
                ) : null}
              </div>
              {mediaStatus === 'none' && (
                <Button className="mt-3" onClick={requestMedia}>{t('allow_camera_mic')}</Button>
              )}
              {/* Hidden video for preflight */}
              <video ref={preflightVideoRef} autoPlay playsInline muted className="hidden" />
            </div>

            {/* Engagement measurement */}
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-ink-primary">{t('engagement_status')}</h3>
                <Pill variant={measurementStatus === 'ready' ? 'success' : measurementStatus === 'trial-only' ? 'warning' : 'neutral'}>
                  {measurementStatus === 'ready' ? t('engagement_ready') : measurementStatus === 'trial-only' ? t('engagement_trial_only') : t('engagement_loading')}
                </Pill>
              </div>
              {measurementStatus === 'trial-only' && (
                <p className="mt-2 text-sm text-ink-secondary">{t('engagement_trial_only_explainer')}</p>
              )}
            </div>

            {/* Session Plan */}
            <div className="rounded-2xl border border-border bg-surface p-4">
              {planLoading ? (
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                  <span className="text-sm text-ink-secondary">{t('plan_generating')}</span>
                </div>
              ) : recommendedPlan ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-ink-primary">{t('plan_title')}</h3>
                      <p className="text-sm text-ink-secondary">
                        {t('plan_subtitle', { count: planActivities.length, duration: sessionDuration })}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditMode(!editMode)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${editMode ? 'bg-primary-100 text-primary-700' : 'bg-ink-muted/10 text-ink-secondary'}`}
                    >
                      {t('plan_edit_mode')}
                    </button>
                  </div>

                  {recommendedPlan.fallbackUsed && (
                    <div className="mt-3 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-sm text-warning">
                      {t('plan_fallback_banner')}
                    </div>
                  )}

                  {planActivities.length === 0 ? (
                    <p className="mt-4 text-sm text-ink-secondary">{t('plan_no_activities')}</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {planActivities.map((pa, idx) => {
                        const actData = recommendedPlan.activities.find((a) => a.activityId === pa.activityId) ?? pa;
                        return (
                          <div key={`${pa.activityId}-${idx}`} className="rounded-xl border border-border bg-background p-3">
                            {/* Activity name + duration — always full width */}
                            <div className="flex items-start gap-2">
                              {editMode && (
                                <div className="flex flex-col gap-0.5 pt-0.5">
                                  <button onClick={() => handleMovePlanActivity(idx, 'up')} disabled={idx === 0}
                                    className="text-ink-secondary hover:text-ink-primary disabled:opacity-30" title={t('plan_move_up')}>
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd"/></svg>
                                  </button>
                                  <button onClick={() => handleMovePlanActivity(idx, 'down')} disabled={idx === planActivities.length - 1}
                                    className="text-ink-secondary hover:text-ink-primary disabled:opacity-30" title={t('plan_move_down')}>
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
                                  </button>
                                </div>
                              )}
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-ink-primary">{activityLookup[pa.activityId]?.name ?? pa.activityId}</span>
                                {activityLookup[pa.activityId]?.isCustom && (
                                  <span className="ml-1.5 rounded-full border border-dashed border-ink-muted px-1.5 py-0.5 text-[10px] text-ink-muted">{t('custom_badge')}</span>
                                )}
                                <span className="ml-2 text-xs text-ink-secondary">{activityLookup[pa.activityId]?.duration ?? pa.durationMinutes} min</span>
                              </div>
                            </div>
                            {/* Rationale — full width below name */}
                            {actData.rationale.length > 0 && (
                              <div className="mt-1 pl-8 space-y-0.5">
                                {actData.rationale.map((r, ri) => (
                                  <p key={ri} className="text-xs text-ink-secondary">
                                    {t(r.key, r.values ?? {})}
                                  </p>
                                ))}
                              </div>
                            )}
                            {/* Edit actions — below content on mobile, not side-by-side */}
                            {editMode && (
                              <div className="mt-2 flex gap-2 pl-8">
                                <button
                                  onClick={() => { setReplacingIndex(idx); setPickerOpen(true); }}
                                  className="rounded px-2 py-1 text-xs text-ink-secondary hover:bg-ink-muted/10"
                                >
                                  {t('plan_replace_activity')}
                                </button>
                                <button
                                  onClick={() => handleRemovePlanActivity(idx)}
                                  className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10"
                                >
                                  {t('plan_remove_activity')}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {editMode && (
                    <Button
                      className="mt-3"
                      variant="secondary"
                      size="sm"
                      onClick={() => { setReplacingIndex(null); setPickerOpen(true); }}
                    >
                      {t('plan_add_activity')}
                    </Button>
                  )}

                  {/* Duration estimate */}
                  {planActivities.length > 0 && (() => {
                    const total = planActivities.reduce((s, a) => s + a.durationMinutes, 0);
                    const onTarget = Math.abs(total - sessionDuration) <= 5;
                    return (
                      <p className={`mt-3 text-sm ${onTarget ? 'text-success' : 'text-warning'}`}>
                        {t('plan_estimated_duration', { minutes: total })} — {t(onTarget ? 'plan_duration_on_target' : 'plan_duration_over_target')}
                      </p>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-ink-secondary">{t('plan_no_eligible_activities')}</p>
              )}
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/sessions')} className="text-sm text-ink-secondary hover:text-ink-primary">
                {t('modal_cancel')}
              </button>
              {/* V2: rebuild plan with diversity boost / fresh seed */}
            </div>
            <Button
              size="lg"
              className="h-14 px-8 text-base"
              disabled={mediaStatus !== 'granted' || planActivities.length === 0 || acceptPlan.isPending}
              onClick={handleStartSession}
            >
              {t('plan_start_session')}
            </Button>
          </div>
        </div>

        <ActivityPicker
          open={pickerOpen}
          onClose={() => { setPickerOpen(false); setReplacingIndex(null); }}
          selected={planActivities.map((pa) => pa.activityId)}
          onDone={handleAddActivityFromPicker}
          activeGoals={activeGoals?.map((g) => ({ target_domain: g.target_domain, target_skill_level: g.target_skill_level }))}
          childDiagnosticProfile={(session.child?.diagnostic_profile as import('../types/supabase').Database['public']['Enums']['diagnostic_profile'][]) ?? []}
          childAgeMonths={childAge}
        />
      </div>
    );
  }

  /*
   * =================== LIVE SESSION SCREEN ===================
   * Apple Health "Workout In Progress" visual model.
   * Primary breakpoint: 1180×820 (iPad Pro 11" landscape).
   *
   * Tokens:
   *   bg-app: #F8F8FC   card: #FFF / border #EBEBF0 / shadow 0 1px 2px #E6E6EB80
   *   text-1: #1B1B2E   text-2: #5E5E7A   text-3: #8E8EA0
   *   label: #7A7A92 tracking +0.5px 11px uppercase Manrope 600
   *   indigo: #5B5BF0   lavender: #A5A5F0
   *   sage: bg #E8F5F0 text #1A6B4F   amber: bg #FEF3E2 text #92600A
   *   rose: bg #FCEEF0 text #A83246   gray: bg #F4F4F8 text #5E5E7A
   */

  const S = { // inline style constants
    card: { background: '#FFF', border: '1px solid #EBEBF0', borderRadius: 12, boxShadow: '0 1px 2px rgba(230,230,235,0.5)' } as const,
    label: { color: '#7A7A92', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as const },
    text1: { color: '#1B1B2E' },
    text2: { color: '#5E5E7A' },
    text3: { color: '#8E8EA0' },
    hero: { color: '#1B1B2E', fontSize: 32, fontWeight: 700, lineHeight: 1, fontFeatureSettings: '"tnum"' },
  };

  const totalActivities = sessionActivities?.length ?? 0;
  const act = currentActivity?.activity;
  // Derive display counts from the single-selection model:
  // each activity has at most one active selection, so each count is 0 or 1.
  const activeResponse = currentActivity ? (stepResponses[currentActivity.id] ?? null) : null;
  const counts = {
    responded: activeResponse === 'responded' ? 1 : 0,
    partial: activeResponse === 'partial' ? 1 : 0,
    no_response: activeResponse === 'no_response' ? 1 : 0,
    refused: activeResponse === 'refused' ? 1 : 0,
  };
  // T = 1 when a response is recorded, 0 when none selected yet
  const totalTrials = activeResponse !== null ? 1 : 0;
  const isLast = currentActivityIndex === totalActivities - 1;

  const actIcon = act ? getDomainIcon(act.developmental_domain) : '♪';
  const goal = act ? getSimplifiedGoal(act) : '';
  const materialsArr = act ? pickArrayField(act.materials_required, act.materials_required_hi, lang) : [];
  const materials = materialsArr.length > 0 ? materialsArr.join(' \u00b7 ') : null;
  const helpLadder = act ? getHelpLadder(act) : [];

  const faceLabel =
    displayMetrics?.face_state === 'social_gaze' ? t('face_looking_at_camera')
    : displayMetrics?.face_state === 'looking_at_toys' ? t('face_looking_at_toys')
    : displayMetrics?.face_state === 'head_down' ? t('face_head_down')
    : displayMetrics?.face_state === 'looking_away' ? t('face_looking_away')
    : displayMetrics?.face_state === 'not_visible' ? t('face_not_visible')
    : t('face_no_face');

  const faceColor =
    displayMetrics?.face_state === 'social_gaze' ? '#0D9F7E'
    : displayMetrics?.face_state === 'looking_at_toys' ? '#F59E0B'
    : displayMetrics?.face_state === 'looking_away' || displayMetrics?.face_state === 'head_down' ? '#D97706'
    : '#9C9C95';

  const pillStyle: Record<ChildState, { bg: string; color: string; dot: string }> = {
    regulated: { bg: '#E8F5F0', color: '#1A6B4F', dot: '#4ADE80' },
    amber: { bg: '#FEF3E2', color: '#92600A', dot: '#FBBF24' },
    dysregulated: { bg: '#FCEEF0', color: '#A83246', dot: '#FB7185' },
  };

  const pd = displayMetrics?.pointing_direction;
  const pointingActive = pd && pd.horizontal !== 'center';
  // Video is mirrored (selfie); flip horizontal direction for display
  const displayH = pd?.horizontal === 'left' ? 'right' : pd?.horizontal === 'right' ? 'left' : 'center';
  const pointingText = pointingActive
    ? `${displayH === 'left' ? '← Left' : '→ Right'}${pd!.vertical === 'up' ? ' ↑ Up' : pd!.vertical === 'down' ? ' ↓ Down' : ''}`
    : '—';

  return (
    <div className="min-h-screen flex flex-col lg:fixed lg:inset-0 lg:overflow-hidden" style={{ backgroundColor: '#F8F8FC' }}>

      {/* ===== SECTION 1: TOP BAR — 60px fixed ===== */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center px-3 shrink-0 gap-2 py-2 lg:relative lg:px-4 lg:gap-4" style={{ minHeight: 52, backgroundColor: '#FEFEFE', borderBottom: '1px solid #EBEBF0' }}>
        {/* Left: name + activity progress */}
        <div className="shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[16px] font-semibold" style={S.text1}>{session.child?.full_name}</span>
            <span className="text-[14px]" style={S.text3}>({childAgeStr})</span>
          </div>
          <span className="text-[13px]" style={S.text3}>{t('activity_of', { current: currentActivityIndex + 1, total: totalActivities })}</span>
        </div>

        {/* Center: child state pills + info popover */}
        <div className="relative flex flex-col items-center mx-auto">
          <div className="flex items-center gap-1.5">
            {CHILD_STATES.map((cs) => {
              const active = childState === cs.value;
              const ps = pillStyle[cs.value];
              return (
                <button key={cs.value} onClick={() => handleChildStateChange(cs.value)}
                  disabled={isPaused}
                  className={`flex items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-all ${isPaused ? 'opacity-40 pointer-events-none' : ''}`}
                  style={{ height: 28, backgroundColor: active ? ps.bg : 'transparent', color: active ? ps.color : '#8E8EA0', border: active ? 'none' : '1px solid #D4D4DC' }}>
                  {active && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ps.dot }} />}
                  {t(cs.i18nKey)}
                </button>
              );
            })}
            <button onClick={() => setShowChildStateInfo(!showChildStateInfo)}
              className="flex items-center justify-center shrink-0 rounded-full hover:bg-black/5 transition-colors"
              style={{ width: 22, height: 22, color: '#8E8EA0' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
            </button>
          </div>
          {/* Micro-caption — hidden on short viewports to save space */}
          <span className="hidden text-[11px] mt-1 sm:inline" style={{ color: '#8E8EA0', fontWeight: 500 }}>
            {t(CHILD_STATES.find((cs) => cs.value === childState)?.captionKey ?? 'child_state_caption_regulated')}
          </span>

          {/* Info popover */}
          {showChildStateInfo && (<>
            <div className="fixed inset-0 z-40" onClick={() => setShowChildStateInfo(false)}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowChildStateInfo(false); }} role="button" tabIndex={-1} />
            <div className="absolute top-full mt-2 z-50 w-[360px] -translate-x-1/4"
              style={{ background: '#FFF', border: '1px solid #EBEBF0', borderRadius: 16, padding: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <h4 className="text-[16px] font-semibold mb-1" style={S.text1}>{t('child_state_info_title')}</h4>
              <p className="text-[14px] mb-3" style={S.text3}>{t('child_state_info_intro')}</p>
              <div className="flex flex-col gap-3">
                {CHILD_STATES.map((cs) => {
                  const ps = pillStyle[cs.value];
                  return (
                    <div key={cs.value} className="rounded-xl p-3" style={{ backgroundColor: '#FAFAFC', border: '1px solid #F0F0F4' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ps.dot }} />
                        <span className="text-[14px] font-semibold" style={S.text1}>{t(cs.i18nKey)}</span>
                      </div>
                      <p className="text-[13px]" style={S.text2}>{t(cs.descKey)}</p>
                      <p className="text-[12px] italic mt-0.5" style={S.text3}>{t(cs.seeKey)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F0F0F4' }}>
                <p className="text-[12px] italic" style={S.text3}>{t('child_state_v2_note')}</p>
              </div>
            </div>
          </>)}
        </div>

        {/* Right: timer + pause */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[18px] font-semibold" style={{ ...S.text1, fontFeatureSettings: '"tnum"' }}>{isPaused && '⏸ '}{formatTime(elapsedSeconds)}</span>
          <button onClick={togglePause} className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
            style={{ backgroundColor: isPaused ? '#EEF2FF' : '#F4F4F8', color: isPaused ? '#5B5BF0' : '#5E5E7A' }}>
            {isPaused ? t('resume_session') : t('pause_session')}
          </button>
          {!isOnline && <Pill variant="warning">{t('offline_buffering')}</Pill>}
        </div>
      </header>

      {/* ===== SECTIONS 2+3: MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col gap-3 p-3 lg:flex-row lg:gap-4 lg:p-4 lg:overflow-hidden">

        {/* ===== SECTION 2: LEFT COLUMN ===== */}
        <div className="min-w-0 flex flex-col gap-3 lg:flex-1">

          {/* 2A: Activity card — scrollable on lg+, auto-height on mobile */}
          <div className="p-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto" style={S.card}>
            {act ? (<>
              {/* Name + domain pill + custom badge */}
              <div className="flex items-start gap-3 mb-1">
                <span className="text-[28px] leading-none shrink-0 mt-0.5">{actIcon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[22px] font-bold leading-tight truncate" style={S.text1}>{act.name}</h2>
                    {act.validation_status === 'custom' && (
                      <span className="shrink-0 rounded-full border border-dashed border-ink-muted px-2 py-0.5 text-[10px] font-medium" style={{ color: '#8E8EA0' }}>
                        {t('custom_badge')}
                      </span>
                    )}
                  </div>
                  <span className="inline-block mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: '#EEF2FF', color: '#5B5BF0' }}>
                    {t(domainI18nKeys[act.developmental_domain])}
                  </span>
                </div>
              </div>

              {/* Goal — primary focus; custom activities may have no goal_one_line */}
              {(pickField(act.goal_one_line, act.goal_one_line_hi, lang) || (act.validation_status !== 'custom' && goal)) && (
                <p className="text-[18px] font-medium leading-snug mb-4" style={S.text1}>
                  {pickField(act.goal_one_line, act.goal_one_line_hi, lang) ?? goal}
                </p>
              )}

              {/* Steps — numbered with quiet indigo badges */}
              {(() => {
                const steps = pickArrayField(act.therapist_steps, act.therapist_steps_hi, lang);
                return steps.length > 0 ? (
                  <div className="mb-4">
                    <p style={S.label} className="mb-1.5">{t('detail_steps_label')}</p>
                    <ol className="space-y-1.5">
                      {steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="shrink-0 flex items-center justify-center rounded-full text-[11px] font-semibold" style={{ width: 20, height: 20, backgroundColor: '#EEF2FF', color: '#5B5BF0', marginTop: 2 }}>
                            {i + 1}
                          </span>
                          <span className="text-[15px] leading-relaxed" style={S.text2}>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null;
              })()}

              {/* Help ladder — horizontal escalation chips, visually quiet */}
              {helpLadder.length > 0 && (
                <div className="mb-4">
                  <p className="text-[12px] font-medium mb-1.5" style={S.text3}>{t('help_ladder_label')}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {helpLadder.map((step, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="rounded-full px-2 py-0.5 text-[12px]" style={{ backgroundColor: '#F4F4F8', color: '#5E5E7A' }}>{step}</span>
                        {i < helpLadder.length - 1 && <span className="text-[11px]" style={S.text3}>&rarr;</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Measuring now — tinted block */}
              {(() => {
                const measuringNow = pickField(act.measuring_now, act.measuring_now_hi, lang);
                return measuringNow ? (
                  <div className="rounded-lg p-2.5 mb-3" style={{ backgroundColor: '#EEF2FF', border: '1px solid #D8D8F0' }}>
                    <p style={{ ...S.label, color: '#5B5BF0' }} className="mb-0.5">{t('measuring_now_label')}</p>
                    <p className="text-[14px] leading-snug" style={S.text2}>{measuringNow}</p>
                  </div>
                ) : null;
              })()}

              {/* More details */}
              <button onClick={() => setShowDetailsModal(true)} className="flex items-center gap-1 text-[13px]" style={{ color: '#5B5BF0' }}>
                <span className="text-[14px]">ⓘ</span>
                <span>{t('more_details')}</span>
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </>) : (
              <p className="text-[14px]" style={S.text3}>{t('common.loading')}</p>
            )}
          </div>

          {/* 2B: Trial capture card — pinned bottom */}
          <div className="shrink-0 p-3 lg:p-4" style={S.card}>
            {/* Counter strip — compact on narrow */}
            <p className="text-[12px] mb-1.5 lg:text-[14px] lg:mb-2" style={{ fontFeatureSettings: '"tnum"' }}>
              {/* T shows current step status: 0 = no selection, 1 = recorded */}
              <span style={S.text3}>T</span><span className="font-bold" style={S.text1}>{totalTrials}</span>
              <span style={S.text3}> ✓</span><span className="font-bold" style={{ color: '#1A6B4F' }}>{counts.responded}</span>
              <span style={S.text3}> ⚠</span><span className="font-bold" style={{ color: '#92600A' }}>{counts.partial}</span>
              <span style={S.text3}> ✗</span><span className="font-bold" style={{ color: '#5E5E7A' }}>{counts.no_response}</span>
              <span style={S.text3}> ⊘</span><span className="font-bold" style={{ color: '#A83246' }}>{counts.refused}</span>
            </p>

            {/* Selection feedback is shown via the button's active outline ring (see below) */}

            {/* Spontaneous moment — hidden on narrow screens to save vertical space */}
            <div className="hidden lg:block">
              {showSpontOnboarding && (
                <div className="relative mb-1 rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: '#1B1B2E', color: 'white' }}>
                  {t('spontaneous_first_time')}
                  <button onClick={() => { setShowSpontOnboarding(false); localStorage.setItem('habilitate_spont_onboarded', '1'); }}
                    className="absolute top-1 right-2 text-white/60 hover:text-white">×</button>
                </div>
              )}
              <button onClick={handleSpontaneousCapture}
                disabled={isPaused}
                className={`w-full flex items-center justify-center gap-2 rounded-lg mb-2 transition-all ${isPaused ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#F0F0FF]'} ${spontPulse ? 'scale-[1.01]' : ''}`}
                style={{
                  height: 40,
                  border: spontSuggestPulse ? '1.5px solid #A5A5F0' : '1.5px dashed #C8C8E8',
                  backgroundColor: spontPulse ? '#EEEEFF' : spontSuggestPulse ? 'hsl(260, 50%, 97%)' : 'transparent',
                  boxShadow: spontSuggestPulse ? '0 0 10px 1px hsla(260, 50%, 80%, 0.35)' : 'none',
                  animation: spontSuggestPulse ? 'spontPulse 1.5s ease-in-out infinite' : 'none',
                }}>
                <span className="text-[16px]" style={{ color: '#A5A5F0' }}>{spontSuggestPulse ? '✨' : '★'}</span>
                <span className="text-[13px] font-medium" style={{ color: spontSuggestPulse ? '#7B61FF' : '#8E8EA0' }}>
                  {spontSuggestPulse ? t('spontaneous_suggestion_hint') : t('tap_to_capture')}
                </span>
              </button>
            </div>

            {/* Response buttons — 2x2 on narrow, 4-across on lg+ */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {([
                { r: 'responded' as TrialResponse, icon: '✓', label: 'trial_responded', bg: '#E8F5F0', color: '#1A6B4F' },
                { r: 'partial' as TrialResponse, icon: '⚠', label: 'trial_partial', bg: '#FEF3E2', color: '#92600A' },
                { r: 'no_response' as TrialResponse, icon: '✗', label: 'trial_no_response', bg: '#F4F4F8', color: '#5E5E7A' },
                { r: 'refused' as TrialResponse, icon: '⊘', label: 'trial_refused', bg: '#FCEEF0', color: '#A83246' },
              ]).map((b) => {
                const isActive = activeResponse === b.r;
                return (
                  <button key={b.r} onClick={() => handleRecordTrialWrapped(b.r)}
                    disabled={isPaused || trialPending}
                    className={`flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-all duration-150 sm:gap-2 sm:text-[15px] ${isPaused || trialPending ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 active:brightness-90'}`}
                    style={{
                      height: 48,
                      backgroundColor: b.bg,
                      color: b.color,
                      // Active selection: stronger border ring to indicate the current state
                      outline: isActive ? `2.5px solid ${b.color}` : '2.5px solid transparent',
                      outlineOffset: 1,
                      boxShadow: isActive ? `0 0 0 1px ${b.color}22` : undefined,
                    }}>
                    <span className="text-[16px] sm:text-[18px]">{b.icon}</span>
                    {t(b.label)}
                  </button>
                );
              })}
            </div>

            {/* Nav row — wrap on narrow */}
            <div className="flex flex-wrap items-center gap-2 mt-2 lg:gap-2 lg:mt-3">
              <button onClick={() => navigateActivity('prev')} disabled={currentActivityIndex === 0 || isPaused}
                className="flex items-center justify-center gap-1 rounded-lg px-3 text-[13px] disabled:opacity-30 lg:px-3 lg:text-[13px]" style={{ ...S.text2, minHeight: 44, minWidth: 44, backgroundColor: '#F4F4F8' }}>
                ← {t('prev')}
              </button>
              <button onClick={() => setShowNotes(true)} disabled={isPaused}
                className={`flex items-center justify-center gap-1 rounded-lg px-3 text-[13px] lg:px-3 lg:text-[13px] ${isPaused ? 'opacity-40' : ''}`} style={{ ...S.text2, minHeight: 44, minWidth: 44, backgroundColor: '#F4F4F8' }}>
                📝 <span className="lg:hidden">{t('note')}</span>
              </button>
              {/* Spontaneous — inline on narrow since the full button is hidden */}
              <button onClick={handleSpontaneousCapture} disabled={isPaused}
                className={`flex items-center justify-center gap-1 rounded-lg px-3 text-[13px] lg:hidden ${isPaused ? 'opacity-40' : ''}`} style={{ color: '#A5A5F0', minHeight: 44, minWidth: 44, backgroundColor: '#F4F4F8' }}>
                ★ {t('moment_short')}
              </button>
              <div className="flex-1" />
              {isLast ? (
                <button onClick={() => setEndConfirmOpen(true)} className="rounded-xl px-4 text-[13px] font-semibold text-white lg:px-6 lg:text-[14px]" style={{ backgroundColor: '#5B5BF0', minHeight: 44 }}>
                  {t('end_session')}
                </button>
              ) : (
                <button onClick={() => navigateActivity('next')} disabled={isPaused}
                  className={`rounded-xl px-4 text-[13px] font-semibold text-white lg:px-6 lg:text-[14px] ${isPaused ? 'opacity-40' : ''}`} style={{ backgroundColor: '#5B5BF0', minHeight: 44 }}>
                  {t('next_step')} →
                </button>
              )}
              {!isLast && (
                <button onClick={() => setSkipConfirmOpen(true)} disabled={isPaused}
                  className={`flex items-center justify-center rounded-lg px-3 text-[12px] lg:px-3 lg:text-[13px] ${isPaused ? 'opacity-40' : ''}`} style={{ color: '#A83246', minHeight: 44 }}>
                  {t('skip_activity')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Metrics toggle — visible below lg only */}
        <div className="flex shrink-0 gap-2 lg:hidden">
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="flex-1 rounded-lg border border-border py-2 text-center text-[13px] font-medium text-ink-secondary hover:bg-primary-50"
          >
            {showMetrics ? t('session_hide_metrics') : t('session_show_metrics')}
          </button>
          {!narrowHintDismissed && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-ink-muted" style={{ backgroundColor: '#F8F8FC', border: '1px solid #EBEBF0' }}>
              <span>{t('session_narrow_hint')}</span>
              <button onClick={() => localStorage.setItem('habilitate_narrow_hint_dismissed', '1')} className="shrink-0 text-ink-secondary hover:text-ink-primary">{t('session_narrow_hint_dismiss')}</button>
            </div>
          )}
        </div>

        {/* ===== SECTION 3: RIGHT COLUMN — side panel on lg+, collapsible below ===== */}
        {/* Below lg: hidden via h-0 + overflow-hidden + invisible (NOT display:none).
            The video element stays mounted so the CV pipeline keeps reading frames.
            visibility:hidden stops rendering but the element remains in the DOM with
            its media stream active. */}
        <div className={`shrink-0 flex flex-col gap-3 overflow-y-auto lg:w-[440px] ${showMetrics ? '' : 'invisible h-0 overflow-hidden lg:visible lg:h-auto lg:overflow-y-auto'}`}>

          {/* Card 1: Live Camera */}
          <div style={S.card} className="p-4 shrink-0">
            <p style={S.label} className="mb-2">{t('live_camera_label')}{isPaused && <span className="ml-2 normal-case tracking-normal text-[10px]" style={{ color: '#A5A5F0' }}>{t('values_frozen')}</span>}</p>
            <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
              <video ref={liveVideoRef} className="w-full h-full object-cover" style={{ opacity: cvStatus?.camera ? 1 : 0.3 }} muted playsInline />
              <CVCanvas metrics={displayMetrics} width={400} height={300} />
              {cvStatus && !cvStatus.camera && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <p className="text-white text-sm">Camera not available</p>
                </div>
              )}
              {/* Video is mirrored (selfie); flip arrow for display */}
              {pointingActive && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-white text-[16px] font-bold" style={{ backgroundColor: 'rgba(91,91,240,0.6)' }}>
                  {displayH === 'left' ? '←' : '→'}
                </div>
              )}
            </div>
            <p className="mt-2 text-[13px]"><span style={S.text3}>Status: </span><span className="font-medium" style={{ color: faceColor }}>{faceLabel}</span></p>
          </div>

          {/* Card 2: Social Gaze */}
          <div style={S.card} className="p-4 shrink-0">
            <p style={S.label} className="mb-1">{t('social_gaze_label')}</p>
            <div className="flex items-baseline gap-2">
              <span style={S.hero}>{(displayMetrics?.social_gaze_percentage ?? 0).toFixed(0)}%</span>
              {/* Inline sparkline placeholder — thin bar */}
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E0E0E8' }}>
                <div className="h-full bg-[#0D9F7E] rounded-full transition-all duration-300" style={{ width: `${Math.min(100, displayMetrics?.social_gaze_percentage ?? 0)}%` }} />
              </div>
            </div>
            <p className="text-[14px] mt-1" style={{ fontFeatureSettings: '"tnum"' }}>
              <span className="font-bold" style={S.text1}>{displayMetrics?.social_gaze_events ?? 0}</span>
              <span style={S.text3}> {t('events_label')} · {t('longest_label')} </span>
              <span className="font-bold" style={S.text1}>{(displayMetrics?.longest_gaze_episode_sec ?? 0).toFixed(1)}s</span>
            </p>
            {gazeBestNotice && (
              <p className="mt-1.5 text-[12px] font-medium transition-opacity duration-700" style={{ color: '#0D9F7E' }}>
                {t('gaze_personal_best_notice')}
              </p>
            )}
          </div>

          {/* Card 3: Child Vocalization */}
          <div style={S.card} className="p-4 shrink-0">
            <div className="flex items-center gap-1.5 mb-1">
              <p style={S.label}>{t('child_vocalization_label')}</p>
              {/* Mic status indicator — green when mic permission was granted, red when denied */}
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: micAvailable ? '#4ADE80' : '#FB7185' }}
                title={micAvailable ? 'Microphone active' : 'Microphone unavailable'} />
            </div>
            {cvStatus && !micAvailable ? (
              <p className="text-[14px]" style={S.text3}>{t('mic_unavailable')}</p>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span style={S.hero}>{displayMetrics?.total_child_sounds ?? 0}</span>
                  <span className="text-[16px] font-medium" style={S.text3}>sounds</span>
                </div>
                <p className="text-[14px] mt-1" style={{ fontFeatureSettings: '"tnum"' }}>
                  <span style={S.text3}>{t('prompted_full')}: </span><span className="font-bold" style={S.text1}>{displayMetrics?.prompted_sounds ?? 0}</span>
                  <span style={S.text3}> · {t('spontaneous_full')}: </span><span className="font-bold" style={S.text1}>{displayMetrics?.spontaneous_sounds ?? 0}</span>
                </p>
                <div className="mt-2"><AudioVisualizer metrics={displayMetrics} /></div>
                <p className="text-[14px] mt-1.5" style={{ fontFeatureSettings: '"tnum"' }}>
                  <span className="font-bold" style={S.text1}>{displayMetrics?.adult_voice_count ?? 0}</span>
                  <span style={S.text3}> adult voice segments</span>
                </p>
              </>
            )}
          </div>

          {/* Card 4: Motor Activity */}
          <div style={S.card} className="p-4 shrink-0">
            <p style={S.label} className="mb-1">{t('motor_activity_label')}</p>
            <p className="text-[15px] font-semibold" style={{ color: displayMetrics?.hand_active ? '#0D9F7E' : '#C0C0CA' }}>
              {displayMetrics?.hand_active ? (displayMetrics.grip_label || t('hand_active')) : t('no_hand_activity')}
            </p>
            <p className="text-[14px] mt-1" style={{ fontFeatureSettings: '"tnum"' }}>
              <span style={S.text3}>Grasps </span><span className="font-bold" style={S.text1}>{displayMetrics?.successful_grasps ?? 0}</span>
              <span style={S.text3}> · Points </span><span className="font-bold" style={S.text1}>{displayMetrics?.pointing_events ?? 0}</span>
              <span style={S.text3}> · Reaches </span><span className="font-bold" style={S.text1}>{displayMetrics?.reaching_events ?? 0}</span>
            </p>
            <p className="text-[14px] mt-1">
              <span style={S.text3}>{t('pointing_label')}: </span>
              <span className="font-semibold" style={{ color: pointingActive ? '#5B5BF0' : '#C0C0CA' }}>{pointingText}</span>
            </p>
          </div>

          {/* Card 5: Spontaneous Moment — timeline only (button moved inline above response row) */}
          {spontMoments.length > 0 && (
            <div style={{ ...S.card, borderColor: '#D8D8F0' }} className="p-4 shrink-0">
              <p style={S.label} className="mb-2">{t('spontaneous_moment_label')}</p>
              <div className="relative h-6">
                <div className="absolute inset-x-0 top-1/2 h-px" style={{ backgroundColor: '#D4D4DC' }} />
                {spontMoments.map((sec, i) => {
                  const pct = sessionDuration > 0 ? Math.min(100, (sec / (sessionDuration * 60)) * 100) : 0;
                  return (
                    <button key={`${sec}-${i}`} onClick={() => { if (confirm(t('remove_moment'))) handleRemoveSpontMoment(i); }}
                      className="absolute w-3 h-3 rounded-full z-10 hover:scale-125 transition-transform"
                      style={{ left: `${pct}%`, backgroundColor: '#A5A5F0', transform: 'translateX(-50%)', top: 'calc(50% - 6px)' }}
                      title={formatTime(sec)} />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Debug panel — visible only with ?debug=1 */}
      {isDebugMode && cvMetrics && (
        <div className="fixed top-16 right-2 z-50 rounded-lg p-2 text-[10px] leading-[1.6] font-mono"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', color: '#0f0', maxWidth: 260 }}>
          <div>child_sounds: <b>{cvMetrics.total_child_sounds ?? 0}</b></div>
          <div>adult_voice: <b>{cvMetrics.adult_voice_count ?? 0}</b></div>
          <div>delta (2s window): <b>{pulseDebug.delta}</b></div>
          <div>time since trial: <b>{pulseDebug.timeSinceTrial > 0 ? `${(pulseDebug.timeSinceTrial / 1000).toFixed(0)}s` : 'never'}</b></div>
          <div>voice_state: <b>{cvMetrics.voice_state ?? 'n/a'}</b></div>
          <div>audio_level: <b>{(cvMetrics.audio_level ?? 0).toFixed(3)}</b></div>
          <div>pitch_hz: <b>{(cvMetrics.current_pitch_hz ?? 0).toFixed(0)}</b></div>
          <div>pitch_class: <b>{cvMetrics.pitch_classification ?? 'n/a'}</b></div>
          <div>suggestion: <b style={{ color: spontSuggestPulse ? '#ff0' : '#0f0' }}>{spontSuggestPulse ? 'ACTIVE' : 'off'}</b></div>
        </div>
      )}

      {/* PAUSED overlay banner */}
      {isPaused && (
        <div className="fixed inset-x-0 top-[52px] z-30 flex items-center justify-center gap-3 py-2" style={{ backgroundColor: '#A5A5F0' }}>
          <span className="text-white text-[16px]">⏸</span>
          <span className="text-white font-semibold text-[14px]">{t('session_paused')}</span>
          <span className="text-white/70 text-[12px]">{t('values_frozen')}</span>
          <button onClick={togglePause} className="rounded-lg px-4 py-1 text-[13px] font-semibold text-white" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
            {t('resume_session')}
          </button>
        </div>
      )}

      {/* Engagement unavailable toast */}
      {measurementStatus === 'trial-only' && phase === 'live' && (
        <div className="fixed left-1/2 top-16 z-30 -translate-x-1/2 rounded-lg px-4 py-2 text-[13px]" style={{ backgroundColor: '#FEF3E2', color: '#92600A', border: '1px solid #FDE8C8' }}>
          {t('engagement_trial_only_explainer')}
        </div>
      )}

      {/* Note modal — full-screen overlay with backdrop */}
      {showNotes && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain px-4 py-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNotes(false); }}>
          <div className="my-auto w-full max-w-[480px] rounded-xl p-4" style={{ ...S.card, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
            <h3 className="text-[16px] font-semibold mb-3" style={S.text1}>{t('add_note_title')}</h3>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
              className="block w-full rounded-lg px-3 py-2.5 text-[14px] resize-none"
              style={{ border: '1px solid #EBEBF0', color: '#1B1B2E', backgroundColor: '#F8F8FC', height: 120 }}
              placeholder={t('add_note')} autoFocus />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowNotes(false)} className="rounded-lg px-4 py-2 text-[13px]" style={S.text2}>{t('modal_cancel')}</button>
              <button onClick={handleSaveNote} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ backgroundColor: '#5B5BF0' }}>{t('save_note')}</button>
            </div>
          </div>
        </div>
      )}

      {/* End session confirmation */}
      <Modal open={endConfirmOpen} onClose={() => setEndConfirmOpen(false)} title={t('end_session_confirm')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">{t('end_session_confirm_body')}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEndConfirmOpen(false)}>{t('modal_cancel')}</Button>
            <Button variant="danger" onClick={handleEndSession}>{t('end_session')}</Button>
          </div>
        </div>
      </Modal>

      {/* Skip activity confirmation */}
      <Modal open={skipConfirmOpen} onClose={() => setSkipConfirmOpen(false)} title={t('skip_activity_confirm_title')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">{t('skip_activity_confirm_body')}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSkipConfirmOpen(false)}>{t('modal_cancel')}</Button>
            <Button onClick={() => { setSkipConfirmOpen(false); navigateActivity('next'); }}>{t('skip_activity')}</Button>
          </div>
        </div>
      </Modal>

      {/* Layer 2: Activity detail modal */}
      <Modal open={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={act?.name ?? ''}>
        {act && (() => {
          const l2 = {
            whatThisIs: pickField(act.what_this_is, act.what_this_is_hi, lang),
            whyWeDoIt: pickField(act.why_we_do_it, act.why_we_do_it_hi, lang),
            whyThisWorks: pickField(act.why_this_works, act.why_this_works_hi, lang),
            whatGoodLooksLike: pickField(act.what_good_looks_like, act.what_good_looks_like_hi, lang),
            whatWeMeasureHow: pickField(act.what_we_measure_how, act.what_we_measure_how_hi, lang),
            howThisHelps: pickField(act.how_this_helps, act.how_this_helps_hi, lang),
            whatWeDontMeasure: pickField(act.what_we_dont_measure, act.what_we_dont_measure_hi, lang),
            masteryBehaviour: pickField(act.mastery_behaviour, act.mastery_behaviour_hi, lang),
            steps: pickArrayField(act.therapist_steps, act.therapist_steps_hi, lang),
          };
          return (
          <div className="space-y-6 pr-1" style={{ maxWidth: 520 }}>
            {l2.whatThisIs && (
              <div>
                <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-1">{t('detail_what_this_is')}</p>
                <p className="text-[14px] leading-[1.65]" style={S.text2}>{l2.whatThisIs}</p>
              </div>
            )}

            {l2.whyWeDoIt && (
              <div>
                <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-1">{t('detail_why_we_do_it')}</p>
                <p className="text-[14px] leading-[1.65]" style={S.text2}>{l2.whyWeDoIt}</p>
              </div>
            )}

            {l2.whyThisWorks && (
              <div>
                <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-1">{t('detail_why_this_works')}</p>
                <p className="text-[14px] leading-[1.65]" style={S.text2}>{l2.whyThisWorks}</p>
              </div>
            )}

            {l2.whatGoodLooksLike && (
              <div>
                <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-1">{t('detail_what_good_looks_like')}</p>
                <p className="text-[14px] leading-[1.65]" style={S.text2}>{l2.whatGoodLooksLike}</p>
              </div>
            )}

            {/* Age band */}
            <div>
              <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-1">{t('detail_age_band')}</p>
              <p className="text-[14px] leading-[1.65]" style={S.text2}>{formatAgeRange(act.target_age_min_months, act.target_age_max_months)}</p>
            </div>

            {/* How to run it: materials + numbered-badge steps */}
            {(materials || l2.steps.length > 0) && (
              <div>
                <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-1.5">{t('detail_how_to_run')}</p>
                {materials && (
                  <p className="text-[14px] leading-[1.65] mb-2" style={S.text2}>
                    <span className="font-medium" style={S.text1}>{t('materials_label')}: </span>{materials}
                  </p>
                )}
                {l2.steps.length > 0 && (
                  <ol className="space-y-1.5">
                    {l2.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="shrink-0 flex items-center justify-center rounded-full text-[11px] font-semibold" style={{ width: 20, height: 20, backgroundColor: '#EEF2FF', color: '#5B5BF0', marginTop: 2 }}>
                          {i + 1}
                        </span>
                        <span className="text-[14px] leading-[1.65]" style={S.text2}>{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {l2.whatWeMeasureHow && (
              <div>
                <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-1">{t('detail_what_we_measure')}</p>
                <p className="text-[14px] leading-[1.65]" style={S.text2}>{l2.whatWeMeasureHow}</p>
              </div>
            )}

            {l2.howThisHelps && (
              <div>
                <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-1">{t('detail_how_this_helps')}</p>
                <p className="text-[14px] leading-[1.65]" style={S.text2}>{l2.howThisHelps}</p>
              </div>
            )}

            {/* What we don't measure — honesty block, visually distinct */}
            {l2.whatWeDontMeasure && (
              <div className="rounded-lg p-3" style={{ backgroundColor: '#FEF3E2', border: '1px solid #FDE8C8' }}>
                <p style={{ ...S.label, color: '#92600A', letterSpacing: 0.3 }} className="mb-1">{t('detail_what_we_dont_measure')}</p>
                <p className="text-[14px] leading-[1.65]" style={{ color: '#92600A' }}>{l2.whatWeDontMeasure}</p>
              </div>
            )}

            {/* Mastered when — checklist in a quiet tinted block */}
            {l2.masteryBehaviour && (
              <div className="rounded-lg p-3" style={{ backgroundColor: '#FAFAFC', border: '1px solid #F0F0F4' }}>
                <p style={{ ...S.label, letterSpacing: 0.3 }} className="mb-2">{t('detail_mastered_when')}</p>
                <ul className="space-y-2 text-[14px]" style={S.text2}>
                  <li className="flex items-start gap-2.5">
                    <span className="shrink-0 mt-0.5 flex items-center justify-center rounded" style={{ width: 16, height: 16, border: '1.5px solid #C0C0CA' }} />
                    <span className="leading-[1.5]">{t('detail_mastery_behaviour', { behaviour: l2.masteryBehaviour })}</span>
                  </li>
                  {act.mastery_frequency_num != null && act.mastery_frequency_denom != null && (
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 mt-0.5 flex items-center justify-center rounded" style={{ width: 16, height: 16, border: '1.5px solid #C0C0CA' }} />
                      <span className="leading-[1.5]">{t('detail_mastery_frequency', { num: act.mastery_frequency_num, denom: act.mastery_frequency_denom })}</span>
                    </li>
                  )}
                  {act.mastery_sessions != null && (
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 mt-0.5 flex items-center justify-center rounded" style={{ width: 16, height: 16, border: '1.5px solid #C0C0CA' }} />
                      <span className="leading-[1.5]">{t('detail_mastery_sessions', { sessions: act.mastery_sessions })}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Clinical reference — supervisor-only, always English */}
            {act.clinical_reference && (
              <div className="pt-3" style={{ borderTop: '1px solid #F0F0F4' }}>
                <p style={{ ...S.label, fontSize: 10, letterSpacing: 0.3 }} className="mb-0.5">{t('detail_clinical_reference')}</p>
                <p className="text-[12px] leading-[1.65]" style={S.text3}>{act.clinical_reference}</p>
              </div>
            )}
          </div>
          );
        })()}
      </Modal>
    </div>
  );
}

/* eslint-disable react-hooks/refs */
/* Audio diarization bar with rolling history */
function AudioVisualizer({ metrics }: { metrics: CVMetrics | null }) {
  const historyRef = useRef<Array<{ level: number; type: string }>>([]);

  const level = metrics?.audio_level ?? 0;
  const type = metrics?.pitch_classification ?? 'silence';

  historyRef.current.push({ level, type });
  if (historyRef.current.length > 30) historyRef.current.shift();
  const history = historyRef.current;

  return (
    <div>
      <div className="flex gap-0.5 h-5 items-end">
        {history.map((sample, i) => (
          <div key={i} className="w-1.5 rounded-t transition-all duration-75"
            style={{
              height: `${Math.max(2, sample.level * 300)}%`,
              backgroundColor: sample.type === 'child_voice' ? '#0D9F7E' : sample.type === 'adult_voice' ? '#5B5BF0' : '#E5E3DD',
            }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] mt-0.5">
        <span style={{ color: '#0D9F7E' }}>Child</span>
        <span style={{ color: '#5B5BF0' }}>Adult</span>
        <span style={{ color: '#9C9C95' }}>Silence</span>
      </div>
    </div>
  );
}
