import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { formatDirectCurrency } from '../lib/currency';
import { translations } from '../lib/i18n';
import { formatLocalizedDate, formatLocalizedMonths, formatLocalizedPercent, SUPPORTED_LANGUAGES } from '../lib/language';
import type { Language, NotificationMessageKey } from '../lib/types';
import {
  extraUserMessages,
  ledgerEntryLabel,
  normalizeLoanMotiveCode,
  notificationCopy,
} from '../lib/user-i18n';

const languages: readonly Language[] = SUPPORTED_LANGUAGES;

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => leafPaths(entry, prefix ? `${prefix}.${key}` : key));
}

test('le catalogue utilisateur possède les mêmes clés non vides dans les six langues', () => {
  const expected = leafPaths(extraUserMessages.fr).sort();
  for (const language of languages) {
    assert.deepEqual(leafPaths(extraUserMessages[language]).sort(), expected);
    for (const pathName of expected) {
      const value = pathName.split('.').reduce<unknown>((current, key) => (current as Record<string, unknown>)[key], extraUserMessages[language]);
      assert.equal(typeof value, 'string');
      assert.match(value as string, /\S/);
    }
  }
});

test('le libellé du taux fixe du prêt vient du catalogue multilingue', async () => {
  assert.equal(extraUserMessages.fr.loanModal.fixedAnnualRate, 'TAEG fixe');
  assert.equal(extraUserMessages.en.loanModal.fixedAnnualRate, 'Fixed APR');
  assert.equal(extraUserMessages.de.loanModal.fixedAnnualRate, 'Eff. Jahreszins');
  assert.equal(extraUserMessages.es.loanModal.fixedAnnualRate, 'TAE fija');
  assert.equal(extraUserMessages.it.loanModal.fixedAnnualRate, 'TAEG fisso');
  assert.equal(extraUserMessages.nl.loanModal.fixedAnnualRate, 'Vast jaarlijks kostenpercentage');

  const repositoryRoot = path.resolve(import.meta.dirname, '..');
  const source = await readFile(path.join(repositoryRoot, 'components', 'LoanApplicationModal.tsx'), 'utf8');
  assert.match(source, /copy\.loanModal\.fixedAnnualRate/);
  assert.doesNotMatch(source, /const\s+fixedAnnualRateLabel\s*=\s*\{/);
});

test('toutes les notifications métier sont localisées sans exposer le texte d’audit', () => {
  const keys: NotificationMessageKey[] = [
    'generic_info', 'transfer_submitted', 'transfer_approved', 'transfer_completed', 'transfer_rejected', 'transfer_failed',
    'loan_submitted', 'loan_approved', 'loan_disbursed', 'loan_rejected', 'loan_failed',
    'kyc_submitted', 'kyc_information_requested', 'kyc_resubmitted', 'kyc_approved', 'kyc_rejected', 'document_available',
  ];
  for (const language of languages) for (const key of keys) {
    const copy = notificationCopy(language, key, {});
    assert.match(copy.title, /\S/);
    assert.match(copy.message, /\S/);
    if (language !== 'fr') assert.notEqual(copy.message, extraUserMessages.fr.notifications[key].message);
  }
});

test('les formats régionaux utilisent les six locales exactes', () => {
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'fr'), /1[\s\u202f]234,50/);
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'en'), /1,234\.50/);
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'de'), /1\.234,50/);
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'es'), /1234,50|1\.234,50/);
  assert.match(formatLocalizedDate('2026-07-31T12:00:00Z', 'de'), /31\.07\.2026|31\.07\.26|31\. Juli 2026/);
  assert.match(formatLocalizedMonths(36, 'es'), /36 meses/);
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'it'), /1234,50|1\.234,50/);
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'nl'), /1234,50|1\.234,50/);
  assert.match(formatLocalizedMonths(36, 'it'), /36 mesi/);
  assert.match(formatLocalizedMonths(36, 'nl'), /36 maanden/);
  assert.match(formatLocalizedPercent(35, 'fr'), /35\s?%/);
});

test('les titres des champs de virement restent concis dans les six langues', async () => {
  const conciseLabelKeys = [
    'transitNumber',
    'institutionNumber',
    'accountNumber',
    'interacEmail',
    'routingNumberLabel',
  ] as const;

  for (const language of languages) {
    for (const key of conciseLabelKeys) {
      assert.doesNotMatch(translations[language][key], /[()]/, `${language}.${key}`);
    }
    assert.doesNotMatch(extraUserMessages[language].transferModal.transferMotive, /[()]/, `${language}.transferMotive`);
  }

  const repositoryRoot = path.resolve(import.meta.dirname, '..');
  const source = await readFile(path.join(repositoryRoot, 'components', 'WireTransferModal.tsx'), 'utf8');
  for (const placeholder of ['12345', '003', '1234567', '123456789', '123456789012']) {
    assert.match(source, new RegExp(`placeholder=["']${placeholder}["']`));
  }
});

test('les parcours client IT et NL ne réutilisent pas les catalogues FR ou EN', () => {
  const criticalPaths = [
    'shell.welcome',
    'settings.title',
    'support.pushDescription',
    'loanModal.disclaimer',
    'transferModal.subtitle',
    'notifications.loan_approved.message',
    'notifications.kyc_information_requested.message',
    'documents.account_statement',
    'errors.UNKNOWN_ERROR',
  ];

  const readPath = (language: Language, pathName: string) =>
    pathName.split('.').reduce<unknown>(
      (current, key) => (current as Record<string, unknown>)[key],
      extraUserMessages[language],
    ) as string;

  for (const language of ['it', 'nl'] as const) {
    for (const pathName of criticalPaths) {
      const value = readPath(language, pathName);
      assert.match(value, /\S/);
      assert.notEqual(value, readPath('fr', pathName), `${language}.${pathName} fell back to fr`);
      assert.notEqual(value, readPath('en', pathName), `${language}.${pathName} fell back to en`);
    }
  }
});

test('les codes historiques sont normalisés et les écritures libres ne sont pas affichées', () => {
  assert.equal(normalizeLoanMotiveCode('Achat véhicule / Auto'), 'vehicle');
  assert.equal(normalizeLoanMotiveCode('Motif libre interne'), 'other');
  assert.equal(ledgerEntryLabel('de', 'manual_adjustment', { description: 'Texte français interne' }), 'Anpassung durch die Bank');
});

test('les composants utilisateur ne réintroduisent pas de condition binaire français/anglais', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '..');
  const files = ['WireTransferModal.tsx', 'LoanApplicationModal.tsx', 'UserDashboard.tsx', 'NotificationsDrawer.tsx'];
  for (const file of files) {
    const source = await readFile(path.join(repositoryRoot, 'components', file), 'utf8');
    assert.doesNotMatch(source, /language\s*===\s*['"]fr['"]/);
  }
});
