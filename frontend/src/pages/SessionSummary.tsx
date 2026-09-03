import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useSession, useSessionActivities, useEngagementSamples, useFinalizeSession } from '../lib/queries/sessions';
import { useTrialsBySession } from '../lib/queries/trials';
import { useSessionEvents } from '../lib/queries/sessionEvents';
import { useToast } from '../lib/toastStore';
import { domainI18nKeys } from '../lib/domainLabels';
import Button from '../components/Button';
import Pill from '../components/Pill';
import Skeleton from '../components/Skeleton';
import EngagementTrace from '../components/charts/EngagementTrace';
import ActivityBarChart from '../components/charts/ActivityBarChart';
import StateTimeline from '../components/charts/StateTimeline';
import TrialDonut from '../components/charts/TrialDonut';
import VoiceDiarizationCard from '../components/charts/VoiceDiarizationCard';
import PromptLevelCard from '../components/charts/PromptLevelCard';
import TrialInferenceRow from '../components/charts/TrialInferenceRow';

import { getReadableActivityName } from '../lib/activity/readableName';
import { batchInferTrialsForSession } from '../lib/inference/batchProcessor';
import { deriveSessionProbes } from '../lib/derivation/deriveSessionProbes';
import { useInferencesForSession, useCorrectInference } from '../lib/queries/promptInferences';
import { buildMomentSentence } from '../lib/queries/myWork';
import type { Moment } from '../lib/queries/myWork';
import { supabase } from '../lib/supabase';

