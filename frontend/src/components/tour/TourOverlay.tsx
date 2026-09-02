import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../lib/toastStore';
import type { EventData } from 'react-joyride';

const Joyride = lazy(() => import('react-joyride').then((m) => ({ default: m.Joyride })));

function waitForElement(selector: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) { resolve(true); return; }
    const interval = 50;
    let elapsed = 0;
    const poll = setInterval(() => {
      elapsed += interval;
      if (document.querySelector(selector)) {
        clearInterval(poll);
        resolve(true);
      } else if (elapsed >= timeoutMs) {
        clearInterval(poll);
        console.warn(`[tour] Target "${selector}" not found after ${timeoutMs}ms, skipping step`);
        resolve(false);
      }
    }, interval);
  });
}

interface TourIds {
  childId: string;
  sessionId: string;
  reportId: string;
}

async function fetchTourIds(): Promise<TourIds | null> {
  const { data: centers } = await supabase
    .from('centers')
    .select('id')
    .eq('slug', 'sunshine-pediatric-indore')
    .limit(1);
  if (!centers || centers.length === 0) return null;
  const centerId = centers[0].id;

  const { data: children } = await supabase
    .from('children')
    .select('id')
    .eq('center_id', centerId)
    .eq('full_name', 'Vihaan Patel')
    .limit(1);
  if (!children || children.length === 0) return null;
  const childId = children[0].id;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('child_id', childId)
    .eq('status', 'completed')
    .order('scheduled_date')
    .range(4, 4);
  const sessionId = sessions?.[0]?.id ?? '';

  const { data: reports } = await supabase
    .from('parent_reports')
    .select('id')
    .eq('child_id', childId)
    .in('status', ['approved', 'sent'])
    .order('created_at', { ascending: false })
    .limit(1);
  const reportId = reports?.[0]?.id ?? '';

  return { childId, sessionId, reportId };
}

const STEP_TARGETS = [
  '[data-tour="trajectory-section"]',
  '[data-tour="child-goals"]',
  '[data-tour="engagement-section"]',
  '[data-tour="report-preview"]',
  '[data-tour="download-pdf"]',
];

function pathForStep(step: number, ids: TourIds): string {
  switch (step) {
    case 0: return '/dashboard';
    case 1: return `/children/${ids.childId}`;
    case 2: return `/sessions/${ids.sessionId}/summary`;
    case 3: return `/children/${ids.childId}/reports/${ids.reportId}`;
    case 4: return `/children/${ids.childId}/reports/${ids.reportId}`;
    default: return '/dashboard';
  }
}

