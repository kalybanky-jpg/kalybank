import assert from 'node:assert/strict';
import test from 'node:test';
import { accountIbanLabel, bankingMessages } from '../lib/banking-i18n';
import { publicMessages } from '../lib/public-i18n';
import type { Language } from '../lib/types';

const languages: Language[] = ['fr', 'en', 'de', 'es'];
const transferStatuses = [
  'submitted',
  'under_review',
  'approved_for_external_execution',
  'external_execution_recorded',
  'external_settlement_confirmed',
  'rejected',
  'cancelled',
  'external_failed',
] as const;
const loanStatuses = [
  'submitted',
  'under_review',
  'approved_for_external_funding',
  'external_funding_recorded',
  'external_settlement_confirmed',
  'rejected',
  'cancelled',
  'external_failed',
] as const;

test('chaque langue expose la façade bancaire et tous les statuts métier', () => {
  for (const language of languages) {
    const messages = bankingMessages[language];

    assert.match(messages.dashboard.title, /\S/);
    assert.match(messages.accounts.title, /\S/);
    assert.match(messages.transfers.title, /\S/);
    assert.match(messages.loans.title, /\S/);
    assert.match(messages.common.internalOperationsNotice, /\S/);

    for (const status of transferStatuses) {
      assert.match(messages.transfers.statuses[status], /\S/);
    }
    for (const status of loanStatuses) {
      assert.match(messages.loans.statuses[status], /\S/);
    }
  }
});

test('les écrans publics ouvrent un espace bancaire sans promettre une exécution automatique', () => {
  for (const language of languages) {
    const messages = publicMessages[language];
    const copy = [
      messages.login.subtitle,
      messages.login.register,
      messages.register.subtitle,
      messages.register.submit,
    ].join(' ');

    assert.doesNotMatch(
      copy,
      /application account|compte applicatif|Anwendungskonto|cuenta de aplicación/i,
    );
    assert.match(copy, /Monalyz|bancaire|banking|Banking|banca/i);
  }
});

test('une référence absente est présentée comme un IBAN en cours d’attribution', () => {
  assert.equal(
    accountIbanLabel('Référence externe non renseignée', 'IBAN en cours'),
    'IBAN en cours',
  );
  assert.equal(
    accountIbanLabel('FR76 0000 0000 0000 0000 0000 000', 'IBAN en cours'),
    'FR76 0000 0000 0000 0000 0000 000',
  );
});
