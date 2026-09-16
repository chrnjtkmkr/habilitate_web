import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

type StepState = 'done' | 'active' | 'locked';

interface Step {
  titleKey: string;
  descKey: string;
  state: StepState;
  href?: string;
}

interface WelcomeWizardProps {
  firstName: string;
  firstChildId: string | null;
  hasChild: boolean;
  hasIntake: boolean;
  hasPlan: boolean;
  hasCompletedSession: boolean;
  onDismiss: () => void;
}

const stepBg: Record<StepState, string> = {
  done: 'bg-[hsl(150,50%,92%)] text-[hsl(150,50%,28%)]',
  active: 'bg-white border-2 border-[hsl(260,45%,70%)] text-[hsl(260,45%,45%)]',
  locked: 'bg-gray-100 text-gray-400',
};

export default function WelcomeWizard({
  firstName, firstChildId, hasChild, hasIntake, hasPlan, hasCompletedSession, onDismiss,
}: WelcomeWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const steps: Step[] = [
    {
      titleKey: 'step_1_title',
      descKey: 'step_1_desc',
      state: hasChild ? 'done' : 'active',
      href: '/children/new',
    },
    {
      titleKey: 'step_2_title',
      descKey: 'step_2_desc',
      state: hasIntake ? 'done' : hasChild ? 'active' : 'locked',
      href: firstChildId ? `/children/${firstChildId}/intake` : undefined,
    },
    {
      titleKey: 'step_3_title',
      descKey: 'step_3_desc',
      state: hasPlan ? 'done' : hasIntake ? 'active' : 'locked',
      href: '/sessions',
    },
    {
      titleKey: 'step_4_title',
      descKey: 'step_4_desc',
      state: hasCompletedSession ? 'done' : hasPlan ? 'active' : 'locked',
      href: '/sessions',
    },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-[hsl(260,45%,85%)] p-5" style={{ backgroundColor: 'hsl(260, 45%, 97%)' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: 'hsl(260, 45%, 55%)' }}>
            {t('welcome_title')}
          </p>
          <p className="mt-1 text-[14px] text-ink-primary">
            {t('welcome_subtitle', { name: firstName })}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-xs text-ink-muted hover:text-ink-secondary hover:underline"
        >
          {t('skip_for_now')}
        </button>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-xl p-3 ${step.state === 'active' ? 'bg-white/80' : ''}`}
          >
            {/* Number badge */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${stepBg[step.state]}`}>
              {step.state === 'done' ? '\u2713' : i + 1}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className={`text-[14px] font-medium ${step.state === 'locked' ? 'text-ink-muted' : 'text-ink-primary'}`}>
                {t(step.titleKey)}
              </p>
              <p className="text-[12px] text-ink-muted">{t(step.descKey)}</p>
            </div>

            {/* Action */}
            <div className="shrink-0">
              {step.state === 'done' && (
                <span className="text-xs font-medium text-[hsl(150,50%,35%)]">{t('step_done')}</span>
              )}
              {step.state === 'active' && step.href && (
                <button
                  onClick={() => navigate(step.href!)}
                  className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                >
                  {t('step_continue')} &rarr;
                </button>
              )}
              {step.state === 'locked' && (
                <span className="text-xs text-ink-muted">{t('step_locked')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
