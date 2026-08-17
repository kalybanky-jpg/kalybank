import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const legalRoutes = [
  'mentions-legales',
  'confidentialite',
  'conditions-utilisation',
  'cookies',
] as const;

test('all public legal pages are versioned and expose metadata', async () => {
  for (const route of legalRoutes) {
    const source = await readFile(
      new URL(`../app/${route}/page.tsx`, import.meta.url),
      'utf8',
    );
    assert.match(source, /export const metadata: Metadata/);
    assert.match(source, /<LegalPageShell/);
  }
});

test('the global footer exposes every legal route from every page', async () => {
  const [layout, footer] = await Promise.all([
    readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/legal/LegalFooter.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(layout, /<LegalFooter bankName=\{initialBrand\.bankName\} \/>/);
  for (const route of legalRoutes) {
    assert.match(footer, new RegExp(`href: '/${route}'`));
  }
  assert.match(footer, /NEXT_PUBLIC_SUPPORT_EMAIL/);
});

test('legal copy describes the operational and data-processing boundaries', async () => {
  const [notices, privacy, terms, cookies] = await Promise.all([
    readFile(new URL('../app/mentions-legales/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/confidentialite/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/conditions-utilisation/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/cookies/page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(notices, /ne déclenche aucun mouvement financier automatique/);
  assert.match(privacy, /selfie pris avec la caméra ou choisi dans la galerie/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /Netlify/);
  assert.match(privacy, /Tawk\.to/);
  assert.match(terms, /ne se connecte pas à une infrastructure bancaire tierce/);
  assert.match(cookies, /Stockages strictement nécessaires/);
});
