import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useActivities, useCreateCustomActivity, SIGNAL_BUCKETS, type ActivityFilters, type SignalBucketId } from '../lib/queries/activities';
import { domainI18nKeys, skillLevelI18nKeys, ALL_DOMAINS, ALL_SKILL_LEVELS } from '../lib/domainLabels';
import { formatAgeRange, isAgeAppropriate } from '../lib/activity/content';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../lib/toastStore';
import Modal from './Modal';
import Button from './Button';
import Pill from './Pill';
import type { Database } from '../types/supabase';

type ActivityDomain = Database['public']['Enums']['activity_domain'];
type SkillLevel = Database['public']['Enums']['skill_level'];
type DiagnosticProfile = Database['public']['Enums']['diagnostic_profile'];
type Activity = Database['public']['Tables']['activities']['Row'];

interface ActiveGoal {
  target_domain: ActivityDomain;
  target_skill_level: SkillLevel;
}

interface ActivityPickerProps {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onDone: (ids: string[]) => void;
  activeGoals?: ActiveGoal[];
  childDiagnosticProfile?: DiagnosticProfile[];
  childAgeMonths?: number;
}

// i18n keys for each signal bucket — plain language for therapists
const SIGNAL_I18N: Record<SignalBucketId, string> = {
  cam_face: 'signal_looking',
  cam_hands: 'signal_hands',
  voice: 'signal_voice',
  therapist_scored: 'signal_therapist_scored',
};

const SIGNAL_ICONS: Record<SignalBucketId, string> = {
  cam_face: '👁️',
  cam_hands: '🖐️',
  voice: '🗣️',
  therapist_scored: '📋',
};

