import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { translations } from '../lib/i18n';
import {
  SUPPORTED_LANGUAGES,
  normalizeLanguageTag,
  parseAcceptLanguage,
  preferredLanguageMetadata,
  registrationLanguageMetadata,
  resolveInitialLanguage,
  resolveSupportedLanguage,
  shouldPersistLanguageCookie,
} from '../lib/language';

test('normalise les variantes BCP 47 prises en charge', () => {
  assert.equal(normalizeLanguageTag('fr-CA'), 'fr');
  assert.equal(normalizeLanguageTag('en-GB'), 'en');
  assert.equal(normalizeLanguageTag('de-DE'), 'de');
  assert.equal(normalizeLanguageTag('es-MX'), 'es');
  assert.equal(normalizeLanguageTag('pt-BR'), null);
});

test('retient la première langue compatible de navigator.languages', () => {
  assert.equal(resolveSupportedLanguage(['pt-BR', 'de-DE', 'en-US']), 'de');
  assert.equal(resolveSupportedLanguage(['zh-CN', 'pt-BR']), null);
});

test('respecte les poids et exclusions de Accept-Language', () => {
  assert.deepEqual(
    parseAcceptLanguage('fr-CA;q=0.6, en-GB;q=0.9, de-DE;q=0'),
    ['en-GB', 'fr-CA'],
  );
});

test('applique la priorité profil puis cookie explicite puis en-tête', () => {
  assert.deepEqual(
    resolveInitialLanguage({
      profileLanguage: 'de-DE',
      cookieLanguage: 'es',
      cookieSource: 'explicit',
      acceptedLanguages: ['en-GB'],
    }),
    { language: 'de', source: 'profile' },
  );
  assert.deepEqual(
    resolveInitialLanguage({
      cookieLanguage: 'es-MX',
      cookieSource: 'explicit',
      acceptedLanguages: ['en-GB'],
    }),
    { language: 'es', source: 'explicit' },
  );
});

test('ignore un cookie détecté comme préférence explicite et replie en français', () => {
  assert.deepEqual(
    resolveInitialLanguage({
      cookieLanguage: 'de',
      cookieSource: 'detected',
      acceptedLanguages: ['en-GB'],
    }),
    { language: 'en', source: 'header' },
  );
  assert.deepEqual(
    resolveInitialLanguage({ acceptedLanguages: ['pt-BR'] }),
    { language: 'fr', source: 'fallback' },
  );
});

test('une hydratation de profil ne remplace jamais le cookie explicite', () => {
  const withProfile = resolveInitialLanguage({
    profileLanguage: 'de',
    cookieLanguage: 'es',
    cookieSource: 'explicit',
    acceptedLanguages: ['en-GB'],
  });
  const afterLogout = resolveInitialLanguage({
    cookieLanguage: 'es',
    cookieSource: 'explicit',
    acceptedLanguages: ['en-GB'],
  });

  assert.deepEqual(withProfile, { language: 'de', source: 'profile' });
  assert.equal(shouldPersistLanguageCookie(withProfile.source), false);
  assert.deepEqual(afterLogout, { language: 'es', source: 'explicit' });
});

test('l’inscription utilise la langue courante au moment de la soumission', () => {
  assert.deepEqual(preferredLanguageMetadata('de'), {
    preferred_language: 'de',
  });
  assert.deepEqual(registrationLanguageMetadata('  Marie  ', 'en'), {
    display_name: 'Marie',
    full_name: 'Marie',
    preferred_language: 'en',
  });
  assert.deepEqual(registrationLanguageMetadata('Marie', 'es'), {
    display_name: 'Marie',
    full_name: 'Marie',
    preferred_language: 'es',
  });
});

test('les libellés distinguent la devise de base de la devise d’affichage', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const messages = translations[language];
    assert.match(messages.baseCurrency, /\S/);
    assert.match(messages.baseCurrencyHint, /\S/);
    assert.match(messages.currencySelector, /\S/);
    assert.match(messages.displayCurrencyHint, /\S/);
    assert.match(messages.displayCurrencySaving, /\S/);
    assert.match(messages.displayCurrencySaved, /\S/);
    assert.match(messages.displayCurrencySaveError, /\S/);
    assert.notEqual(messages.baseCurrency, messages.currencySelector);
  }
});

test('les paramètres auto-enregistrent uniquement la devise d’affichage après confirmation', async () => {
  const source = await readFile(
    new URL('../components/UserSettingsView.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /value=\{baseCurrency\}[\s\S]*?readOnly/);
  assert.match(source, /const \[draftCurrency, setDraftCurrency\] = useState<Currency>\(currency\)/);
  assert.match(source, /currencySaveInFlightRef\.current \|\| nextCurrency === currency/);
  assert.match(source, /\.update\(\{ preferred_currency: nextCurrency \}\)[\s\S]*?\.select\('preferred_currency'\)[\s\S]*?\.single\(\)/);
  assert.match(source, /updatedProfile\?\.preferred_currency !== nextCurrency[\s\S]*?setCurrency\(nextCurrency\)/);
  assert.match(source, /catch \{[\s\S]*?setDraftCurrency\(currency\)[\s\S]*?setCurrencyError/);
  assert.match(source, /onChange=\{\(event\) => void saveDisplayCurrency\(event\.target\.value as Currency\)\}/);
  assert.match(source, /disabled=\{isCurrencySaving \|\| isSaving\}/);

  const profileSaveStart = source.indexOf('  const save = async');
  const currencySaveStart = source.indexOf('  const saveDisplayCurrency = async');
  assert.ok(profileSaveStart >= 0 && currencySaveStart > profileSaveStart);
  const profileSave = source.slice(profileSaveStart, currencySaveStart);
  assert.doesNotMatch(profileSave, /preferred_currency|preferred_language|setCurrency/);
});
