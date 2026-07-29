import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { renderOfficialDocumentPdf } from '../lib/server/official-document-pdf';

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
        holder: 'Client Monalyz',
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
  assert.equal(loaded.getTitle(), 'RIB Monalyz');
  assert.match(loaded.getKeywords() ?? '', /MON-2026-000001/);
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
  assert.equal(loaded.getSubject(), 'DEMONSTRATION - AUCUNE VALEUR');
  assert.match(loaded.getKeywords() ?? '', /demonstration/);
});
