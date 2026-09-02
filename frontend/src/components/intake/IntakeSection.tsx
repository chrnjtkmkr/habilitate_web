import { useTranslation } from 'react-i18next';
import Pill from '../Pill';
import IntakeItem from './IntakeItem';
import type { Json } from '../../types/supabase';

interface SectionSpec {
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
}

interface IntakeSectionProps {
  section: SectionSpec;
  responses: Map<string, Json>;
  onResponseChange: (itemId: string, value: Json) => void;
  errors: Map<string, string>;
  readOnly?: boolean;
}

export default function IntakeSection({
  section,
  responses,
  onResponseChange,
  errors,
  readOnly,
}: IntakeSectionProps) {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;
  const sectionName = lang === 'hi' ? section.section_name_hi : section.section_name_en;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink-primary">{sectionName}</h2>
        <Pill variant="neutral">
          {t('section_estimated_minutes', { count: section.estimated_minutes })}
        </Pill>
      </div>

      <div className="divide-y divide-border">
        {section.items.map((item) => (
          <IntakeItem
            key={item.id}
            item={item}
            value={responses.get(item.id)}
            onChange={(val) => onResponseChange(item.id, val)}
            error={errors.get(item.id)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}
