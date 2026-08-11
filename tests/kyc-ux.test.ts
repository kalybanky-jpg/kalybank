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

const uploadFeedbackKeys = [
  'pdfSelected',
  'selfiePreview',
  'preparingFile',
  'uploadingFile',
  'uploadSuccess',
  'retryUpload',
] as const satisfies readonly (keyof KycCopy)[];

test('every KYC step provides concise guidance in every supported language', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const copy = kycTranslations[language];

    for (const key of [...stepHintKeys, ...placeholderKeys, ...uploadFeedbackKeys]) {
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

test('KYC evidence uploads paint a local preview and expose resilient per-file feedback', async () => {
  const source = await readFile(
    new URL('../app/onboarding/page.tsx', import.meta.url),
    'utf8',
  );

  const uploadStart = source.indexOf('const upload = async');
  const previewCreation = source.indexOf('URL.createObjectURL(original)', uploadStart);
  const paintYield = source.indexOf('await waitForNextPaint()', uploadStart);
  const preparation = source.indexOf('await prepareImage(', uploadStart);
  const remoteUpload = source.indexOf("await uploadEvidence('kyc-evidence'", uploadStart);

  assert.ok(uploadStart >= 0);
  assert.ok(previewCreation > uploadStart && previewCreation < paintYield);
  assert.ok(paintYield < preparation && preparation < remoteUpload);
  assert.ok((source.match(/window\.requestAnimationFrame/g) ?? []).length >= 2);
  assert.match(source, /type UploadPhase = 'idle' \| 'preparing' \| 'uploading' \| 'success' \| 'error'/);
  assert.match(source, /aria-live=\{phase === 'error' \? 'assertive' : 'polite'\}/);
  assert.match(source, /aria-busy=\{pending\}/);
  assert.match(source, /animate-spin/);
  assert.match(source, /copy\.retryUpload/);
  assert.match(source, /upload\(evidenceKey, uploadState\.original, true\)/);
  assert.match(source, /event\.currentTarget\.value = ''/);
  assert.match(source, /activeUploadRef\.current/);
  assert.match(source, /cameraPreparingRef\.current/);
  assert.match(source, /if \(activeUploadRef\.current \|\| cameraPreparingRef\.current\) return/);
  assert.match(source, /onPreparingChange\(true\)/);
  assert.match(source, /onPreparingChange\(false\)/);
  assert.match(source, /uploadRequestIdsRef/);
  assert.match(source, /if \(uploadStates\[key\]\?\.phase === 'error'\) return copy\.uploadFailed/);
  assert.match(source, /disabled=\{uploadPending \|\| submitting\}/);
});

test('KYC previews distinguish PDFs and release cameras and Blob URLs safely', async () => {
  const source = await readFile(
    new URL('../app/onboarding/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const isPdf = uploadState\?\.fileType === 'application\/pdf'/);
  assert.match(source, /previews\[evidenceKey\] && !isPdf && <img/);
  assert.match(source, /<FileText aria-hidden="true"/);
  assert.match(source, /previewUrlsRef\.current\[key\] = previewUrl/);
  assert.match(source, /if \(previousPreviewUrl\) URL\.revokeObjectURL\(previousPreviewUrl\)/);
  assert.match(source, /if \(previewUrl\) URL\.revokeObjectURL\(previewUrl\)/);

  const captureStart = source.indexOf('const capture = async');
  const cameraStop = source.indexOf('stop();', captureStart);
  const captureEncoding = source.indexOf('canvas.toBlob(', captureStart);
  assert.ok(captureStart >= 0 && cameraStop > captureStart && cameraStop < captureEncoding);
  assert.match(source, /if \(!cameraMountedRef\.current \|\| startRequestIdRef\.current !== requestId\)/);
  assert.match(source, /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
});
