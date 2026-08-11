import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { kycTranslations, type KycCopy } from '../lib/kyc-i18n';
import { SUPPORTED_LANGUAGES } from '../lib/language';

const stepHintKeys = [
  'identityHint',
  'birthHint',
  'addressHint',
  'profileHint',
  'documentMetadataHint',
  'idFrontHint',
  'idBackHint',
  'proofOfAddressHint',
  'selfieHint',
] as const satisfies readonly (keyof KycCopy)[];

const placeholderKeys = [
  'firstNamePlaceholder',
  'lastNamePlaceholder',
  'placeOfBirthPlaceholder',
  'nationalityPlaceholder',
  'streetPlaceholder',
  'postalCodePlaceholder',
  'cityPlaceholder',
  'countryPlaceholder',
  'occupationPlaceholder',
  'incomePlaceholder',
  'documentTypePlaceholder',
  'documentNumberPlaceholder',
  'issuingCountryPlaceholder',
] as const satisfies readonly (keyof KycCopy)[];

test('every KYC step provides concise guidance in every supported language', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const copy = kycTranslations[language];

    for (const key of [...stepHintKeys, ...placeholderKeys]) {
      assert.match(copy[key], /\S/, `missing ${language} KYC copy for ${key}`);
    }

    for (const key of stepHintKeys) {
      assert.ok(
        copy[key].trim().split(/\s+/).length <= 12,
        `${language} KYC guidance is too long for ${key}`,
      );
    }

    assert.notEqual(copy.incomePlaceholder, copy.documentTypePlaceholder);
  }
});

test('the KYC form renders step guidance, accessible descriptions and field examples', async () => {
  const source = await readFile(
    new URL('../app/onboarding/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const STEP_HINT_KEYS/);
  assert.match(source, /aria-describedby=\{stepHintId\}/);
  assert.match(source, /stepTitleRef\.current\?\.focus\(\)/);
  assert.match(source, /tabIndex=\{-1\}/);
  assert.match(source, /placeholder:text-slate-500/);
  assert.match(source, /placeholder=\{placeholder\}/);
  assert.match(source, /placeholder=\{copy\.occupationPlaceholder\}/);
  assert.match(source, /placeholder=\{copy\.documentNumberPlaceholder\}/);
  assert.match(source, /placeholder=\{copy\.issuingCountryPlaceholder\}/);
  assert.match(source, /<option value="">\{copy\.documentTypePlaceholder\}<\/option>/);
});
