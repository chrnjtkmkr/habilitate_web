import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useChild } from '../lib/queries/children';
import { useGoals, useCreateGoal, useUpdateGoal, useMarkGoalMastered, useRetireGoal } from '../lib/queries/goals';
import { useActivities } from '../lib/queries/activities';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../lib/toastStore';
import { domainI18nKeys, skillLevelI18nKeys, ALL_DOMAINS, ALL_SKILL_LEVELS } from '../lib/domainLabels';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import Pill from '../components/Pill';
import Skeleton from '../components/Skeleton';
import type { Database } from '../types/supabase';

type GoalStatus = Database['public']['Enums']['goal_status'];
type ActivityDomain = Database['public']['Enums']['activity_domain'];
type SkillLevel = Database['public']['Enums']['skill_level'];

const statusVariants: Record<GoalStatus, 'success' | 'neutral' | 'default'> = {
  active: 'default',
  mastered: 'success',
  retired: 'neutral',
};

const tabs: GoalStatus[] = ['active', 'mastered', 'retired'];

export default function ChildGoals() {
  const { t } = useTranslation();
  const { id: childId } = useParams<{ id: string }>();
  const { user, memberships } = useAuth();
  const centerId = memberships[0]?.center_id ?? '';
  const toast = useToast((s) => s.add);

  const { data: child, isLoading: childLoading, isError: childError } = useChild(childId);
  const { data: goals, isLoading: goalsLoading } = useGoals(childId);
  const { data: activities } = useActivities();

  const [activeTab, setActiveTab] = useState<GoalStatus>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'master' | 'retire'; goalId: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    target_domain: '' as ActivityDomain | '',
    target_skill_level: '' as SkillLevel | '',
    mastery_criteria: '',
    activity_id: '' as string,
  });

  const createGoal = useCreateGoal(centerId);
  const updateGoal = useUpdateGoal(centerId);
  const markMastered = useMarkGoalMastered(centerId);
  const retireGoal = useRetireGoal(centerId);

  const filteredGoals = useMemo(
    () => goals?.filter((g) => g.status === activeTab) ?? [],
    [goals, activeTab],
  );

  // Filter activities by selected domain + skill level for the source activity picker
  const filteredActivities = useMemo(() => {
    if (!activities || !form.target_domain || !form.target_skill_level) return [];
    return activities.filter(
      (a) => a.developmental_domain === form.target_domain && a.skill_level === form.target_skill_level,
    );
  }, [activities, form.target_domain, form.target_skill_level]);

  function openAddModal() {
    setEditingGoal(null);
    setForm({ name: '', description: '', target_domain: '', target_skill_level: '', mastery_criteria: '', activity_id: '' });
    setModalOpen(true);
  }

  function openEditModal(goalId: string) {
    const g = goals?.find((x) => x.id === goalId);
    if (!g) return;
    setEditingGoal(goalId);
    setForm({
      name: g.name,
      description: g.description ?? '',
      target_domain: g.target_domain,
      target_skill_level: g.target_skill_level,
      mastery_criteria: g.mastery_criteria,
      activity_id: g.activity_id ?? '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!user || !childId || !form.name.trim() || !form.target_domain || !form.target_skill_level) return;
    try {
      if (editingGoal) {
        await updateGoal.mutateAsync({
          goalId: editingGoal,
          childId,
          updates: {
            name: form.name.trim(),
            description: form.description.trim() || null,
            target_domain: form.target_domain as ActivityDomain,
            target_skill_level: form.target_skill_level as SkillLevel,
            mastery_criteria: form.mastery_criteria.trim(),
            activity_id: form.activity_id || null,
          },
          actorId: user.id,
        });
      } else {
        await createGoal.mutateAsync({
          goal: {
            child_id: childId,
            name: form.name.trim(),
            description: form.description.trim() || null,
            target_domain: form.target_domain as ActivityDomain,
            target_skill_level: form.target_skill_level as SkillLevel,
            mastery_criteria: form.mastery_criteria.trim(),
            activity_id: form.activity_id || null,
          },
          actorId: user.id,
        });
      }
      toast(t('save'), 'success');
      setModalOpen(false);
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction || !user || !childId) return;
    try {
      if (confirmAction.type === 'master') {
        await markMastered.mutateAsync({ goalId: confirmAction.goalId, childId, actorId: user.id });
        toast(t('mark_mastered'), 'success');
      } else {
        await retireGoal.mutateAsync({ goalId: confirmAction.goalId, childId, actorId: user.id });
        toast(t('retire_goal'), 'success');
      }
      setConfirmAction(null);
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  if (childLoading || goalsLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;
  }

  if (childError || !child) {
    return <div className="rounded-2xl border border-border bg-surface p-8 text-center"><p className="text-ink-secondary">{t('error_generic')}</p></div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-primary">{t('goals_title')}</h1>
          {child && <p className="mt-1 text-sm text-ink-secondary">{child.full_name}</p>}
        </div>
        <Button onClick={openAddModal}>{t('add_goal')}</Button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-primary-50 text-primary-700' : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {t(`goal_status_${tab}`)}
            {goals && <span className="ml-1 text-xs">({goals.filter((g) => g.status === tab).length})</span>}
          </button>
        ))}
      </div>

      {/* Goal list */}
      {filteredGoals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-ink-secondary">
            {activeTab === 'active' ? t('no_active_goals_yet') : t('no_goals_yet')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGoals.map((goal) => (
            <div key={goal.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-ink-primary">{goal.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Pill>{t(domainI18nKeys[goal.target_domain])}</Pill>
                    <Pill variant={statusVariants[goal.status]}>{t(skillLevelI18nKeys[goal.target_skill_level])}</Pill>
                    <Pill variant={statusVariants[goal.status]}>{t(`goal_status_${goal.status}`)}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t('set_on', { date: format(new Date(goal.created_at), 'PP') })}
                  </p>
                </div>
                {goal.status === 'active' && (
                  <div className="relative">
                    <KebabMenu
                      onEdit={() => openEditModal(goal.id)}
                      onMaster={() => setConfirmAction({ type: 'master', goalId: goal.id })}
                      onRetire={() => setConfirmAction({ type: 'retire', goalId: goal.id })}
                      t={t}
                    />
                  </div>
                )}
              </div>
              {goal.mastery_criteria && (
                <p className="mt-2 text-sm text-ink-secondary">{goal.mastery_criteria}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit goal modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingGoal ? t('edit_goal') : t('add_goal')}>
        <div className="space-y-4">
          <Input
            label={t('goal_name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            required
            placeholder="Maintains eye contact during shared activity"
          />
          <Textarea
            label={t('goal_description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <Select
            label={t('target_domain')}
            value={form.target_domain}
            onChange={(e) => setForm({ ...form, target_domain: e.currentTarget.value as ActivityDomain, activity_id: '' })}
            placeholder={`-- ${t('target_domain')} --`}
            options={ALL_DOMAINS.map((d) => ({ value: d, label: t(domainI18nKeys[d]) }))}
          />
          <Select
            label={t('target_skill_level')}
            value={form.target_skill_level}
            onChange={(e) => setForm({ ...form, target_skill_level: e.currentTarget.value as SkillLevel, activity_id: '' })}
            placeholder={`-- ${t('target_skill_level')} --`}
            options={ALL_SKILL_LEVELS.map((s) => ({ value: s, label: t(skillLevelI18nKeys[s]) }))}
          />
          <Textarea
            label={t('mastery_criteria')}
            value={form.mastery_criteria}
            onChange={(e) => setForm({ ...form, mastery_criteria: e.currentTarget.value })}
          />
          {filteredActivities.length > 0 && (
            <Select
              label={t('source_activity')}
              value={form.activity_id}
              onChange={(e) => setForm({ ...form, activity_id: e.currentTarget.value })}
              placeholder={`-- ${t('source_activity')} --`}
              options={filteredActivities.map((a) => ({ value: a.id, label: a.name }))}
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('modal_cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || !form.target_domain || !form.target_skill_level}>
              {t('save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm action modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'master' ? t('mark_mastered_confirm') : t('retire_goal_confirm')}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            {confirmAction?.type === 'master' ? t('mark_mastered_confirm_body') : t('retire_goal_confirm_body')}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              {t('modal_cancel')}
            </Button>
            <Button onClick={handleConfirmAction}>{t('modal_confirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function KebabMenu({
  onEdit,
  onMaster,
  onRetire,
  t,
}: {
  onEdit: () => void;
  onMaster: () => void;
  onRetire: () => void;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 text-ink-secondary hover:bg-primary-50"
        aria-label="Menu"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-border bg-surface py-1 shadow-lg">
            <button onClick={() => { onEdit(); setOpen(false); }} className="block w-full px-4 py-2 text-left text-sm text-ink-primary hover:bg-primary-50">
              {t('edit_goal')}
            </button>
            <button onClick={() => { onMaster(); setOpen(false); }} className="block w-full px-4 py-2 text-left text-sm text-ink-primary hover:bg-primary-50">
              {t('mark_mastered')}
            </button>
            <button onClick={() => { onRetire(); setOpen(false); }} className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger/5">
              {t('retire_goal')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
