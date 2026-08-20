import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseKycAddress,
  parseKycDocumentPaths,
  parseKycDraft,
  parseKycReviewState,
  parseKycSelfieReviewState,
  serializeKycDraft,
  type KycDraftForm,
} from '../lib/domain/kyc';
import {
  parseNotificationMessageKey,
  parseNotificationMessageParams,
} from '../lib/domain/notifications';

const completeDraft: KycDraftForm = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  placeOfBirth: 'London',
  nationality: 'GB',
  dateOfBirth: '1815-12-10',
  street: '1 Analytical Engine Way',
  postalCode: 'SW1',
  city: 'London',
  country: 'GB',
  occupation: 'Mathematician',
  incomeRange: 'stable',
  fatca: false,
  pep: false,
  documentType: 'passport',
  documentNumber: 'P123',
  issuingCountry: 'GB',
  documentExpiresOn: '2030-01-01',
};

test('KYC draft JSON round-trips without trusting unknown properties', () => {
  assert.deepEqual(parseKycDraft(serializeKycDraft(completeDraft)), completeDraft);
  assert.deepEqual(parseKycDraft({ firstName: 42, fatca: 'yes', rogue: true }), {});
});

test('KYC JSON parsers return safe defaults and known evidence keys only', () => {
  assert.deepEqual(parseKycAddress(['not-an-object']), {
    street: '',
    postalCode: '',
    city: '',
    country: '',
  });
  assert.deepEqual(
    parseKycDocumentPaths({ id_front: 'user/front.jpg', rogue: 'elsewhere' }),
    { id_front: 'user/front.jpg' },
  );
  assert.equal(parseKycReviewState('unexpected'), 'pending');
  assert.equal(parseKycReviewState('not_applicable'), 'pending');
  assert.equal(parseKycSelfieReviewState('not_applicable'), 'not_applicable');
});

test('notification JSON falls back to supported contracts', () => {
  assert.equal(parseNotificationMessageKey('unknown'), 'generic_info');
  assert.equal(parseNotificationMessageKey('loan_approved'), 'loan_approved');
  assert.deepEqual(parseNotificationMessageParams(['not-an-object']), {});
  assert.deepEqual(parseNotificationMessageParams({ amount: 12 }), { amount: 12 });
});
