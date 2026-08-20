import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import robots from '../app/robots';
import sitemap from '../app/sitemap';

test('robots advertises the sitemap and excludes private application surfaces', () => {
  const value = robots();
  assert.match(String(value.sitemap), /\/sitemap\.xml$/);
  assert.ok(!String(value.host).includes('monalyz.com') || String(value.host).includes('bank.monalyz.com'));
  const rules = Array.isArray(value.rules) ? value.rules : [value.rules];
  const disallowed = rules.flatMap((rule) => rule.disallow ?? []);
  for (const path of ['/api/', '/admin', '/myaccount', '/onboarding', '/auth/']) {
    assert.ok(disallowed.includes(path));
  }
});

test('sitemap exposes public entry points and all 24 localized legal URLs', () => {
  const entries = sitemap();
  assert.equal(entries.length, 26);
  const pathnames = entries.map((entry) => new URL(entry.url).pathname);
  assert.ok(pathnames.includes('/login'));
  assert.ok(pathnames.includes('/register'));
  assert.ok(!pathnames.some((pathname) => pathname.startsWith('/admin')));

  const localized = entries.filter((entry) => entry.alternates?.languages);
  assert.equal(localized.length, 24);
  for (const entry of localized) {
    assert.deepEqual(
      Object.keys(entry.alternates?.languages ?? {}).sort(),
      ['de', 'en', 'es', 'fr', 'it', 'nl', 'x-default'],
    );
  }
});

test('canonical metadata, organization data and private noindex headers are versioned', async () => {
  const [layout, proxy, login, register] = await Promise.all([
    readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../proxy.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/login/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/register/layout.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(layout, /CANONICAL_ORIGIN/);
  assert.match(layout, /NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION/);
  assert.match(layout, /application\/ld\+json/);
  assert.match(layout, /'@type': 'Organization'/);
  assert.match(layout, /legalName: '2 C FINANCE'/);
  assert.match(proxy, /X-Robots-Tag', 'noindex, nofollow, noarchive'/);
  assert.match(login, /canonical: absoluteUrl\('\/login'\)/);
  assert.match(register, /canonical: absoluteUrl\('\/register'\)/);
});

test('Google Search Console verification file is published verbatim', async () => {
  const verification = await readFile(
    new URL('../public/googlecdd3581b40b5ac13.html', import.meta.url),
    'utf8',
  );
  assert.equal(
    verification.trim(),
    'google-site-verification: googlecdd3581b40b5ac13.html',
  );
});
