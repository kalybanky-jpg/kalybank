import type { Language } from './types';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'de', 'es'] as const;

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
