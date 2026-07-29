import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';

interface OfficialDocumentPdfInput {
  documentNumber: string;
  documentType: string;
  title: string;
  language: string;
  version: number;
  issuedAt: string;
  isDemo: boolean;
  contentHash?: string | null;
  snapshot: Record<string, unknown>;
}

const A4 = { width: 595.28, height: 841.89 };
const WORDMARK_PATH = path.join(
  process.cwd(),
  'public',
  'brand',
  'monalyz',
  'monalyz-wordmark-reversed-white.png',
);

function printable(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number') return new Intl.NumberFormat('fr-FR').format(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function safePdfText(value: unknown): string {
  return printable(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, '-')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
}

function formatLabel(key: string) {
  return safePdfText(
    key
      .replaceAll('_', ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (letter) => letter.toUpperCase()),
  );
}

function flattenSnapshot(
  value: unknown,
  prefix = '',
  depth = 0,
): Array<[string, string]> {
  if (depth > 3) return [[prefix, safePdfText(value)]];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      flattenSnapshot(entry, `${prefix} ${index + 1}`.trim(), depth + 1),
    );
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, entry]) =>
        flattenSnapshot(
          entry,
          `${prefix}${prefix ? ' / ' : ''}${formatLabel(key)}`,
          depth + 1,
        ),
    );
  }
  return [[prefix || 'Information', safePdfText(value)]];
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const words = safePdfText(text).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawPageChrome(
  page: PDFPage,
  wordmark: PDFImage,
  regular: PDFFont,
  bold: PDFFont,
  input: OfficialDocumentPdfInput,
  pageNumber: number,
) {
  const navy = rgb(0.04, 0.08, 0.2);
  const blue = rgb(0.1, 0.35, 0.82);
  page.drawRectangle({
    x: 0,
    y: A4.height - 82,
    width: A4.width,
    height: 82,
    color: navy,
  });
  const wordmarkSize = wordmark.scaleToFit(150, 30);
  page.drawImage(wordmark, {
    x: 42,
    y: A4.height - 50,
    width: wordmarkSize.width,
    height: wordmarkSize.height,
  });
  page.drawText('DOCUMENT BANCAIRE EMIS PAR MONALYZ', {
    x: 42,
    y: A4.height - 66,
    font: regular,
    size: 8,
    color: rgb(0.7, 0.8, 1),
  });
  page.drawRectangle({
    x: 0,
    y: A4.height - 86,
    width: A4.width,
    height: 4,
    color: blue,
  });
  page.drawText(`Reference : ${safePdfText(input.documentNumber)}`, {
    x: 42,
    y: 30,
    font: regular,
    size: 7.5,
    color: rgb(0.35, 0.4, 0.5),
  });
  page.drawText(`Version ${input.version} - Page ${pageNumber}`, {
    x: A4.width - 145,
    y: 30,
    font: regular,
    size: 7.5,
    color: rgb(0.35, 0.4, 0.5),
  });
  if (input.isDemo) {
    page.drawText('DEMONSTRATION - AUCUNE VALEUR', {
      x: 65,
      y: 390,
      rotate: degrees(34),
      font: bold,
      size: 33,
      color: rgb(0.93, 0.82, 0.82),
      opacity: 0.42,
    });
  }
}

export async function renderOfficialDocumentPdf(
  input: OfficialDocumentPdfInput,
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const wordmark = await pdf.embedPng(await readFile(WORDMARK_PATH));
  const rows = flattenSnapshot(input.snapshot).filter(
    ([label]) => !label.toLowerCase().includes('secret'),
  );
  let pageNumber = 0;
  let page = pdf.addPage([A4.width, A4.height]);
  pageNumber += 1;
  drawPageChrome(page, wordmark, regular, bold, input, pageNumber);
  let y = A4.height - 125;

  const addPage = () => {
    page = pdf.addPage([A4.width, A4.height]);
    pageNumber += 1;
    drawPageChrome(page, wordmark, regular, bold, input, pageNumber);
    y = A4.height - 118;
  };

  const titleLines = wrapText(input.title, bold, 18, A4.width - 84);
  for (const line of titleLines) {
    page.drawText(line, {
      x: 42,
      y,
      font: bold,
      size: 18,
      color: rgb(0.04, 0.08, 0.2),
    });
    y -= 23;
  }
  page.drawText(
    `Emis le ${safePdfText(
      new Intl.DateTimeFormat(input.language || 'fr', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(input.issuedAt)),
    )}`,
    {
      x: 42,
      y: y - 4,
      font: regular,
      size: 9,
      color: rgb(0.35, 0.4, 0.5),
    },
  );
  y -= 35;

  for (const [label, value] of rows) {
    const valueLines = wrapText(value, regular, 9.5, A4.width - 245);
    const rowHeight = Math.max(28, valueLines.length * 13 + 12);
    if (y - rowHeight < 58) addPage();
    page.drawRectangle({
      x: 42,
      y: y - rowHeight + 5,
      width: A4.width - 84,
      height: rowHeight,
      color: rgb(0.965, 0.975, 0.99),
      borderColor: rgb(0.88, 0.9, 0.94),
      borderWidth: 0.5,
    });
    page.drawText(formatLabel(label), {
      x: 52,
      y: y - 12,
      font: bold,
      size: 8.5,
      color: rgb(0.25, 0.3, 0.4),
      maxWidth: 165,
    });
    valueLines.forEach((line, index) => {
      page.drawText(line, {
        x: 225,
        y: y - 12 - index * 13,
        font: regular,
        size: 9.5,
        color: rgb(0.04, 0.08, 0.2),
      });
    });
    y -= rowHeight + 4;
  }

  const fingerprint = input.contentHash
    ? `Empreinte SHA-256 : ${safePdfText(input.contentHash)}`
    : 'Empreinte SHA-256 enregistree dans le registre Monalyz.';
  if (y < 92) addPage();
  for (const [index, line] of wrapText(
    fingerprint,
    regular,
    7.5,
    A4.width - 84,
  ).entries()) {
    page.drawText(line, {
      x: 42,
      y: y - 18 - index * 10,
      font: regular,
      size: 7.5,
      color: rgb(0.35, 0.4, 0.5),
    });
  }

  const issuedDate = new Date(input.issuedAt);
  pdf.setTitle(safePdfText(input.title));
  pdf.setSubject(
    input.isDemo
      ? 'DEMONSTRATION - AUCUNE VALEUR'
      : 'Document bancaire officiel Monalyz',
  );
  pdf.setKeywords([
    'Monalyz',
    input.documentType,
    input.documentNumber,
    input.isDemo ? 'demonstration' : 'issued',
  ]);
  pdf.setAuthor('Monalyz');
  pdf.setCreator('Monalyz');
  pdf.setProducer('Monalyz / pdf-lib');
  pdf.setCreationDate(issuedDate);
  pdf.setModificationDate(issuedDate);

  return pdf.save({ useObjectStreams: false });
}
