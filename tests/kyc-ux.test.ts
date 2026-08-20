import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { serializeKycDocumentPaths } from '../lib/domain/kyc';
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
  'selfieSourceHint',
  'chooseFromGallery',
  'selfieAttached',
  'removeSelfie',
] as const satisfies readonly (keyof KycCopy)[];

const optionalSelfieMarkers = {
  fr: /facultati/i,
  en: /optional/i,
  de: /optional/i,
  es: /opcional/i,
  it: /facoltativ/i,
  nl: /optioneel/i,
} as const;

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

test('Italian and Dutch KYC copy does not fall back to French or English', () => {
  const criticalKeys = [
    'title',
    'privacy',
    'identityHint',
    'proofOfAddressHint',
    'preparingFile',
    'uploadingFile',
    'submit',
    'submitFailed',
  ] as const satisfies readonly (keyof KycCopy)[];

  for (const language of ['it', 'nl'] as const) {
    for (const key of criticalKeys) {
      assert.notEqual(kycTranslations[language][key], kycTranslations.fr[key]);
      assert.notEqual(kycTranslations[language][key], kycTranslations.en[key]);
    }
  }
});

test('the selfie is explicitly optional in every supported language', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const copy = kycTranslations[language];
    assert.match(copy.selfie, optionalSelfieMarkers[language]);
    assert.match(copy.selfieHint, optionalSelfieMarkers[language]);
    assert.match(copy.selfieSourceHint, optionalSelfieMarkers[language]);
    assert.match(copy.submit, /\S/);
  }
  assert.equal(kycTranslations.fr.submit, 'Envoyer');
});

test('a KYC submission payload omits an absent optional selfie', () => {
  assert.deepEqual(
    serializeKycDocumentPaths({
      id_front: 'owner/id_front/front.jpg',
      id_back: 'owner/id_back/back.jpg',
      proof_of_address: 'owner/proof_of_address/address.pdf',
    }),
    {
      id_front: 'owner/id_front/front.jpg',
      id_back: 'owner/id_back/back.jpg',
      proof_of_address: 'owner/proof_of_address/address.pdf',
    },
  );
});

test('KYC status, correction reasons and document views include Italian and Dutch', async () => {
  const sources = await Promise.all([
    readFile(new URL('../components/UserKycStatusView.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/UserDocumentsView.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/AccountStatementsModal.tsx', import.meta.url), 'utf8'),
  ]);

  for (const source of sources) {
    assert.match(source, /\bit:\s*\{/);
    assert.match(source, /\bnl:\s*\{/);
  }
  assert.match(sources[0], /Record<Language, string>/);
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

test('the selfie step offers separate camera and gallery choices through the same upload flow', async () => {
  const source = await readFile(
    new URL('../app/onboarding/page.tsx', import.meta.url),
    'utf8',
  );

  const galleryInput = source.match(/<input\s+[\s\S]*?id="selfie-gallery-input"[\s\S]*?\/>/)?.[0];
  assert.ok(galleryInput);
  assert.match(galleryInput, /type="file"/);
  assert.match(galleryInput, /accept="image\/jpeg,image\/png"/);
  assert.doesNotMatch(galleryInput, /\bcapture=/);
  assert.match(source, /galleryInputRef\.current\?\.click\(\)/);
  assert.match(source, /const file = event\.currentTarget\.files\?\.\[0\]/);
  assert.match(source, /event\.currentTarget\.value = ''/);
  assert.match(source, /await onCapture\(file\)/);
  assert.match(source, /copy\.openCamera/);
  assert.match(source, /copy\.chooseFromGallery/);
  const validation = source.slice(
    source.indexOf('const validate = () =>'),
    source.indexOf('const submit = async'),
  );
  assert.match(validation, /if \(key === 'selfie'\) return ''/);
  const optionalSelfieReturn = validation.indexOf(
    "if (key === 'selfie') return ''",
  );
  assert.ok(
    optionalSelfieReturn < validation.indexOf(
      "if (uploadStates[key]?.phase === 'error')",
    ),
  );
  assert.ok(optionalSelfieReturn < validation.indexOf('if (!paths[key]'));
  assert.match(source, /submitting \? copy\.sending : copy\.submit/);
  assert.match(source, /hasSelfie=\{Boolean\(paths\.selfie\)\}/);
  assert.match(source, /removable=\{!correctionMode && Boolean\(paths\.selfie\)\}/);
  assert.match(source, /copy\.selfieAttached/);
  assert.match(source, /copy\.removeSelfie/);
  assert.match(source, /await deleteEvidence\('kyc-evidence', \[selfiePath\]\)/);
});
