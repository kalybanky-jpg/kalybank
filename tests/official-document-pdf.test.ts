import assert from 'node:assert/strict';
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

function encodedPdfText(value: string): string {
  return Buffer.from(value, 'latin1').toString('hex').toUpperCase();
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
  assert.equal(pageImageReferences(loaded).length, 1);
  assert.match(
    decodedPageContent(loaded, 0),
    new RegExp(encodedPdfText('Empreinte SHA-256')),
  );
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
  assert.match(
    decodedPageContent(loaded, 0),
    new RegExp(encodedPdfText('DEMONSTRATION - AUCUNE VALEUR')),
  );
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
    snapshot: Object.fromEntries(
      Array.from({ length: 80 }, (_, index) => [
        `ligne_${index + 1}`,
        `Opération officielle ${index + 1}`,
      ]),
    ),
  });

  const loaded = await PDFDocument.load(pdf);
  assert.ok(loaded.getPageCount() > 1);
  const imageReferences = pageImageReferences(loaded);
  assert.equal(new Set(imageReferences).size, 1);
  assert.match(
    decodedPageContent(loaded, loaded.getPageCount() - 1),
    new RegExp(encodedPdfText(`Version 3 - Page ${loaded.getPageCount()}`)),
  );
});
