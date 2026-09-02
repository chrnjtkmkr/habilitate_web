import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Input from '../Input';
import PhoneInput from '../forms/PhoneInput';
import Textarea from '../Textarea';
import type { Json } from '../../types/supabase';

interface ItemOption {
  value: string | number;
  label_en: string;
  label_hi: string;
}

interface ItemResponse {
  type: string;
  options?: ItemOption[];
  max_length?: number;
  min?: number;
  max?: number;
  country_code?: string;
}

interface ItemSpec {
  id: string;
  question: { english: string; hindi: string };
  response: ItemResponse;
  required?: boolean;
  scoring_note?: string | null;
}

interface IntakeItemProps {
  item: ItemSpec;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
  readOnly?: boolean;
}

function optionLabel(opt: ItemOption, lang: string) {
  return lang === 'hi' ? opt.label_hi : opt.label_en;
}

export default function IntakeItem({ item, value, onChange, error, readOnly }: IntakeItemProps) {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;
  const question = lang === 'hi' ? item.question.hindi : item.question.english;
  const { response } = item;

  const renderField = () => {
    switch (response.type) {
      case 'text': {
        const isLong = (response.max_length ?? 0) > 200;
        if (isLong) {
          return (
            <Textarea
              label=""
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.currentTarget.value)}
              maxLength={response.max_length}
              disabled={readOnly}
              error={error}
            />
          );
        }
        return (
          <Input
            label=""
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.currentTarget.value)}
            maxLength={response.max_length}
            disabled={readOnly}
            error={error}
          />
        );
      }

      case 'phone':
        return (
          <PhoneInput
            label=""
            value={typeof value === 'string' ? value : ''}
            onChange={(v) => onChange(v)}
            disabled={readOnly}
            error={error}
          />
        );

      case 'date':
        return (
          <Input
            label=""
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.currentTarget.value)}
            min="2000-01-01"
            max={new Date().toISOString().split('T')[0]}
            disabled={readOnly}
            error={error}
          />
        );

      case 'number':
        return (
          <Input
            label=""
            type="number"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => {
              const n = e.currentTarget.value;
              onChange(n === '' ? '' : Number(n));
            }}
            min={response.min}
            max={response.max}
            disabled={readOnly}
            error={error}
          />
        );

      case 'single_select': {
        const options = response.options ?? [];
        const isScaleType = options.length >= 3 && options.every((o) => typeof o.value === 'number');

        if (isScaleType) {
          // Horizontal pill row on lg+, vertical on smaller
          return (
            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:gap-2">
              {options.map((opt) => {
                const selected = value === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange(opt.value)}
                    className={clsx(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors lg:text-center',
                      selected
                        ? 'border-primary-600 bg-primary-50 text-primary-700 font-medium'
                        : 'border-border bg-surface text-ink-primary hover:bg-primary-50',
                      readOnly && 'opacity-60',
                    )}
                  >
                    {optionLabel(opt, lang)}
                  </button>
                );
              })}
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
          );
        }

        // Regular radio group
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <label
                key={String(opt.value)}
                className={clsx(
                  'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                  value === opt.value
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-border bg-surface hover:bg-primary-50',
                  readOnly && 'pointer-events-none opacity-60',
                )}
              >
                <input
                  type="radio"
                  name={item.id}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  disabled={readOnly}
                  className="accent-primary-600"
                />
                <span className="text-ink-primary">{optionLabel(opt, lang)}</span>
              </label>
            ))}
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        );
      }

      case 'multi_select': {
        const options = response.options ?? [];
        const selected = Array.isArray(value) ? (value as (string | number)[]) : [];

        return (
          <div className="space-y-2">
            {options.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <label
                  key={String(opt.value)}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                    isChecked
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-border bg-surface hover:bg-primary-50',
                    readOnly && 'pointer-events-none opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const next = isChecked
                        ? selected.filter((v) => v !== opt.value)
                        : [...selected, opt.value];
                      onChange(next);
                    }}
                    disabled={readOnly}
                    className="accent-primary-600"
                  />
                  <span className="text-ink-primary">{optionLabel(opt, lang)}</span>
                </label>
              );
            })}
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        );
      }

      default:
        return <p className="text-sm text-ink-muted">Unsupported type: {response.type}</p>;
    }
  };

  return (
    <div className="py-3">
      <div className="mb-2 flex items-start gap-1">
        <span className="text-sm font-medium text-ink-primary">{question}</span>
        {item.required && <span className="text-danger text-xs">{t('required_indicator')}</span>}
        {item.scoring_note && (
          <span
            className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary-50 text-[10px] text-primary-600"
            title={item.scoring_note}
          >
            ?
          </span>
        )}
      </div>
      {renderField()}
    </div>
  );
}
