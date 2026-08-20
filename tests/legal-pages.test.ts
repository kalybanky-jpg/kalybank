import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getLegalPage, getLegalShell, interpolateLegalText } from '../lib/legal-i18n';
import type { Language } from '../lib/types';

const legalRoutes = [
  'mentions-legales',
  'confidentialite',
  'conditions-utilisation',
  'cookies',
] as const;

test('legacy legal routes redirect to stable localized URLs', async () => {
  for (const route of legalRoutes) {
    const source = await readFile(
      new URL(`../app/${route}/page.tsx`, import.meta.url),
      'utf8',
    );
    assert.match(source, /redirect\(localizedLegalPath\(language,/);
  }

  const localizedSource = await readFile(
    new URL('../app/[language]/[legalPage]/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(localizedSource, /generateStaticParams/);
  assert.match(localizedSource, /localizedLegalAlternates/);
  assert.match(localizedSource, /<LegalDocument/);
});

test('the global footer exposes every legal route from every page', async () => {
  const [layout, footer] = await Promise.all([
    readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/legal/LegalFooter.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(layout, /<LegalFooter bankName=\{initialBrand\.bankName\} \/>/);
  for (const page of ['notices', 'privacy', 'terms', 'cookies']) {
    assert.match(footer, new RegExp(`localizedLegalPath\\(language, '${page}'\\)`));
  }
  assert.match(footer, /NEXT_PUBLIC_SUPPORT_EMAIL/);
});

test('legal copy describes the operational and data-processing boundaries', async () => {
  const [translations, shell, selector] = await Promise.all([
    readFile(new URL('../lib/legal-i18n.ts', import.meta.url), 'utf8'),
    readFile(new URL('../components/legal/LegalPageShell.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/legal/LegalLanguageSelector.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(translations, /ne déclenche aucun mouvement financier automatique/);
  assert.match(translations, /2 C FINANCE/);
  assert.match(translations, /\{tradeName\}/);
  assert.match(translations, /979 247 145 00019/);
  assert.match(translations, /20 BOULEVARD MONTMARTRE/);
  assert.match(shell, /LEGAL_LAST_UPDATED = '18 août 2026'/);
  assert.match(translations, /selfie facultatif pris avec la caméra ou choisi dans la galerie/);
  assert.match(translations, /Le selfie est facultatif/);
  assert.match(translations, /Supabase/);
  assert.match(translations, /Netlify/);
  assert.match(translations, /Tawk\.to/);
  assert.match(translations, /ne se connecte pas à une infrastructure bancaire tierce/);
  assert.match(translations, /Stockages strictement nécessaires/);
  assert.match(selector, /LANGUAGE_OPTIONS/);
  assert.match(selector, /router\.push/);
  assert.match(selector, /isSupportedLanguage/);
  assert.match(
    interpolateLegalText(getLegalPage('fr', 'notices').sections[0]?.paragraphs?.[0] ?? '', 'Monalyz', 'support@monalyz.com'),
    /MONALYZ/,
  );
});

test('every legal page has complete copy in every supported language', () => {
  const languages: Language[] = ['fr', 'en', 'de', 'es', 'it', 'nl'];

  for (const language of languages) {
    const shellCopy = getLegalShell(language);
    assert.ok(shellCopy.back);
    assert.ok(shellCopy.updatedDate);

    for (const route of ['notices', 'privacy', 'terms', 'cookies'] as const) {
      const page = getLegalPage(language, route);
      assert.ok(page.title);
      assert.ok(page.description);
      assert.ok(page.introduction);
      assert.ok(page.sections.length >= 4);
      for (const section of page.sections) {
        assert.ok(section.title);
        assert.ok((section.paragraphs?.length ?? 0) + (section.items?.length ?? 0) > 0);
      }
    }
  }
});
