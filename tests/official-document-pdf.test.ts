import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import { renderOfficialDocumentPdf } from '../lib/server/official-document-pdf';
import type { Language, OfficialDocumentType } from '../lib/types';
import { officialDocumentTitle } from '../lib/user-i18n';

function decodedPageContent(document: PDFDocument, pageIndex: number): string {
  const contents = document.getPage(pageIndex).node.Contents();
  const objects =
    contents instanceof PDFArray
      ? contents.asArray().map((entry) => document.context.lookup(entry))
      : [contents];

  return objects
    .filter((entry): entry is PDFRawStream => entry instanceof PDFRawStream)
    .map((stream) =>
      Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'),
    )
    .join('\n');
}

function pageImageReferences(document: PDFDocument): string[] {
  return document.getPages().map((page) => {
    const xObjects = page.node
      .Resources()
      ?.lookup(PDFName.of('XObject'), PDFDict);
    assert.ok(xObjects, 'le dictionnaire XObject doit être présent');
    assert.equal(xObjects.values().length, 1);
    return String(xObjects.values()[0]);
  });
}

test('official document renderer produces a real PDF with traceable metadata', async () => {
  const pdf = await renderOfficialDocumentPdf({
    documentNumber: 'MON-2026-000001',
    documentType: 'bank_details',
    title: 'RIB Monalyz',
    language: 'fr',
    version: 1,
    issuedAt: '2026-07-29T12:00:00.000Z',
    isDemo: false,
    contentHash: 'a'.repeat(64),
    snapshot: {
      account: {
        holderName: 'Cliente Élise Groß',
        iban: 'FR7630006000011234567890189',
        bic: 'AGRIFRPP',
        currency: 'EUR',
      },
    },
  });

  const bytes = Buffer.from(pdf);
  assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(bytes.length > 1_000);
  const loaded = await PDFDocument.load(bytes);
  assert.equal(loaded.getPageCount(), 1);
  assert.equal(loaded.getAuthor(), 'Monalyz');
  assert.equal(loaded.getTitle(), 'Relevé d’identité bancaire');
  assert.match(loaded.getKeywords() ?? '', /MON-2026-000001/);
  assert.equal(pageImageReferences(loaded).length, 1);
  assert.match(bytes.toString('latin1'), /NotoSans/);
  assert.ok(decodedPageContent(loaded, 0).length > 500);
});

test('demo documents visibly identify their lack of value', async () => {
  const pdf = await renderOfficialDocumentPdf({
    documentNumber: 'MON-DEMO-000001',
    documentType: 'account_statement',
    title: 'Relevé de démonstration',
    language: 'fr',
    version: 1,
    issuedAt: '2026-07-29T12:00:00.000Z',
    isDemo: true,
    snapshot: { balance: 25_000, currency: 'EUR' },
  });

  const loaded = await PDFDocument.load(pdf);
  assert.equal(loaded.getSubject(), 'DÉMONSTRATION — AUCUNE VALEUR');
  assert.match(loaded.getKeywords() ?? '', /demonstration/);
  assert.ok(decodedPageContent(loaded, 0).length > 500);
});

test('un nouveau PDF embarque la marque publiée dans son contenu et ses métadonnées', async () => {
  const customLogo = await readFile(
    path.join(
      process.cwd(),
      'public',
      'brand',
      'monalyz',
      'monalyz-wordmark-reversed-white.png',
    ),
  );
  const pdf = await renderOfficialDocumentPdf({
    documentNumber: 'HZN-2026-000001',
    documentType: 'bank_details',
    language: 'fr',
    version: 1,
    issuedAt: '2026-08-01T10:00:00.000Z',
    isDemo: false,
    snapshot: { account: { holderName: 'Élise Martin', accountNumber: '1234' } },
    branding: {
      bankName: 'Banque Horizon',
      revision: 42,
      logoBytes: customLogo,
    },
  });
  const loaded = await PDFDocument.load(pdf);
  assert.equal(loaded.getAuthor(), 'Banque Horizon');
  assert.equal(loaded.getCreator(), 'Banque Horizon');
  assert.match(loaded.getSubject() ?? '', /Banque Horizon/);
  assert.match(loaded.getKeywords() ?? '', /brand-revision-42/);
  assert.doesNotMatch(loaded.getKeywords() ?? '', /Monalyz/);
});

