import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('admin review represents an omitted selfie without a false compliance result', async () => {
  const [admin, store, types, domain] = await Promise.all([
    readFile(
      new URL('../components/AdminKycManagement.tsx', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../lib/store.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/types.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/domain/kyc.ts', import.meta.url), 'utf8'),
  ]);

  const requestItems = admin.slice(
    admin.indexOf('const REQUEST_ITEMS'),
    admin.indexOf('] as const;', admin.indexOf('const REQUEST_ITEMS')),
  );
  const reasons = admin.slice(
    admin.indexOf('const REASONS'),
    admin.indexOf('] as const;', admin.indexOf('const REASONS')),
  );
  assert.doesNotMatch(requestItems, /\['selfie'/);
  assert.doesNotMatch(reasons, /\['selfie_mismatch'/);
  assert.match(admin, /selfieMatch: 'not_applicable'/);
  assert.match(admin, /selfieNotProvided/);
  assert.match(admin, /disabled=\{selfieNotProvided\}/);
  assert.match(admin, /selfieNotProvided && <option value="not_applicable">/);
  assert.match(admin, /Non applicable/);
  assert.match(types, /KYCSelfieReviewState = KYCReviewState \| 'not_applicable'/);
  assert.match(types, /selfieMatch: KYCSelfieReviewState/);
  assert.match(domain, /parseKycSelfieReviewState/);
  assert.match(store, /selfieProvided: Boolean\(documentPaths\.selfie\)/);
  assert.match(store, /selfieMatch: parseKycSelfieReviewState/);
});