const S = {
  card: { background: '#FFF', border: '1px solid #EBEBF0', borderRadius: 12, boxShadow: '0 1px 2px rgba(230,230,235,0.5)' } as const,
  label: { color: '#7A7A92', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  text1: { color: '#1B1B2E' },
  text2: { color: '#5E5E7A' },
  text3: { color: '#8E8EA0' },
};

export default function SessionSummary() {
  const { t } = useTranslation();
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, memberships } = useAuth();
  const centerId = memberships[0]?.center_id ?? '';
  const qc = useQueryClient();
  const toast = useToast((s) => s.add);

  const { data: session, isLoading: sessionLoading } = useSession(sessionId);
  const { data: sessionActivities, isLoading: saLoading } = useSessionActivities(sessionId);
  const { data: engagementSamples, isLoading: engLoading } = useEngagementSamples(sessionId);
  const { data: trials } = useTrialsBySession(sessionId);
  const { data: sessionEvents } = useSessionEvents(sessionId);
  const finalize = useFinalizeSession(centerId);
  const { data: inferences } = useInferencesForSession(sessionId);
  const correctInference = useCorrectInference();

  const [finalNote, setFinalNote] = useState('');
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [closingView, setClosingView] = useState(false);
  const [closingMoment, setClosingMoment] = useState<Moment | null>(null);
  const [nextSessionDate, setNextSessionDate] = useState<string | null>(null);
  const [closingDuration, setClosingDuration] = useState(0);
  const [closingTrialCount, setClosingTrialCount] = useState(0);

  const samples = useMemo(() => engagementSamples ?? [], [engagementSamples]);
  const allTrials = useMemo(() => trials ?? [], [trials]);
  const events = useMemo(() => sessionEvents ?? [], [sessionEvents]);

  const duration = session?.started_at && session?.ended_at
    ? differenceInMinutes(new Date(session.ended_at), new Date(session.started_at))
    : session?.started_at
      ? differenceInMinutes(new Date(), new Date(session.started_at))
      : 0;

  const durationSec = session?.started_at && session?.ended_at
    ? differenceInSeconds(new Date(session.ended_at), new Date(session.started_at))
    : session?.started_at
      ? differenceInSeconds(new Date(), new Date(session.started_at))
      : 0;

  const sessionStartMs = session?.started_at ? new Date(session.started_at).getTime() : 0;

  // Build activity lookup
  const activityMap = useMemo(() => {
    const map: Record<string, { name: string; domain: string }> = {};
    for (const sa of sessionActivities ?? []) {
      if (sa.activity) map[sa.id] = { name: sa.activity.name, domain: sa.activity.developmental_domain };
    }
    return map;
  }, [sessionActivities]);

  // Engagement trace data
  const traceData = useMemo(() => {
    if (!sessionStartMs) return [];
    return samples.map((s) => ({
      timeSec: Math.max(0, (s.time - sessionStartMs) / 1000),
      engagement: Math.round(s.score * 100),
    }));
  }, [samples, sessionStartMs]);

  // Per-activity average engagement
  const activityEngagement = useMemo(() => {
    const buckets: Record<string, { sum: number; count: number; name: string }> = {};
    for (const s of samples) {
      const saId = s.sessionActivityId;
      const info = activityMap[saId];
      if (!info) continue;
      if (!buckets[saId]) buckets[saId] = { sum: 0, count: 0, name: info.name };
      buckets[saId].sum += s.score * 100;
      buckets[saId].count += 1;
    }
    return Object.values(buckets).map((b) => ({
      name: getReadableActivityName(b.name),
      engagement: b.count > 0 ? b.sum / b.count : 0,
    }));
  }, [samples, activityMap]);

  // Activity boundaries for chart
  const activityBoundaries = useMemo(() => {
    if (!sessionStartMs || !sessionActivities) return [];
    return sessionActivities
      .filter((sa) => sa.started_at)
      .map((sa) => ({
        timeSec: Math.max(0, (new Date(sa.started_at!).getTime() - sessionStartMs) / 1000),
        name: getReadableActivityName(sa.activity?.name ?? ''),
      }));
  }, [sessionActivities, sessionStartMs]);

  // State change events → regions
  const stateRegions = useMemo(() => {
    if (!sessionStartMs) return [];
    const stateChanges = events
      .filter((e) => e.event_type === 'state_change' && e.state_value)
      .map((e) => ({
        timeSec: (new Date(e.recorded_at).getTime() - sessionStartMs) / 1000,
        state: e.state_value as 'regulated' | 'amber' | 'dysregulated',
      }));
    if (stateChanges.length === 0) return [];

    const regions: { startSec: number; endSec: number; state: 'regulated' | 'amber' | 'dysregulated' }[] = [];
    for (let i = 0; i < stateChanges.length; i++) {
      const endSec = i < stateChanges.length - 1 ? stateChanges[i + 1].timeSec : durationSec;
      regions.push({ startSec: stateChanges[i].timeSec, endSec, state: stateChanges[i].state });
    }
    return regions;
  }, [events, sessionStartMs, durationSec]);

  // State timeline segments
  const stateSegments = useMemo(() => {
    return stateRegions.map((r) => ({
      state: r.state,
      durationSec: r.endSec - r.startSec,
    }));
  }, [stateRegions]);

  // Spontaneous dots
  const spontaneousDots = useMemo(() => {
    if (!sessionStartMs) return [];
    return events
      .filter((e) => e.event_type === 'spontaneous_initiation')
      .map((e) => ({ timeSec: (new Date(e.recorded_at).getTime() - sessionStartMs) / 1000 }));
  }, [events, sessionStartMs]);

  // Trial breakdown
  const trialCounts = useMemo(() => {
    const counts = { responded: 0, partial: 0, no_response: 0, refused: 0 };
    for (const t of allTrials) {
      if (t.response in counts) counts[t.response as keyof typeof counts]++;
    }
    return counts;
  }, [allTrials]);

  // Per-activity trial counts
  const trialsByActivity = useMemo(() => {
    const map: Record<string, { responded: number; partial: number; no_response: number; refused: number }> = {};
    for (const tr of allTrials) {
      if (!map[tr.session_activity_id]) map[tr.session_activity_id] = { responded: 0, partial: 0, no_response: 0, refused: 0 };
      if (tr.response in map[tr.session_activity_id]) {
        map[tr.session_activity_id][tr.response as keyof typeof trialCounts]++;
      }
    }
    return map;
  }, [allTrials]);

  // Inference map: trial_id → inference row
  const inferenceMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof inferences>[number]>();
    for (const inf of inferences ?? []) {
      map.set(inf.trial_id, inf);
    }
    return map;
  }, [inferences]);

  function toggleActivity(saId: string) {
    setExpandedActivities(prev => {
      const next = new Set(prev);
      if (next.has(saId)) next.delete(saId);
      else next.add(saId);
      return next;
    });
  }

  function handleCorrect(inferenceId: string, level: string) {
    if (!user) return;
    correctInference.mutate({
      inferenceId,
      correction: level as 'independent' | 'verbal_prompt' | 'gestural_prompt' | 'physical_prompt',
      userId: user.id,
    });
  }

  // Hero insight
  const heroInsight = useMemo(() => {
    if (activityEngagement.length === 0) return t('summary_fallback');
    const sorted = [...activityEngagement].sort((a, b) => b.engagement - a.engagement);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const spontCount = spontaneousDots.length;
    const stateCount = events.filter((e) => e.event_type === 'state_change').length;

    let text = `${session?.child?.full_name ?? 'Child'} was most engaged during ${best.name} (${best.engagement.toFixed(0)}%)`;
    if (sorted.length > 1 && worst.name !== best.name) {
      text += ` and least during ${worst.name} (${worst.engagement.toFixed(0)}%)`;
    }
    text += `. ${spontCount} spontaneous initiation${spontCount !== 1 ? 's' : ''}.`;
    text += ` ${stateCount} state shift${stateCount !== 1 ? 's' : ''} noted.`;
    return text;
  }, [activityEngagement, spontaneousDots, events, session, t]);

  async function handleFinalize() {
    if (!user || !sessionId) return;
    // Capture values before mutation invalidates the query cache
    const capturedDuration = duration;
    const capturedTrialCount = allTrials.length;
    try {
      await finalize.mutateAsync({
        sessionId,
        finalNote: finalNote.trim() || undefined,
        actorId: user.id,
      });
      toast(t('session_completed_toast'), 'success');
      sessionStorage.removeItem(`engagement-${sessionId}`);

      // Fire-and-forget: prompt-level inference (independent, non-critical)
      batchInferTrialsForSession(sessionId).catch(err =>
        console.error('[promptInference] Background inference failed', err),
      );

      // Awaited: derivation must complete before navigation so milestones/bests are written
      try {
        await deriveSessionProbes(sessionId);
      } catch (err) {
        console.error('[derivation] Progress derivation failed', err);
        toast(t('derivation_warning'), 'error');
      }

      // Invalidate derivation-dependent queries after derivation completes
      qc.invalidateQueries({ queryKey: ['milestones'] });
      qc.invalidateQueries({ queryKey: ['personal-bests'] });
      qc.invalidateQueries({ queryKey: ['baselines'] });

      // Query moments from THIS session: milestones/personal_bests whose probe belongs to this session
      try {
        const [{ data: pbRows }, { data: msRows }] = await Promise.all([
          supabase.from('personal_bests')
            .select('attribute_id, metric, value, achieved_at, probe:probes!inner(session_id, child:children!inner(full_name)), attribute:attributes!inner(parent_label)')
            .eq('probe.session_id', sessionId),
          supabase.from('milestones')
            .select('attribute_id, milestone_key, achieved_at, probe:probes!inner(session_id, child:children!inner(full_name)), attribute:attributes!inner(parent_label)')
            .eq('probe.session_id', sessionId),
        ]);

        // Prefer a milestone (a first) over a personal best
        let moment: Moment | null = null;
        if (msRows && msRows.length > 0) {
          const m = msRows[0];
          const attr = m.attribute as unknown as { parent_label: string };
          const probe = m.probe as unknown as { child: { full_name: string } };
          moment = { kind: 'milestone', childName: probe.child.full_name, attributeId: m.attribute_id, attributeLabel: attr.parent_label, metric: m.milestone_key, value: null, date: m.achieved_at };
        } else if (pbRows && pbRows.length > 0) {
          const b = pbRows[0];
          const attr = b.attribute as unknown as { parent_label: string };
          const probe = b.probe as unknown as { child: { full_name: string } };
          moment = { kind: 'personal_best', childName: probe.child.full_name, attributeId: b.attribute_id, attributeLabel: attr.parent_label, metric: b.metric, value: b.value, date: b.achieved_at };
        }
        queueMicrotask(() => setClosingMoment(moment));
      } catch { /* non-critical */ }

      // Query next scheduled session for this child
      try {
        const { data: nextSess } = await supabase
          .from('sessions')
          .select('scheduled_date')
          .eq('child_id', session?.child?.id ?? '')
          .eq('status', 'scheduled')
          .gt('scheduled_date', new Date().toISOString().slice(0, 10))
          .order('scheduled_date')
          .limit(1)
          .maybeSingle();
        if (nextSess) queueMicrotask(() => setNextSessionDate(nextSess.scheduled_date));
      } catch { /* non-critical */ }

      queueMicrotask(() => {
        setClosingDuration(capturedDuration);
        setClosingTrialCount(capturedTrialCount);
        setClosingView(true);
      });
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  if (sessionLoading || saLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F8FC' }}>
        <Skeleton className="h-60 w-96" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F8FC' }}>
        <p style={S.text3}>{t('error_generic')}</p>
      </div>
    );
  }

  const isFinalized = session.status === 'completed';
  const activityCount = sessionActivities?.length ?? 0;

  if (closingView) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F8FC' }}>
        <div className="mx-auto w-full max-w-lg px-6 py-12 space-y-5">
          <div className="p-6" style={S.card}>
            <p className="text-[16px] leading-relaxed" style={S.text1}>
              {t('closing_summary', { activities: activityCount, duration: closingDuration })}
            </p>

            {closingTrialCount > 0 && (
              <p className="mt-2 text-[14px]" style={S.text2}>
                {t('closing_trials', { trials: closingTrialCount })}
              </p>
            )}

            {closingMoment && (
              <p className="mt-4 text-[15px] leading-relaxed" style={{ ...S.text2, fontFamily: 'Fraunces, serif' }}>
                {buildMomentSentence(closingMoment, t)}
              </p>
            )}

            {nextSessionDate && (
              <p className="mt-4 text-[13px]" style={S.text3}>
                {t('closing_next_session', { date: format(new Date(nextSessionDate), 'EEEE, d MMMM') })}
              </p>
            )}
          </div>

          <div className="text-center">
            <Button onClick={() => navigate('/sessions')}>{t('closing_continue')}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F8FC' }}>

      {/* REGION 1 — Header */}
      <header className="flex items-center px-6 shrink-0 gap-4" style={{ height: 60, backgroundColor: '#FEFEFE', borderBottom: '1px solid #EBEBF0' }}>
        <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/sessions')} className="text-[14px]" style={S.text2}>
          ← {t('back')}
        </button>
        <div className="flex-1 text-center">
          <span className="text-[16px] font-semibold" style={S.text1}>{t('session_summary_title')}</span>
        </div>
        <span className="text-[13px]" style={S.text3}>
          {session.child?.full_name} · {format(new Date(session.scheduled_date), 'dd MMM')}
          {duration > 0 && ` · ${duration} min`}
        </span>
      </header>

      <div className="mx-auto max-w-[1180px] px-6 py-6 space-y-4">

        {/* REGION 2 — Hero Insight Card */}
        <div className="p-5" style={S.card}>
          <p className="text-[16px] leading-relaxed" style={{ ...S.text1, fontWeight: 500, lineHeight: 1.6 }}>
            {heroInsight}
          </p>
        </div>

        {/* REGION 3 — Engagement Trace */}
        <div className="p-4" style={S.card} data-tour="engagement-section">
          <div className="flex items-center justify-between mb-3">
            <p style={S.label}>{t('engagement_trace')}</p>
            <div className="flex items-center gap-4 text-[10px]" style={S.text3}>
              <span className="flex items-center gap-1"><span className="w-3 h-px inline-block" style={{ backgroundColor: '#D4D4DC', borderTop: '1px dashed #D4D4DC' }} /> Activity</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'hsl(245, 80%, 70%)' }} /> Spontaneous</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 inline-block rounded-sm" style={{ backgroundColor: 'hsl(150, 50%, 90%)' }} /> State</span>
            </div>
          </div>
          {engLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : traceData.length > 1 ? (
            <EngagementTrace
              data={traceData}
              stateRegions={stateRegions}
              activityBoundaries={activityBoundaries}
              spontaneousDots={spontaneousDots}
            />
          ) : (
            <p className="text-[13px] py-8 text-center" style={S.text3}>{t('engagement_no_data_for_session')}</p>
          )}
        </div>

        {/* REGION 4 — Two-column: By Activity + State Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4" style={S.card}>
            <p style={S.label} className="mb-3">{t('by_activity_label')}</p>
            <ActivityBarChart data={activityEngagement} />
          </div>
          <div className="p-4" style={S.card}>
            <p style={S.label} className="mb-3">{t('child_state_timeline_label')}</p>
            <StateTimeline segments={stateSegments} totalSec={durationSec} />
          </div>
        </div>

        {/* REGION 5 — Voice Diarization (full width) */}
        <div className="p-4" style={S.card}>
          <p style={S.label} className="mb-3">{t('voice_diarization_label')}</p>
          <VoiceDiarizationCard samples={samples} durationSec={durationSec} />
        </div>

        {/* REGION 5b — Two-column: Trials + Prompt Level */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4" style={S.card}>
            <p style={S.label} className="mb-3">{t('trial_breakdown_label')}</p>
            <TrialDonut counts={trialCounts} />
          </div>
          <div className="p-4" style={S.card}>
            <p style={S.label} className="mb-3">{t('prompt_level_label')}</p>
            <PromptLevelCard inferences={inferences ?? []} />
          </div>
        </div>



        {/* REGION 6 — Activities List */}
        <div>
          <p style={S.label} className="mb-3">{t('activities_for_session')}</p>
          <div className="space-y-3">
            {sessionActivities?.map((sa) => {
              const activity = sa.activity;
              if (!activity) return null;
              const actTrials = trialsByActivity[sa.id];
              const actSamples = samples.filter((s) => s.sessionActivityId === sa.id);
              const avgEng = actSamples.length > 0
                ? actSamples.reduce((sum, s) => sum + s.score, 0) / actSamples.length * 100
                : null;
              const actDuration = sa.started_at && sa.ended_at
                ? Math.round(differenceInSeconds(new Date(sa.ended_at), new Date(sa.started_at)) / 60)
                : null;

              return (
                <div key={sa.id} className="p-4" style={S.card}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold truncate" style={S.text1}>{activity.name}</p>
                        <Pill>{t(domainI18nKeys[activity.developmental_domain])}</Pill>
                      </div>
                      {sa.goal && (
                        <p className="mt-1 text-[12px]" style={{ color: '#5B5BF0' }}>{sa.goal.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {avgEng !== null && (
                        <span className="text-[13px] font-semibold" style={{ color: avgEng >= 60 ? '#0D9F7E' : avgEng >= 30 ? '#D97706' : '#A83246' }}>
                          {avgEng.toFixed(0)}%
                        </span>
                      )}
                      {actDuration !== null && (
                        <span className="text-[12px]" style={S.text3}>{actDuration} min</span>
                      )}
                    </div>
                  </div>
                  {actTrials && (
                    <p className="mt-1.5 text-[12px]" style={{ fontFeatureSettings: '"tnum"', ...S.text2 }}>
                      <span style={{ color: '#1A6B4F' }}>✓{actTrials.responded}</span>
                      {' '}<span style={{ color: '#92600A' }}>⚠{actTrials.partial}</span>
                      {' '}<span style={S.text3}>✗{actTrials.no_response}</span>
                      {' '}<span style={{ color: '#A83246' }}>⊘{actTrials.refused}</span>
                    </p>
                  )}
                  {sa.therapist_notes && (
                    <p className="mt-2 text-[13px] italic" style={S.text2}>{sa.therapist_notes}</p>
                  )}

                  {/* Per-trial inference detail (expand/collapse) */}
                  {(() => {
                    const saTrials = allTrials.filter(tr => tr.session_activity_id === sa.id);
                    const hasInferences = saTrials.some(tr => inferenceMap.has(tr.id));
                    if (!hasInferences || saTrials.length === 0) return null;
                    const isExpanded = expandedActivities.has(sa.id);
                    return (
                      <>
                        <button
                          onClick={() => toggleActivity(sa.id)}
                          className="mt-2 text-[11px] font-medium flex items-center gap-1"
                          style={{ color: '#7A7A92' }}
                        >
                          <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>&#x25B6;</span>
                          {isExpanded ? t('hide_trial_details') : t('show_trial_details')}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 border-t pt-2" style={{ borderColor: '#EBEBF0' }}>
                            {saTrials.map(tr => (
                              <TrialInferenceRow
                                key={tr.id}
                                trialNumber={tr.trial_number}
                                response={tr.response}
                                inference={inferenceMap.get(tr.id)}
                                onCorrect={handleCorrect}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* REGION 7 — Notes */}
        {sessionActivities?.some((sa) => sa.therapist_notes) && (
          <div>
            <p style={S.label} className="mb-3">{t('session_notes_label')}</p>
            <div className="space-y-2">
              {sessionActivities
                .filter((sa) => sa.therapist_notes)
                .map((sa) => (
                  <div key={sa.id} className="p-3" style={S.card}>
                    <p className="text-[12px] font-medium" style={S.text3}>{sa.activity?.name}</p>
                    <p className="mt-1 text-[13px]" style={S.text1}>{sa.therapist_notes}</p>
                  </div>
                ))}
            </div>
          </div>
        )}



        {/* REGION 8 — Finalize (only if not already finalized) */}
        {!isFinalized && (
          <div className="p-6" style={S.card}>
            <p className="text-[16px] font-semibold mb-3" style={S.text1}>{t('finalize_session')}</p>
            <textarea
              value={finalNote}
              onChange={(e) => setFinalNote(e.target.value)}
              placeholder={t('final_note')}
              className="block w-full rounded-lg px-3 py-2.5 text-[14px] resize-none"
              style={{ border: '1px solid #EBEBF0', color: '#1B1B2E', backgroundColor: '#F8F8FC', height: 100 }}
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/sessions')}>
                {t('modal_cancel')}
              </Button>
              <Button size="lg" onClick={handleFinalize}>
                {t('finalize_session')}
              </Button>
            </div>
          </div>
        )}

        {isFinalized && session.therapist_notes && (
          <div className="p-4" style={S.card}>
            <p style={S.label} className="mb-2">{t('final_note')}</p>
            <p className="text-[14px]" style={S.text1}>{session.therapist_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
