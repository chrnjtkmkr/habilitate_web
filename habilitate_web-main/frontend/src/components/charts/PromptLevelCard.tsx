import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface Inference {
  id: string;
  trial_id: string;
  inferred_level: string;
  confidence: string;
  therapist_correction: string | null;
}

interface PromptLevelCardProps {
  inferences: Inference[];
}

const LEVEL_KEYS: Record<string, string> = {
  independent: 'prompt_independent',
  verbal_prompt: 'prompt_verbal',
  gestural_prompt: 'prompt_gestural',
  physical_prompt: 'prompt_physical',
  unclear: 'prompt_unclear',
};

const TILE_COLORS: Record<string, { bg: string; text: string }> = {
  independent: { bg: 'hsl(150, 50%, 92%)', text: 'hsl(150, 50%, 28%)' },
  verbal_prompt: { bg: 'hsl(260, 45%, 92%)', text: 'hsl(260, 45%, 35%)' },
  gestural_prompt: { bg: 'hsl(38, 92%, 92%)', text: 'hsl(38, 70%, 35%)' },
  physical_prompt: { bg: 'hsl(350, 70%, 94%)', text: 'hsl(350, 70%, 35%)' },
  unclear: { bg: '#F0F0F4', text: '#7A7A92' },
};

const LEVELS_ORDER = ['independent', 'verbal_prompt', 'gestural_prompt', 'physical_prompt', 'unclear'] as const;

export default function PromptLevelCard({ inferences }: PromptLevelCardProps) {
  const { t } = useTranslation();

  const { counts, correctedCount, total } = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of LEVELS_ORDER) c[l] = 0;
    let corrected = 0;

    for (const inf of inferences) {
      // Use therapist correction if available, otherwise inferred level
      const effectiveLevel = inf.therapist_correction ?? inf.inferred_level;
      c[effectiveLevel] = (c[effectiveLevel] ?? 0) + 1;
      if (inf.therapist_correction) corrected++;
    }

    return { counts: c, correctedCount: corrected, total: inferences.length };
  }, [inferences]);

  if (inferences.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-[13px]" style={{ color: '#8E8EA0' }}>{t('no_inferences_yet')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Beta badge + subtitle */}
      <div className="flex items-center gap-2 mb-1">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'hsl(260, 45%, 92%)', color: 'hsl(260, 45%, 45%)' }}>
          {t('beta_label')}
        </span>
      </div>
      <p className="text-[12px] mb-4" style={{ color: '#8E8EA0', lineHeight: 1.5 }}>
        {t('prompt_inference_subtitle')}
      </p>

      {/* 5-column distribution */}
      <div className="grid grid-cols-5 gap-2">
        {LEVELS_ORDER.map((level) => {
          const color = TILE_COLORS[level];
          const count = counts[level] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isManualOnly = level === 'gestural_prompt' || level === 'physical_prompt';

          return (
            <div
              key={level}
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: color.bg }}
            >
              <p className="text-[11px] font-medium truncate" style={{ color: color.text }}>
                {t(LEVEL_KEYS[level])}
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: color.text }}>
                {count}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: color.text, opacity: 0.7 }}>
                {isManualOnly && count === 0 ? t('inference_manual_only') : `${pct}%`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Correction count */}
      {correctedCount > 0 && (
        <p className="mt-3 text-[12px]" style={{ color: '#7A7A92' }}>
          {t('corrected_count', { n: correctedCount, total })}
        </p>
      )}
    </div>
  );
}
