import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { differenceInMonths, format } from 'date-fns';
import clsx from 'clsx';
import { useChild } from '../lib/queries/children';
import { useParents } from '../lib/queries/parents';
import {
  useActiveInstrument,
  useChildIntake,
  useStartOrResumeIntake,
  useUpsertResponse,
  useFinalizeIntake,
} from '../lib/queries/intake';
import { useIntakeStore } from '../lib/intakeStore';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../lib/toastStore';
import IntakeSection from '../components/intake/IntakeSection';
import Button from '../components/Button';
import Pill from '../components/Pill';
import Skeleton from '../components/Skeleton';
import Modal from '../components/Modal';
import type { Json } from '../types/supabase';

export default function IntakeWizard() {
  const { t, i18n } = useTranslation();
  const { id: childId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('mode') === 'view';
  const navigate = useNavigate();
  const { user, memberships } = useAuth();
  const toast = useToast((s) => s.add);
  const centerId = memberships[0]?.center_id;

  const { data: child, isLoading: childLoading } = useChild(childId);
  const { data: parents, isSuccess: parentsReady } = useParents(childId);
  // Only trust parent data that belongs to THIS child
  const verifiedParents = parentsReady && parents?.length && parents[0].child_id === childId ? parents : undefined;
  const primaryParent = verifiedParents?.find((p) => p.is_primary_contact) ?? verifiedParents?.[0];
  const { data: instrument, isLoading: instrumentLoading, isError: instrumentError } = useActiveInstrument();
  const { data: existingIntake, isLoading: intakeLoading } = useChildIntake(childId);

  const startOrResume = useStartOrResumeIntake();
  const upsertResponse = useUpsertResponse();
  const finalizeIntake = useFinalizeIntake();

  const store = useIntakeStore();
  const storeAssessmentId = useIntakeStore((s) => s.assessmentId);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Map<string, Json>>(new Map());
  const initStartedRef = useRef(false);

  // Reset singleton zustand store on mount so each child starts clean
  useEffect(() => {
    store.reset();
    return () => { store.reset(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Identity items shown as a read-only context card, not as form fields
  const IDENTITY_ITEM_IDS = new Set(['DEM-001', 'DEM-002', 'DEM-003']);

  // Build seed values from child + parent records (used for both fresh init and resume backfill)
  const buildSeed = useCallback((existing: Map<string, Json>): Map<string, Json> => {
    const seed = new Map(existing);
    // Identity: only seed when child record matches current childId
    if (child && child.id === childId) {
      if (!seed.has('DEM-001')) seed.set('DEM-001', child.full_name);
      if (!seed.has('DEM-002')) seed.set('DEM-002', child.date_of_birth);
    }
    // Parent demographics: seed only when missing and verified for this child
    if (primaryParent && primaryParent.child_id === childId) {
      if (!seed.has('DEM-004')) seed.set('DEM-004', primaryParent.full_name);
      if (!seed.has('DEM-005') && primaryParent.relationship) seed.set('DEM-005', primaryParent.relationship);
      if (!seed.has('DEM-006')) seed.set('DEM-006', primaryParent.phone);
      if (!seed.has('DEM-008')) {
        const langMap: Record<string, string> = { en: 'english', hi: 'hindi' };
        seed.set('DEM-008', langMap[primaryParent.preferred_language] ?? 'hindi');
      }
    }
    return seed;
  }, [child, primaryParent, childId]);

  // Parse instrument payload
  type SectionType = {
    section_id: string;
    section_name_en: string;
    section_name_hi: string;
    estimated_minutes: number;
    items: Array<{
      id: string;
      question: { english: string; hindi: string };
      response: {
        type: string;
        options?: Array<{ value: string | number; label_en: string; label_hi: string }>;
        max_length?: number;
        min?: number;
        max?: number;
        country_code?: string;
      };
      required?: boolean;
      scoring_note?: string | null;
    }>;
  };
  const sections = useMemo<SectionType[]>(() => {
    const payload = instrument?.payload as { sections?: SectionType[] } | undefined;
    return payload?.sections ?? [];
  }, [instrument?.payload]);

  // Initialize store on data load. store.init() updates zustand (external),
  // so it does not trigger the set-state-in-effect rule.
  useEffect(() => {
    if (storeAssessmentId || initStartedRef.current || !instrument || intakeLoading || !childId || !user || !centerId) return;

    const hydrateAndInit = (assessmentId: string, rawResponses: Array<{ item_id: string; response_value: Json }>) => {
      const resMap = new Map<string, Json>();
      for (const r of rawResponses) {
        resMap.set(r.item_id, r.response_value);
      }
      store.init(assessmentId, resMap);
      return resMap;
    };

    if (viewMode && existingIntake?.assessment) {
      const resMap = hydrateAndInit(existingIntake.assessment.id, existingIntake.responses);
      const seeded = buildSeed(resMap);
      store.init(existingIntake.assessment.id, seeded);
      return;
    }

    if (existingIntake?.assessment?.status === 'in_progress') {
      const resMap = hydrateAndInit(existingIntake.assessment.id, existingIntake.responses);
      const seeded = buildSeed(resMap);
      store.init(existingIntake.assessment.id, seeded);
      const idx = findFirstIncompleteSection(sections, seeded);
      store.setSection(idx);
      return;
    }

    if (viewMode && existingIntake?.assessment?.status === 'completed') {
      const resMap = hydrateAndInit(existingIntake.assessment.id, existingIntake.responses);
      const seeded = buildSeed(resMap);
      store.init(existingIntake.assessment.id, seeded);
      return;
    }

    if (!existingIntake?.assessment) {
      initStartedRef.current = true;
      startOrResume.mutate(
        { childId, instrumentId: instrument.id, userId: user.id, centerId },
        {
          onSuccess: (assessment) => {
            store.init(assessment.id, buildSeed(new Map()));
          },
        },
      );
    }
  }, [storeAssessmentId, instrument, intakeLoading, childId, user, centerId, existingIntake, viewMode, store, sections, startOrResume, buildSeed]);

  // Debounced autosave
  const flushSave = useCallback(async () => {
    if (!store.assessmentId || pendingRef.current.size === 0) return;
    store.markSaving();
    const batch = new Map(pendingRef.current);
    pendingRef.current.clear();

    try {
      for (const [itemId, val] of batch) {
        await upsertResponse.mutateAsync({
          assessmentId: store.assessmentId,
          itemId,
          responseValue: val,
          childId: childId!,
        });
      }
      store.markSaved();
    } catch {
      store.markFailed();
      // Re-add failed items to pending
      for (const [k, v] of batch) {
        pendingRef.current.set(k, v);
      }
    }
  }, [store, upsertResponse, childId]);

  const scheduleAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave();
    }, 1000);
  }, [flushSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        flushSave();
      }
      if (e.key === 'Escape') {
        flushSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [flushSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleResponseChange = (itemId: string, value: Json) => {
    if (IDENTITY_ITEM_IDS.has(itemId)) return;
    store.setResponse(itemId, value);
    pendingRef.current.set(itemId, value);
    scheduleAutosave();
    // Clear error for this item
    if (errors.has(itemId)) {
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const validateCurrentSection = (): boolean => {
    if (sections.length === 0) return false;
    const section = sections[store.currentSectionIndex];
    const newErrors = new Map<string, string>();

    for (const item of section.items) {
      if (!item.required) continue;
      const val = store.responses.get(item.id);
      if (val === undefined || val === null || val === '') {
        newErrors.set(item.id, t('required_field'));
      }
    }

    setErrors(newErrors);
    return newErrors.size === 0;
  };

  const handleNext = async () => {
    if (!validateCurrentSection()) return;
    await flushSave();

    if (store.currentSectionIndex === sections.length - 1) {
      setShowFinalizeModal(true);
    } else {
      store.setSection(store.currentSectionIndex + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (store.currentSectionIndex > 0) {
      store.setSection(store.currentSectionIndex - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleFinalize = async () => {
    if (!store.assessmentId || !childId || !child || !instrument || !user || !centerId) return;
    setShowFinalizeModal(false);

    try {
      await flushSave();
      await finalizeIntake.mutateAsync({
        assessmentId: store.assessmentId,
        childId,
        childDob: child.date_of_birth,
        instrumentPayload: instrument.payload,
        responses: store.responses,
        userId: user.id,
        centerId,
      });
      toast(t('intake_completed_toast'), 'success');
      store.reset();
      navigate(`/children/${childId}`);
    } catch {
      toast(t('intake_finalize_error'), 'error');
    }
  };

  const handleSaveAndExit = async () => {
    await flushSave();
    navigate(`/children/${childId}`);
  };

  // Error: no active intake instrument configured
  if (instrumentError || (!instrumentLoading && !instrument)) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-ink-secondary">{t('intake_no_instrument')}</p>
          <button onClick={() => navigate(`/children/${childId}`)} className="mt-3 rounded-lg border border-border px-4 py-2 text-sm text-ink-primary hover:bg-primary-50">
            {t('back_to_child')}
          </button>
        </div>
      </div>
    );
  }

  // Loading states
  if (childLoading || instrumentLoading || intakeLoading || !storeAssessmentId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!child) {
    return <p className="p-4 text-ink-secondary">{t('error_generic')}</p>;
  }

  if (sections.length === 0) {
    return <p className="p-4 text-ink-secondary">{t('error_generic')}</p>;
  }

  const currentSection = sections[store.currentSectionIndex];
  const filteredSection = currentSection.section_id === 'SEC-01'
    ? { ...currentSection, items: currentSection.items.filter((item) => !IDENTITY_ITEM_IDS.has(item.id)) }
    : currentSection;
  const ageMonths = differenceInMonths(new Date(), new Date(child.date_of_birth));
  const ageYears = Math.floor(ageMonths / 12);
  const ageRem = ageMonths % 12;
  const isLastSection = store.currentSectionIndex === sections.length - 1;
  const isReadOnly = viewMode || existingIntake?.assessment?.status === 'completed';

  return (
    <div className="mx-auto max-w-3xl">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <h1 className="text-lg font-semibold text-ink-primary">{child.full_name}</h1>
              <p className="text-xs text-ink-secondary">
                {t('age_years', { years: ageYears, months: ageRem })}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {child.diagnostic_profile?.map((d) => (
                <Pill key={d} variant="default">
                  {d}
                </Pill>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {!isReadOnly && (
              <span
                className={clsx(
                  'text-xs',
                  store.saveStatus === 'saved' && 'text-success',
                  store.saveStatus === 'saving' && 'text-ink-muted',
                  store.saveStatus === 'failed' && 'text-danger',
                )}
              >
                {store.saveStatus === 'saved' && t('save_indicator_saved')}
                {store.saveStatus === 'saving' && t('save_indicator_saving')}
                {store.saveStatus === 'failed' && (
                  <>
                    {t('save_indicator_failed')}{' '}
                    <button
                      onClick={flushSave}
                      className="underline"
                    >
                      {t('retry_save')}
                    </button>
                  </>
                )}
              </span>
            )}
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'hi' ? 'en' : 'hi')}
              className="rounded-lg border border-border px-2 py-1 text-xs text-ink-secondary hover:bg-primary-50"
            >
              {i18n.language === 'hi' ? 'EN' : 'HI'}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSaveAndExit}
                className="text-xs text-primary-600 hover:underline"
              >
                {t('save_and_exit')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress strip */}
      <div
        className="flex items-center justify-center gap-2 py-3"
        role="progressbar"
        aria-label={t('intake_progress_aria_label', {
          current: store.currentSectionIndex + 1,
          total: sections.length,
        })}
        aria-valuenow={store.currentSectionIndex + 1}
        aria-valuemin={1}
        aria-valuemax={sections.length}
      >
        {sections.map((sec, idx) => {
          const isCurrent = idx === store.currentSectionIndex;
          const isCompleted = idx < store.currentSectionIndex;
          return (
            <button
              key={sec.section_id}
              onClick={() => {
                if (isCompleted || isReadOnly) store.setSection(idx);
              }}
              disabled={!isCompleted && !isCurrent && !isReadOnly}
              className={clsx(
                'h-2.5 w-2.5 rounded-full transition-colors',
                isCurrent && 'bg-primary-600',
                isCompleted && 'bg-primary-200 hover:bg-primary-400 cursor-pointer',
                !isCurrent && !isCompleted && 'bg-border',
              )}
              title={i18n.language === 'hi' ? sec.section_name_hi : sec.section_name_en}
            />
          );
        })}
      </div>

      {/* Section content */}
      <div className="px-4 pb-24">
        {currentSection.section_id === 'SEC-01' && child && child.id === childId && (
          <div className="mb-4 rounded-xl border border-border bg-gray-50 px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-ink-muted">{t('full_name')}</p>
                <p className="font-medium text-ink-primary">{child.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t('date_of_birth')}</p>
                <p className="font-medium text-ink-primary">
                  {format(new Date(child.date_of_birth), 'd MMM yyyy')}{' '}
                  <span className="font-normal text-ink-muted">
                    ({t('age_years', { years: ageYears, months: ageRem })})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t('gender')}</p>
                <p className="font-medium text-ink-primary">
                  {child.gender
                    ? t(`gender_${child.gender.toLowerCase()}`, { defaultValue: child.gender })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{t('primary_language')}</p>
                <p className="font-medium text-ink-primary">
                  {t(`lang_${child.primary_language}`, { defaultValue: child.primary_language })}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">{t('identity_from_profile')}</p>
          </div>
        )}
        <IntakeSection
          section={filteredSection}
          responses={store.responses}
          onResponseChange={handleResponseChange}
          errors={errors}
          readOnly={isReadOnly}
        />
      </div>

      {/* Bottom bar */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Button
              variant="secondary"
              onClick={handlePrevious}
              disabled={store.currentSectionIndex === 0}
            >
              {t('previous')}
            </Button>
            <span className="text-sm text-ink-secondary">
              {t('section_of', {
                current: store.currentSectionIndex + 1,
                total: sections.length,
              })}
            </span>
            <Button
              onClick={handleNext}
              disabled={finalizeIntake.isPending}
            >
              {isLastSection ? t('complete_intake') : t('next')}
            </Button>
          </div>
        </div>
      )}

      {/* View-mode section selector */}
      {isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Button
              variant="secondary"
              onClick={handlePrevious}
              disabled={store.currentSectionIndex === 0}
            >
              {t('previous')}
            </Button>
            <span className="text-sm text-ink-secondary">
              {t('section_of', {
                current: store.currentSectionIndex + 1,
                total: sections.length,
              })}
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                if (store.currentSectionIndex < sections.length - 1) {
                  store.setSection(store.currentSectionIndex + 1);
                  window.scrollTo(0, 0);
                }
              }}
              disabled={store.currentSectionIndex === sections.length - 1}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      {/* Finalize confirmation modal */}
      <Modal
        open={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        title={t('intake_finalize_confirm')}
      >
        <p className="mb-4 text-sm text-ink-secondary">{t('intake_finalize_confirm_body')}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowFinalizeModal(false)}>
            {t('modal_cancel')}
          </Button>
          <Button onClick={handleFinalize} disabled={finalizeIntake.isPending}>
            {finalizeIntake.isPending ? t('save_indicator_saving') : t('complete_intake')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function findFirstIncompleteSection(
  sections: Array<{ items: Array<{ id: string; required?: boolean }> }>,
  responses: Map<string, Json>,
): number {
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    for (const item of section.items) {
      if (!item.required) continue;
      const val = responses.get(item.id);
      if (val === undefined || val === null || val === '') return i;
    }
  }
  return 0;
}
