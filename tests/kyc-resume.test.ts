import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { kycTranslations } from '../lib/kyc-i18n';
import { SUPPORTED_LANGUAGES } from '../lib/language';

const readFileUtf8 = (relPath: string) =>
  readFile(new URL(relPath, import.meta.url), 'utf8');

test('onboarding page implements immediate step persistence and localStorage cache', async () => {
  const source = await readFileUtf8('../app/onboarding/page.tsx');

  // Verify localStorage helpers
  assert.match(source, /const LOCAL_DRAFT_KEY_PREFIX = 'monalyz_kyc_draft_';/);
  assert.match(source, /const LOCAL_CORRECTION_KEY_PREFIX = 'monalyz_kyc_correction_';/);
  assert.match(source, /function getLocalDraft/);
  assert.match(source, /function setLocalDraft/);
  assert.match(source, /function clearLocalDraft/);

  // Verify immediate persistence on step advancement and navigation
  assert.match(source, /const persistDraftImmediately = useCallback\(/);
  assert.match(source, /const next = async/);
  assert.match(source, /persistDraftImmediately\(nextIndex, nextKey, form, paths\)/);
  assert.match(source, /const handlePrevStep = \(\) =>/);
  assert.match(source, /persistDraftImmediately\(prevIndex, prevKey, form, paths\)/);

  // Verify step key persistence in payload for resilient matching
  assert.match(source, /currentStepKey: targetKey/);
  assert.match(source, /currentStepKey: step/);

  // Verify lifecycle listeners for unmount / tab close
  assert.match(source, /window\.addEventListener\('beforeunload', handleLeave\)/);
  assert.match(source, /document\.addEventListener\('visibilitychange', handleVisibility\)/);

  // Verify draft clearing on submit
  assert.match(source, /clearLocalDraft\(userIdRef\.current\)/);

  // Verify resume banner
  assert.match(source, /resumedFromStep/);
  assert.match(source, /copy\.resumeTitle/);
  assert.match(source, /copy\.resumeStep/);
});

test('UserKycStatusView displays resume status when draft is in progress', async () => {
  const source = await readFileUtf8('../components/UserKycStatusView.tsx');

  assert.match(source, /setDraftInfo/);
  assert.match(source, /kyc_drafts/);
  assert.match(source, /monalyz_kyc_draft_/);
  assert.match(source, /copy\.resume/);
  assert.match(source, /copy\.inProgress/);
});

test('KYC translations include resume copy in all 6 languages', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    const copy = kycTranslations[lang];
    assert.ok(copy.resumeTitle, `missing resumeTitle for ${lang}`);
    assert.ok(copy.resumeStep, `missing resumeStep for ${lang}`);
    assert.ok(copy.resumeKyc, `missing resumeKyc for ${lang}`);
  }

  // Verify IT and NL do not reuse FR or EN
  for (const lang of ['it', 'nl'] as const) {
    assert.notEqual(kycTranslations[lang].resumeTitle, kycTranslations.fr.resumeTitle);
    assert.notEqual(kycTranslations[lang].resumeTitle, kycTranslations.en.resumeTitle);
    assert.notEqual(kycTranslations[lang].resumeStep, kycTranslations.fr.resumeStep);
    assert.notEqual(kycTranslations[lang].resumeStep, kycTranslations.en.resumeStep);
    assert.notEqual(kycTranslations[lang].resumeKyc, kycTranslations.fr.resumeKyc);
    assert.notEqual(kycTranslations[lang].resumeKyc, kycTranslations.en.resumeKyc);
  }
});