test('le même wordmark embarqué est réutilisé sur toutes les pages', async () => {
  const pdf = await renderOfficialDocumentPdf({
    documentNumber: 'MON-2026-000002',
    documentType: 'account_statement',
    title: 'Relevé Monalyz multipage',
    language: 'fr',
    version: 3,
    issuedAt: '2026-07-29T12:00:00.000Z',
    isDemo: false,
    contentHash: 'b'.repeat(64),
    snapshot: {
      periodStart: '2026-01-01',
      periodEnd: '2026-07-29',
      account: { holderName: 'Élise Groß', accountType: 'current', currency: 'EUR', balanceMinor: 123456 },
      entries: Array.from({ length: 80 }, (_, index) => ({
        entryKind: index % 2 ? 'transfer_debit' : 'manual_adjustment',
        amountMinor: index % 2 ? -2500 : 1200,
        balanceAfterMinor: 123456 - index * 100,
        currency: 'EUR',
        internalReference: `MON-${index + 1}`,
        valueDate: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
      })),
    },
  });

  const loaded = await PDFDocument.load(pdf);
  assert.ok(loaded.getPageCount() > 1);
  const imageReferences = pageImageReferences(loaded);
  assert.equal(new Set(imageReferences).size, 1);
  assert.ok(decodedPageContent(loaded, loaded.getPageCount() - 1).length > 300);
});

test('les quatre langues conservent leurs caractères Unicode et métadonnées localisées', async () => {
  const expectations = {
    fr: ['Relevé d’identité bancaire', 'Document bancaire officiel Monalyz'],
    en: ['Bank account details', 'Official Monalyz bank document'],
    de: ['Bankverbindung', 'Offizielles Monalyz-Bankdokument'],
    es: ['Datos bancarios', 'Documento bancario oficial de Monalyz'],
  } as const;
  for (const language of ['fr', 'en', 'de', 'es'] as const) {
    const bytes = await renderOfficialDocumentPdf({
      documentNumber: `MON-${language.toUpperCase()}-000001`,
      documentType: 'bank_details',
      language,
      version: 2,
      localizationRevision: 2,
      issuedAt: '2026-07-31T09:15:00.000Z',
      isDemo: false,
      snapshot: { account: { holderName: 'Élise Groß ¿Álvarez?', accountType: 'current', accountNumber: '123456', bic: 'MONAFRPP', currency: 'EUR' } },
    });
    const loaded = await PDFDocument.load(bytes);
    assert.equal(loaded.getTitle(), expectations[language][0]);
    assert.equal(loaded.getSubject(), expectations[language][1]);
    assert.match(loaded.getKeywords() ?? '', new RegExp(language));
  }
});

test('chaque modèle documentaire est généré dans les quatre langues', async () => {
  const documentTypes: OfficialDocumentType[] = [
    'bank_details', 'account_statement', 'balance_certificate', 'transfer_confirmation',
    'loan_disbursement_confirmation', 'loan_decision',
  ];
  const languages: Language[] = ['fr', 'en', 'de', 'es'];
  const snapshot = {
    periodStart: '2026-07-01', periodEnd: '2026-07-31',
    account: { holderName: 'Élise Groß ¿Álvarez?', accountType: 'current', accountNumber: '123456', bic: 'MONAFRPP', currency: 'EUR', balanceMinor: 123456, availableBalanceMinor: 120000, asOf: '2026-07-31T10:00:00Z' },
    transfer: { reference: 'TRX-001', recipientName: 'Señora Groß', recipientAccountMasked: '•••• 1234', amountMinor: 1200, currency: 'EUR', targetAmountMinor: 1300, targetCurrency: 'USD', settledAt: '2026-07-31T09:00:00Z' },
    loan: { reference: 'LOAN-001', requestedAmountMinor: 250000, currency: 'EUR', durationMonths: 36, annualRate: 0.035, status: 'approved_for_external_funding', disbursementReference: 'DISB-001', disbursedAt: '2026-07-31T09:00:00Z' },
    entries: [{ entryKind: 'account_opening', amountMinor: 10000, balanceAfterMinor: 10000, currency: 'EUR', internalReference: 'OPEN-001', valueDate: '2026-07-01' }],
  };
  for (const documentType of documentTypes) for (const language of languages) {
    const pdf = await renderOfficialDocumentPdf({
      documentNumber: `MON-${documentType}-${language}`, documentType, language,
      version: 2, localizationRevision: 2, issuedAt: '2026-07-31T10:30:00Z', isDemo: false, snapshot,
    });
    const loaded = await PDFDocument.load(pdf);
    assert.equal(loaded.getTitle(), officialDocumentTitle(language, documentType));
    assert.ok(loaded.getPageCount() >= 1);
    assert.ok(pdf.length > 10_000);
  }
});
