import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evidenceObjectPath,
  hasProtectedKycEvidencePath,
  hasReferencedEvidencePath,
} from '../lib/domain/evidence';
import { jsonStringValues } from '../lib/supabase/json';

test('evidence paths are immutable object versions rather than shared current files', () => {
  assert.equal(
    evidenceObjectPath('owner', 'selfie', 'jpg', 'version-id'),
    'owner/selfie/version-id.jpg',
  );
});

test('referenced evidence cannot be selected for deletion', () => {
  const references = jsonStringValues({
    identity: { front: 'owner/id/front.jpg' },
    supporting: ['owner/address/proof.pdf'],
  });
  assert.equal(
    hasReferencedEvidencePath(['owner/id/front.jpg'], references),
    true,
  );
  assert.equal(
    hasReferencedEvidencePath(['owner/orphan/file.jpg'], references),
    false,
  );
});

test('submitted KYC evidence remains protected after a corrected path replaces it', () => {
  assert.equal(
    hasProtectedKycEvidencePath(
      ['owner/id/previous-version.jpg'],
      ['owner/id/current-version.jpg'],
      true,
    ),
    true,
  );
  assert.equal(
    hasProtectedKycEvidencePath(
      ['owner/id/unsubmitted-version.jpg'],
      [],
      false,
    ),
    false,
  );
});
