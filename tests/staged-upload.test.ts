import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  MAX_BRANDING_UPLOAD_BYTES,
  MAX_EVIDENCE_UPLOAD_BYTES,
  canStageEvidenceForRole,
  createStagingPath,
  detectEvidenceType,
  hasExpectedPartialContentHeaders,
  isExpectedBrandingStagingPath,
  isExpectedEvidenceStagingPath,
  isOwnedStagingPath,
  validateUploadIntent,
} from '../lib/server/staged-upload';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER = '22222222-2222-4222-8222-222222222222';
const OBJECT_ID = '33333333-3333-4333-8333-333333333333';

test('upload intents enforce purpose-specific MIME, size and metadata', () => {
  const evidence = validateUploadIntent({
    purpose: 'evidence',
    mimeType: 'application/pdf',
    size: MAX_EVIDENCE_UPLOAD_BYTES,
    metadata: { bucket: 'loan-evidence', kind: 'income_statement' },
  });
  assert.equal(evidence.ok, true);

  assert.deepEqual(
    validateUploadIntent({
      purpose: 'evidence',
      mimeType: 'application/pdf',
      size: MAX_EVIDENCE_UPLOAD_BYTES + 1,
      metadata: { bucket: 'loan-evidence', kind: 'income_statement' },
    }),
    { ok: false, status: 413 },
  );
  assert.deepEqual(
    validateUploadIntent({
      purpose: 'evidence',
      mimeType: 'image/png',
      size: 100,
      metadata: { bucket: 'kyc-evidence', kind: 'selfie' },
    }),
    { ok: false, status: 415 },
  );
  assert.deepEqual(
    validateUploadIntent({
      purpose: 'evidence',
      mimeType: 'image/jpeg',
      size: 100,
      metadata: { bucket: 'kyc-evidence', kind: 'unexpected' },
    }),
    { ok: false, status: 400 },
  );

  const branding = validateUploadIntent({
    purpose: 'branding',
    mimeType: 'image/webp',
    size: MAX_BRANDING_UPLOAD_BYTES,
    metadata: { kind: 'primaryLogo' },
  });
  assert.equal(branding.ok, true);
  assert.deepEqual(
    validateUploadIntent({
      purpose: 'branding',
      mimeType: 'application/pdf',
      size: 100,
      metadata: { kind: 'favicon' },
    }),
    { ok: false, status: 415 },
  );
});

test('staging paths bind an unguessable object to owner, purpose and metadata', () => {
  const validation = validateUploadIntent({
    purpose: 'evidence',
    mimeType: 'image/jpeg',
    size: 100,
    metadata: { bucket: 'kyc-evidence', kind: 'id_front' },
  });
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const evidencePath = createStagingPath(OWNER, validation.intent, OBJECT_ID);
  assert.equal(
    evidencePath,
    `${OWNER}/evidence/kyc-evidence/id_front/${OBJECT_ID}.jpg`,
  );
  assert.equal(
    isExpectedEvidenceStagingPath(
      evidencePath,
      OWNER,
      'kyc-evidence',
      'id_front',
    ),
    true,
  );
  assert.equal(
    isExpectedEvidenceStagingPath(
      evidencePath,
      OTHER_OWNER,
      'kyc-evidence',
      'id_front',
    ),
    false,
  );
  assert.equal(
    isExpectedEvidenceStagingPath(
      evidencePath,
      OWNER,
      'loan-evidence',
      'id_front',
    ),
    false,
  );
  assert.equal(isOwnedStagingPath(evidencePath, OWNER), true);
  assert.equal(isOwnedStagingPath(evidencePath, OTHER_OWNER), false);

  const brandingValidation = validateUploadIntent({
    purpose: 'branding',
    mimeType: 'image/svg+xml',
    size: 100,
    metadata: { kind: 'reversedLogo' },
  });
  assert.equal(brandingValidation.ok, true);
  if (!brandingValidation.ok) return;
  const brandingPath = createStagingPath(
    OWNER,
    brandingValidation.intent,
    OBJECT_ID,
  );
  assert.equal(
    isExpectedBrandingStagingPath(
      brandingPath,
      OWNER,
      'reversedLogo',
    ),
    true,
  );
  assert.equal(isOwnedStagingPath(brandingPath, OWNER), true);
  assert.equal(
    isOwnedStagingPath(`${OWNER}/branding/favicon/not-a-uuid.png`, OWNER),
    false,
  );
});

