import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface PhoneInputProps {
  label: string;
  value: string;
  onChange: (e164: string) => void;
  required?: boolean;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

// Strip +91 prefix to get just the local digits
function toDigits(e164: string): string {
  return (e164 || '').replace(/^\+91/, '').replace(/\D/g, '').slice(0, 10);
}

// Format 10 digits as "98765 43210" for display
function formatDisplay(digits: string): string {
  if (digits.length <= 5) return digits;
  return digits.slice(0, 5) + ' ' + digits.slice(5);
}

export default function PhoneInput({ label, value, onChange, required, helperText, error, disabled, className }: PhoneInputProps) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);

  const digits = toDigits(value);
  const display = formatDisplay(digits);

  function handleChange(raw: string) {
    const cleaned = raw.replace(/\D/g, '').slice(0, 10);
    onChange(cleaned ? `+91${cleaned}` : '');
  }

  function handleBlur() {
    setTouched(true);
  }

  // Determine validation error (only after touch)
  let validationError = error;
  if (!validationError && touched) {
    if (digits.length > 0 && digits.length < 10) {
      validationError = t('phone_error_length');
    } else if (digits.length === 0 && required) {
      validationError = t('phone_error_required');
    }
  }

  const inputId = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-ink-primary">
          {label}
        </label>
      )}
      <div className={clsx(
        'flex overflow-hidden rounded-lg border',
        validationError ? 'border-danger' : 'border-border',
      )}>
        <span className="flex items-center bg-gray-100 px-3 text-sm text-ink-secondary select-none">
          +91
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          value={display}
          onChange={(e) => handleChange(e.currentTarget.value)}
          onBlur={handleBlur}
          placeholder={t('phone_placeholder')}
          className="block w-full bg-surface px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none"
          required={required}
          disabled={disabled}
        />
      </div>
      {helperText && !validationError && (
        <p className="mt-1 text-xs text-ink-muted">{helperText}</p>
      )}
      {validationError && <p className="mt-1 text-xs text-danger">{validationError}</p>}
    </div>
  );
}
