import type { Language } from './types';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'de', 'es', 'it', 'nl'] as const;

export const LANGUAGE_OPTIONS: ReadonlyArray<{
  code: Language;
  label: string;
}> = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
];

export const LANGUAGE_LOCALES: Record<Language, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  nl: 'nl-NL',
};

export function languageLocale(language: Language | string | null | undefined) {
  return isSupportedLanguage(language) ? LANGUAGE_LOCALES[language] : LANGUAGE_LOCALES.fr;
}

export function formatLocalizedDate(
  value: string | Date,
  language: Language,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(languageLocale(language), options).format(date);
}

export function formatLocalizedDateTime(value: string | Date, language: Language) {
  return formatLocalizedDate(value, language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatLocalizedPercent(value: number, language: Language) {
  return new Intl.NumberFormat(languageLocale(language), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatLocalizedMonths(value: number, language: Language) {
  return new Intl.NumberFormat(languageLocale(language), {
    style: 'unit',
    unit: 'month',
    unitDisplay: 'long',
  }).format(value);
}

export const LANGUAGE_COOKIE = 'monalyz-language';
export const LANGUAGE_SOURCE_COOKIE = 'monalyz-language-source';

export type LanguageSource =
  | 'profile'
  | 'explicit'
  | 'detected'
  | 'header'
  | 'fallback';

export interface InitialLanguageInput {
  profileLanguage?: string | null;
  cookieLanguage?: string | null;
  cookieSource?: string | null;
  acceptedLanguages?: readonly string[];
}

export interface ResolvedLanguage {
  language: Language;
  source: LanguageSource;
}

export function isSupportedLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export function normalizeLanguageTag(value: string | null | undefined): Language | null {
  if (!value) return null;
  const primarySubtag = value.trim().toLowerCase().split(/[-_]/, 1)[0];
  return isSupportedLanguage(primarySubtag) ? primarySubtag : null;
}

export function resolveSupportedLanguage(
  languageTags: readonly string[] | null | undefined,
): Language | null {
  for (const languageTag of languageTags ?? []) {
    const language = normalizeLanguageTag(languageTag);
    if (language) return language;
  }
  return null;
}

export function parseAcceptLanguage(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((entry, index) => {
      const [languageTag, ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().toLowerCase().startsWith('q='),
      );
      const parsedQuality = qualityParameter
        ? Number.parseFloat(qualityParameter.split('=')[1] ?? '')
        : 1;
      return {
        languageTag: languageTag?.trim() ?? '',
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
        index,
      };
    })
    .filter(({ languageTag, quality }) => Boolean(languageTag) && quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)
    .map(({ languageTag }) => languageTag);
}

export function resolveInitialLanguage(input: InitialLanguageInput): ResolvedLanguage {
  const profileLanguage = normalizeLanguageTag(input.profileLanguage);
  if (profileLanguage) {
    return { language: profileLanguage, source: 'profile' };
  }

  const explicitCookieLanguage =
    input.cookieSource === 'explicit'
      ? normalizeLanguageTag(input.cookieLanguage)
      : null;
  if (explicitCookieLanguage) {
    return { language: explicitCookieLanguage, source: 'explicit' };
  }

  const detectedLanguage = resolveSupportedLanguage(input.acceptedLanguages);
  if (detectedLanguage) {
    return { language: detectedLanguage, source: 'header' };
  }

  return { language: 'fr', source: 'fallback' };
}

export function shouldPersistLanguageCookie(source: LanguageSource): boolean {
  return source !== 'profile';
}

export function preferredLanguageMetadata(language: Language) {
  return { preferred_language: language };
}

export function registrationLanguageMetadata(
  displayName: string,
  language: Language,
) {
  return {
    display_name: displayName.trim(),
    full_name: displayName.trim(),
    ...preferredLanguageMetadata(language),
  };
}
