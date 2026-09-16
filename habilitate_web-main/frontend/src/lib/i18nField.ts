// Extract a language-specific string from a jsonb field like { english: "...", hindi: "..." }
export function pickLang(field: unknown, lang: string): string {
  if (!field || typeof field !== 'object') return '';
  const obj = field as Record<string, unknown>;
  const langKey = lang === 'hi' ? 'hindi' : 'english';
  return typeof obj[langKey] === 'string' ? obj[langKey] as string
    : typeof obj.english === 'string' ? obj.english as string
    : '';
}