export default function TourOverlay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [ids, setIds] = useState<TourIds | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [run, setRun] = useState(false);
  const [ready, setReady] = useState(false);
  const transitionRef = useRef(false);
  const tourNavRef = useRef(false);
  const toast = useToast((s) => s.add);

  const isTour = searchParams.get('tour') === '1'
    || sessionStorage.getItem('habilitate-tour') === 'active';

  const dismissTour = useCallback(() => {
    setRun(false);
    setReady(false);
    sessionStorage.removeItem('habilitate-tour');
    // Sign out the demo user and return to login
    supabase.auth.signOut().finally(() => {
      navigate('/signin', { replace: true });
    });
  }, [navigate]);

  const finishTour = useCallback(() => {
    toast(t('tour_complete_toast'), 'success');
    dismissTour();
  }, [dismissTour, toast, t]);

  // Advance past the current step (skip it), or finish if it was the last
  const skipToNext = useCallback((fromIndex: number) => {
    const next = fromIndex + 1;
    if (next >= STEP_TARGETS.length) {
      finishTour();
    } else {
      setRun(false);
      setStepIndex(next);
    }
  }, [finishTour]);

  // Fetch IDs once when tour activates
  useEffect(() => {
    if (!isTour) return;
    transitionRef.current = false;
    fetchTourIds().then((result) => {
      if (result) {
        setIds(result);
        setStepIndex(0);
        setRun(false);
        sessionStorage.setItem('habilitate-tour', 'active');
        setReady(true);
      }
    });
  }, [isTour]);

  // Navigate to the correct page, wait for target element, then start joyride
  useEffect(() => {
    if (!ready || !ids) return;
    transitionRef.current = false;

    const targetPath = pathForStep(stepIndex, ids);
    const onTarget = location.pathname === targetPath || location.pathname.startsWith(targetPath);
    if (!onTarget) {
      tourNavRef.current = true;
      navigate(targetPath, { replace: true });
      return;
    }
    let cancelled = false;
    transitionRef.current = true;
    tourNavRef.current = false;
    waitForElement(STEP_TARGETS[stepIndex]).then((found) => {
      if (cancelled) return;
      if (found) {
        setRun(true);
      } else {
        // Target never appeared — skip this step instead of freezing
        skipToNext(stepIndex);
      }
      transitionRef.current = false;
    });
    return () => { cancelled = true; transitionRef.current = false; };
  }, [ready, stepIndex, ids, location.pathname, navigate, skipToNext]);

  // Detect user-initiated navigation away from tour route — dismiss tour.
  useEffect(() => {
    if (!ready || !ids) return;
    if (tourNavRef.current) {
      tourNavRef.current = false;
      return;
    }
    const expectedPath = pathForStep(stepIndex, ids);
    const onExpected = location.pathname === expectedPath || location.pathname.startsWith(expectedPath);
    if (!onExpected) {
      queueMicrotask(() => dismissTour());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleEvent = useCallback((data: EventData) => {
    const { action, status, type } = data;

    if (status === 'finished') {
      finishTour();
      return;
    }
    if (status === 'skipped') {
      dismissTour();
      return;
    }

    // Safety net: if Joyride can't find a target, skip the step
    if (type === 'error:target_not_found' || type === 'error') {
      console.warn('[tour] Joyride target not found, skipping step', data.index);
      skipToNext(data.index);
      return;
    }

    if (type === 'step:after') {
      if (action === 'next') {
        const next = data.index + 1;
        if (next >= STEP_TARGETS.length) {
          finishTour();
          return;
        }
        setRun(false);
        setStepIndex(next);
      } else if (action === 'prev') {
        setRun(false);
        setStepIndex(Math.max(0, data.index - 1));
      } else if (action === 'close' || action === 'skip') {
        dismissTour();
      }
    }
  }, [dismissTour, finishTour, skipToNext]);

  if (!isTour || !ready || !ids) return null;

  const steps = [
    {
      target: STEP_TARGETS[0],
      title: t('tour_step1_title'),
      content: t('tour_step1_body'),
      placement: 'bottom' as const,
      disableBeacon: true,
      buttons: ['skip' as const, 'primary' as const],
    },
    {
      target: STEP_TARGETS[1],
      title: t('tour_step2_title'),
      content: t('tour_step2_body'),
      placement: 'bottom' as const,
      disableBeacon: true,
    },
    {
      target: STEP_TARGETS[2],
      title: t('tour_step3_title'),
      content: t('tour_step3_body'),
      placement: 'top' as const,
      disableBeacon: true,
    },
    {
      target: STEP_TARGETS[3],
      title: t('tour_step4_title'),
      content: t('tour_step4_body'),
      placement: 'left' as const,
      disableBeacon: true,
    },
    {
      target: STEP_TARGETS[4],
      title: t('tour_step5_title'),
      content: t('tour_step5_body'),
      placement: 'top' as const,
      disableBeacon: true,
      buttons: ['back' as const, 'primary' as const],
    },
  ];

  return (
    <>
      {/* Fix A: persistent full-screen click blocker that stays mounted for the entire tour.
          Joyride's own overlay has pointer-events:none on its container and unmounts between
          steps. This div sits below Joyride's z-index and blocks ALL page interaction. */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <Suspense fallback={null}>
        <Joyride
          steps={steps}
          stepIndex={stepIndex}
          run={run}
          continuous
          onEvent={handleEvent}
          options={{
            blockTargetInteraction: true,
            overlayClickAction: false,
            primaryColor: '#4f46e5',
            zIndex: 10000,
            showProgress: true,
            buttons: ['skip', 'back', 'primary'],
          }}
          locale={{
            back: t('tour_back'),
            close: t('tour_close'),
            last: t('tour_finish'),
            next: t('tour_next'),
            skip: t('tour_skip'),
          }}
          styles={{
            tooltip: {
              borderRadius: 16,
              padding: 20,
            },
            buttonPrimary: {
              borderRadius: 8,
              padding: '8px 20px',
            },
            buttonBack: {
              marginRight: 8,
            },
          }}
        />
      </Suspense>
    </>
  );
}
