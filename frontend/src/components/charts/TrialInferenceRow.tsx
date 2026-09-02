import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Inference {
  id: string;
  trial_id: string;
  inferred_level: string;
  confidence: string;
  therapist_correction: string | null;
}

interface TrialInferenceRowProps {
  trialNumber: number;
  response: string;
  inference: Inference | undefined;
  onCorrect: (inferenceId: string, level: string) => void;
}

const LEVEL_LABELS: Record<string, string> = {
  independent: 'prompt_independent',
  verbal_prompt: 'prompt_verbal_full',
  gestural_prompt: 'prompt_gestural_full',
  physical_prompt: 'prompt_physical_full',
  unclear: 'prompt_unclear',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'confidence_high',
  medium: 'confidence_medium',
  low: 'confidence_low',
  very_low: 'confidence_very_low',
};

const LEVEL_ICONS: Record<string, string> = {
  independent: '\u2713',
  verbal_prompt: '\u26A1',
  gestural_prompt: '\u270B',
  physical_prompt: '\u270B',
  unclear: '?',
};

const LEVEL_COLORS: Record<string, string> = {
  independent: '#0D9F7E',
  verbal_prompt: '#7B61FF',
  gestural_prompt: '#D97706',
  physical_prompt: '#A83246',
  unclear: '#8E8EA0',
};

const CORRECTION_OPTIONS = ['independent', 'verbal_prompt', 'gestural_prompt', 'physical_prompt'] as const;

const RESPONSE_LABELS: Record<string, string> = {
  responded: 'trial_responded',
  partial: 'trial_partial',
  no_response: 'trial_no_response',
  refused: 'trial_refused',
};

export default function TrialInferenceRow({ trialNumber, response, inference, onCorrect }: TrialInferenceRowProps) {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  if (!inference) return null;

  const effectiveLevel = inference.therapist_correction ?? inference.inferred_level;
  const isCorrected = !!inference.therapist_correction;
  const color = LEVEL_COLORS[effectiveLevel] ?? LEVEL_COLORS.unclear;
  const icon = LEVEL_ICONS[effectiveLevel] ?? '?';

  return (
    <div className="flex items-center justify-between py-1.5 text-[12px]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 tabular-nums" style={{ color: '#7A7A92', width: 56 }}>
          {t('trial_label')} {trialNumber}
        </span>
        <span className="shrink-0" style={{ color: '#5E5E7A' }}>
          {t(RESPONSE_LABELS[response] ?? response)}
        </span>
        <span className="shrink-0 font-medium" style={{ color }}>
          {icon} {t(LEVEL_LABELS[effectiveLevel] ?? effectiveLevel)}
          {!isCorrected && (
            <span className="font-normal ml-1" style={{ color: '#8E8EA0' }}>
              ({t(CONFIDENCE_LABELS[inference.confidence] ?? inference.confidence)})
            </span>
          )}
          {isCorrected && (
            <span className="font-normal ml-1" style={{ color: '#8E8EA0' }}>
              \u2713
            </span>
          )}
        </span>
      </div>

      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="rounded px-2 py-0.5 text-[11px] font-medium hover:bg-gray-100"
          style={{ color: '#7A7A92' }}
        >
          {isCorrected ? t('edit_label') : t('correct_label')} \u25BE
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-lg border bg-white py-1 shadow-lg" style={{ borderColor: '#EBEBF0' }}>
            {CORRECTION_OPTIONS.map((level) => (
              <button
                key={level}
                className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-gray-50"
                style={{ color: effectiveLevel === level ? '#7B61FF' : '#1B1B2E' }}
                onClick={() => {
                  onCorrect(inference.id, level);
                  setDropdownOpen(false);
                }}
              >
                {LEVEL_ICONS[level]} {t(LEVEL_LABELS[level])}
                {effectiveLevel === level && ' \u2713'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
