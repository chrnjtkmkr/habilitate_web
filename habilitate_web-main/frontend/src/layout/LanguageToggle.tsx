import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

const languages = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: '\u0939\u093f\u0902' },
] as const;

export function LanguageToggle() {
  const { i18n } = useTranslation();

  return (
    <div className="flex rounded-lg border border-border">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={clsx(
            'min-h-[44px] px-3 py-1 text-sm font-medium transition-colors',
            lang.code === 'en' && 'rounded-l-lg',
            lang.code === 'hi' && 'rounded-r-lg',
            i18n.language.startsWith(lang.code)
              ? 'bg-primary-50 text-primary-700'
              : 'text-ink-secondary hover:bg-primary-50',
          )}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
