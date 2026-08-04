import assert from 'node:assert/strict';
import test from 'node:test';
import { accountNumberLabel, bankingMessages } from '../lib/banking-i18n';
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

test('les écrans publics proposent simplement de créer un compte', () => {
  const expectedCtas: Record<Language, string> = {
    fr: 'Créer un compte',
    en: 'Create an account',
    de: 'Konto erstellen',
    es: 'Crear una cuenta',
  };

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
    assert.match(copy, /Monalyz|bancaire|bank(?:ing|dienstleistungen)?|banca/i);
    assert.equal(messages.login.register, expectedCtas[language]);
    assert.equal(messages.register.submit, expectedCtas[language]);
  }
});

test('un numéro absent est présenté comme en cours d’attribution', () => {
  assert.equal(
    accountNumberLabel('Référence externe non renseignée', 'Numéro en cours'),
    'Numéro en cours',
  );
  assert.equal(
    accountNumberLabel('1234567890', 'Numéro en cours'),
    '1234567890',
  );
});