export default function ActivityPicker({ open, onClose, selected, onDone, activeGoals, childDiagnosticProfile, childAgeMonths }: ActivityPickerProps) {
  const { t } = useTranslation();
  const { user, memberships } = useAuth();
  const toast = useToast((s) => s.add);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [domainFilters, setDomainFilters] = useState<ActivityDomain[]>([]);
  const [levelFilters, setLevelFilters] = useState<SkillLevel[]>([]);
  const [linkedToGoals, setLinkedToGoals] = useState(() =>
    !!(activeGoals && activeGoals.length > 0),
  );
  const [ageAppropriate, setAgeAppropriate] = useState(() => childAgeMonths != null);
  const [localSelected, setLocalSelected] = useState<string[]>(selected);
  const [lastOpen, setLastOpen] = useState(open);
  if (open && !lastOpen) {
    setLocalSelected(selected);
  }
  if (open !== lastOpen) {
    setLastOpen(open);
  }

  // Creation form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSignals, setNewSignals] = useState<SignalBucketId[]>([]);
  const [newDuration, setNewDuration] = useState(5);
  const [newHasAge, setNewHasAge] = useState(false);
  const [newAgeMinYears, setNewAgeMinYears] = useState(0);
  const [newAgeMaxYears, setNewAgeMaxYears] = useState(6);
  const [newSteps, setNewSteps] = useState('');
  const createCustom = useCreateCustomActivity();

  function resetCreateForm() {
    setNewName('');
    setNewSignals([]);
    setNewDuration(5);
    setNewHasAge(false);
    setNewAgeMinYears(0);
    setNewAgeMaxYears(6);
    setNewSteps('');
    setShowCreateForm(false);
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = useMemo(() => {
    const f: ActivityFilters = {};
    if (domainFilters.length > 0) f.domains = domainFilters;
    if (levelFilters.length > 0) f.skillLevels = levelFilters;
    if (debouncedSearch.trim()) f.search = debouncedSearch.trim();
    if (childDiagnosticProfile && childDiagnosticProfile.length > 0) {
      f.diagnosticProfiles = childDiagnosticProfile;
    }
    if (linkedToGoals && activeGoals && activeGoals.length > 0) {
      f.goalDomains = activeGoals.map((g) => g.target_domain);
      f.goalSkillLevels = activeGoals.map((g) => g.target_skill_level);
    }
    if (ageAppropriate && childAgeMonths != null) {
      f.childAgeMonths = childAgeMonths;
    }
    return f;
  }, [domainFilters, levelFilters, debouncedSearch, linkedToGoals, activeGoals, childDiagnosticProfile, ageAppropriate, childAgeMonths]);

  const { data: activities = [] } = useActivities(filters);

  const toggleDomain = useCallback((d: ActivityDomain) => {
    setDomainFilters((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }, []);

  const toggleLevel = useCallback((l: SkillLevel) => {
    setLevelFilters((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);
  }, []);

  const toggleActivity = useCallback((id: string) => {
    setLocalSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  function toggleSignal(id: SignalBucketId) {
    setNewSignals((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleCreate() {
    if (!newName.trim() || newSignals.length === 0 || !user || !memberships[0]) return;
    try {
      const steps = newSteps.trim()
        ? newSteps.split('\n').map((s) => s.trim()).filter(Boolean)
        : [];
      const id = await createCustom.mutateAsync({
        name: newName.trim(),
        signalBucketIds: newSignals,
        durationMinutes: newDuration,
        ageMinMonths: newHasAge ? newAgeMinYears * 12 : undefined,
        ageMaxMonths: newHasAge ? newAgeMaxYears * 12 : undefined,
        steps,
        centerId: memberships[0].center_id,
        actorId: user.id,
      });
      setLocalSelected((prev) => [...prev, id]);
      toast(t('custom_activity_created'), 'success');
      resetCreateForm();
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  function handleDone() {
    onDone(localSelected);
    onClose();
  }

  const centerId = memberships[0]?.center_id;

  return (
    <Modal open={open} onClose={onClose} title={t('activity_picker_title')}>
      <div className="space-y-4">
        {/* Search */}
        <input
          type="text"
          placeholder={t('search_activities')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />

        {/* Domain chips */}
        <div className="flex flex-wrap gap-1">
          {ALL_DOMAINS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDomain(d)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                domainFilters.includes(d)
                  ? 'bg-primary-600 text-ink-inverse'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
              }`}
            >
              {t(domainI18nKeys[d])}
            </button>
          ))}
        </div>

        {/* Skill level chips */}
        <div className="flex flex-wrap gap-1">
          {ALL_SKILL_LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => toggleLevel(l)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                levelFilters.includes(l)
                  ? 'bg-primary-600 text-ink-inverse'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
              }`}
            >
              {t(skillLevelI18nKeys[l])}
            </button>
          ))}
        </div>

        {/* Filter toggles */}
        <div className="flex flex-wrap gap-4">
          {activeGoals && activeGoals.length > 0 && (
            <label className="flex items-center gap-2 text-sm font-medium text-ink-primary">
              <input
                type="checkbox"
                checked={linkedToGoals}
                onChange={(e) => setLinkedToGoals(e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              {t('linked_to_goals')}
            </label>
          )}
          {childAgeMonths != null && (
            <label className="flex items-center gap-2 text-sm font-medium text-ink-primary">
              <input
                type="checkbox"
                checked={ageAppropriate}
                onChange={(e) => setAgeAppropriate(e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              {t('age_appropriate')}
            </label>
          )}
        </div>

        {/* Activity list */}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {activities.map((a: Activity) => {
            const isSelected = localSelected.includes(a.id);
            const isCustom = a.validation_status === 'custom';
            const ageLabel = formatAgeRange(a.target_age_min_months, a.target_age_max_months);
            const outOfBand = childAgeMonths != null && !isAgeAppropriate(childAgeMonths, a.target_age_min_months, a.target_age_max_months);
            return (
              <div key={a.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isCustom ? 'border-dashed border-ink-muted' : 'border-border'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-ink-primary truncate">{a.name}</p>
                    {isCustom && <Pill variant="neutral">{t('custom_badge')}</Pill>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {!isCustom && <Pill>{t(domainI18nKeys[a.developmental_domain])}</Pill>}
                    {!isCustom && <Pill variant="neutral">{t(skillLevelI18nKeys[a.skill_level])}</Pill>}
                    {!isCustom && <span className="text-xs text-ink-muted">{ageLabel}</span>}
                    <span className="text-xs text-ink-muted">{a.duration_minutes} min</span>
                    {outOfBand && !isCustom && <span className="text-[10px] text-warning">{t('outside_age_band')}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isSelected ? 'secondary' : 'primary'}
                  onClick={() => toggleActivity(a.id)}
                  className="ml-2 shrink-0"
                >
                  {isSelected ? t('activity_remove') : t('activity_add')}
                </Button>
              </div>
            );
          })}
          {activities.length === 0 && (
            <div className="py-4 text-center">
              <p className="text-sm text-ink-secondary">{t('no_activities_found')}</p>
              {linkedToGoals && (
                <button
                  onClick={() => setLinkedToGoals(false)}
                  className="mt-2 text-sm text-primary-600 hover:underline"
                >
                  {t('show_all_activities')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create custom activity */}
        {centerId && user && (
          <div className="border-t border-border pt-3">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-sm font-medium text-primary-600 hover:underline"
              >
                {t('create_custom_activity')}
              </button>
            ) : (
              <div className="space-y-4 rounded-lg border border-dashed border-ink-muted bg-background p-4">
                <p className="text-sm font-semibold text-ink-primary">{t('create_custom_activity')}</p>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">{t('custom_name_label')}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('custom_name_placeholder')}
                    className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Signal declaration — the central point */}
                <div>
                  <label className="block text-sm font-semibold text-ink-primary mb-1">{t('custom_signal_label')}</label>
                  <p className="text-xs text-ink-secondary mb-2">{t('custom_signal_help')}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SIGNAL_BUCKETS.map((bucket) => {
                      const id = bucket.bucketId as SignalBucketId;
                      const isOn = newSignals.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleSignal(id)}
                          className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-3 text-left transition-all ${
                            isOn
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-border bg-surface hover:border-ink-muted'
                          }`}
                        >
                          <span className="text-lg">{SIGNAL_ICONS[id]}</span>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${isOn ? 'text-primary-700' : 'text-ink-primary'}`}>
                              {t(SIGNAL_I18N[id])}
                            </p>
                            <p className="text-xs text-ink-muted">{t(`${SIGNAL_I18N[id]}_desc`)}</p>
                          </div>
                          {isOn && (
                            <span className="ml-auto shrink-0 text-primary-600">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {newSignals.length === 0 && newName.trim() && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{t('custom_signal_required')}</p>
                  )}
                </div>

                {/* Duration — preset chips */}
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">{t('custom_duration_label')}</label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNewDuration(d)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          newDuration === d
                            ? 'bg-primary-600 text-ink-inverse'
                            : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                        }`}
                      >
                        {d} {t('min')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age range — optional */}
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary mb-1">
                    <input
                      type="checkbox"
                      checked={newHasAge}
                      onChange={(e) => setNewHasAge(e.target.checked)}
                      className="rounded border-border text-primary-600 focus:ring-primary-500"
                    />
                    {t('custom_age_label')} <span className="font-normal text-ink-muted">{t('optional')}</span>
                  </label>
                  {newHasAge && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <select
                        value={newAgeMinYears}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setNewAgeMinYears(v);
                          if (v > newAgeMaxYears) setNewAgeMaxYears(v);
                        }}
                        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink-primary"
                      >
                        {Array.from({ length: 19 }, (_, i) => (
                          <option key={i} value={i}>{i} {t('years_short')}</option>
                        ))}
                      </select>
                      <span className="text-xs text-ink-muted">{t('to')}</span>
                      <select
                        value={newAgeMaxYears}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setNewAgeMaxYears(v);
                          if (v < newAgeMinYears) setNewAgeMinYears(v);
                        }}
                        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink-primary"
                      >
                        {Array.from({ length: 19 }, (_, i) => (
                          <option key={i} value={i}>{i} {t('years_short')}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Steps — optional */}
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    {t('custom_steps_label')} <span className="font-normal text-ink-muted">{t('optional')}</span>
                  </label>
                  <textarea
                    value={newSteps}
                    onChange={(e) => setNewSteps(e.target.value)}
                    placeholder={t('custom_steps_placeholder')}
                    rows={3}
                    className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted resize-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={!newName.trim() || newSignals.length === 0 || createCustom.isPending}
                  >
                    {createCustom.isPending ? t('creating') : t('create_and_add')}
                  </Button>
                  <Button variant="secondary" onClick={resetCreateForm}>{t('modal_cancel')}</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-ink-secondary">
            {t('activities_selected_count', { count: localSelected.length })}
          </span>
          <Button onClick={handleDone}>{t('picker_done')}</Button>
        </div>
      </div>
    </Modal>
  );
}