test('evidence authorization preserves the final bucket RLS contract', () => {
  assert.equal(canStageEvidenceForRole('kyc-evidence', 'user'), true);
  assert.equal(canStageEvidenceForRole('loan-evidence', 'user'), true);
  assert.equal(
    canStageEvidenceForRole('external-execution-evidence', 'user'),
    false,
  );
  assert.equal(
    canStageEvidenceForRole('external-execution-evidence', 'reviewer'),
    false,
  );
  assert.equal(
    canStageEvidenceForRole('external-execution-evidence', 'operator'),
    true,
  );
  assert.equal(
    canStageEvidenceForRole('external-execution-evidence', 'supervisor'),
    true,
  );
  assert.equal(
    canStageEvidenceForRole('external-execution-evidence', 'admin'),
    true,
  );
});

test('evidence binary types are detected from signatures rather than metadata', () => {
  assert.deepEqual(
    detectEvidenceType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])),
    { mimeType: 'application/pdf', extension: 'pdf' },
  );
  assert.deepEqual(
    detectEvidenceType(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    { mimeType: 'image/png', extension: 'png' },
  );
  assert.deepEqual(
    detectEvidenceType(new Uint8Array([0xff, 0xd8, 0xff])),
    { mimeType: 'image/jpeg', extension: 'jpg' },
  );
  assert.equal(
    detectEvidenceType(new TextEncoder().encode('<script>alert(1)</script>')),
    null,
  );
});

test('a valid partial response may omit Content-Length', () => {
  const withoutLength = new Headers({
    'Content-Range': 'bytes 0-4095/10485760',
  });
  assert.equal(
    hasExpectedPartialContentHeaders(206, withoutLength, 4096, 10485760),
    true,
  );
  assert.equal(
    hasExpectedPartialContentHeaders(
      206,
      new Headers({
        'Content-Range': 'bytes 0-4095/10485760',
        'Content-Length': '4095',
      }),
      4096,
      10485760,
    ),
    false,
  );
  assert.equal(
    hasExpectedPartialContentHeaders(200, withoutLength, 4096, 10485760),
    false,
  );
});

test('large files and PDFs no longer transit through Next route bodies', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '..');
  const [evidenceRoute, downloadRoute, client] = await Promise.all([
    readFile(path.join(repositoryRoot, 'app/api/evidence/route.ts'), 'utf8'),
    readFile(
      path.join(
        repositoryRoot,
        'app/api/official-documents/[documentId]/route.ts',
      ),
      'utf8',
    ),
    readFile(path.join(repositoryRoot, 'lib/staged-upload.ts'), 'utf8'),
  ]);

  assert.doesNotMatch(evidenceRoute, /request\.formData\s*\(/);
  assert.doesNotMatch(
    evidenceRoute,
    /\.from\(STAGING_BUCKET\)\s*\n\s*\.download\(stagingPath\)/,
  );
  assert.match(evidenceRoute, /Range: `bytes=0-\$\{expectedBytes - 1\}`/);
  assert.match(
    evidenceRoute,
    /\.move\(stagingPath, destinationPath, \{ destinationBucket: bucket \}\)/,
  );
  assert.match(client, /\.uploadToSignedUrl\(/);
  assert.match(downloadRoute, /\.createSignedUrl\(/);
  assert.doesNotMatch(downloadRoute, /\.arrayBuffer\s*\(/);
});
