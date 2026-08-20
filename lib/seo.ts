import { safeHttpOrigin } from './security/navigation';
import type { Language } from './types';
import type { LegalPageKey } from './legal-i18n';

export const CANONICAL_ORIGIN =
  safeHttpOrigin(process.env.NEXT_PUBLIC_CANONICAL_ORIGIN) ??
  (process.env.NODE_ENV === 'production'
    ? 'https://bank.monalyz.com'
    : 'http://127.0.0.1:3000');

export const LEGAL_SLUGS: Record<LegalPageKey, string> = {
  notices: 'mentions-legales',
  privacy: 'confidentialite',
  terms: 'conditions-utilisation',
  cookies: 'cookies',
};

export const LEGAL_PAGE_BY_SLUG = Object.fromEntries(
  Object.entries(LEGAL_SLUGS).map(([page, slug]) => [slug, page]),
) as Record<string, LegalPageKey>;

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, CANONICAL_ORIGIN).toString();
}

export function localizedLegalPath(language: Language, page: LegalPageKey): string {
  return `/${language}/${LEGAL_SLUGS[page]}`;
}

export function localizedLegalAlternates(page: LegalPageKey): Record<string, string> {
  const languages: Language[] = ['fr', 'en', 'de', 'es', 'it', 'nl'];
  return {
    ...Object.fromEntries(
      languages.map((language) => [language, absoluteUrl(localizedLegalPath(language, page))]),
    ),
    'x-default': absoluteUrl(localizedLegalPath('fr', page)),
  };
}
