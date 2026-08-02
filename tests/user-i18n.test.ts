import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { formatDirectCurrency } from '../lib/currency';
import { formatLocalizedDate, formatLocalizedMonths, formatLocalizedPercent } from '../lib/language';
import type { Language, NotificationMessageKey } from '../lib/types';
import {
  extraUserMessages,
  ledgerEntryLabel,
  normalizeLoanMotiveCode,
  notificationCopy,
} from '../lib/user-i18n';

const languages: Language[] = ['fr', 'en', 'de', 'es'];

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => leafPaths(entry, prefix ? `${prefix}.${key}` : key));
}

test('le catalogue utilisateur possède les mêmes clés non vides dans les quatre langues', () => {
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

test('les formats régionaux utilisent les quatre locales exactes', () => {
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'fr'), /1[\s\u202f]234,50/);
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'en'), /1,234\.50/);
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'de'), /1\.234,50/);
  assert.match(formatDirectCurrency(1234.5, 'EUR', 'es'), /1234,50|1\.234,50/);
  assert.match(formatLocalizedDate('2026-07-31T12:00:00Z', 'de'), /31\.07\.2026|31\.07\.26|31\. Juli 2026/);
  assert.match(formatLocalizedMonths(36, 'es'), /36 meses/);
  assert.match(formatLocalizedPercent(35, 'fr'), /35\s?%/);
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
