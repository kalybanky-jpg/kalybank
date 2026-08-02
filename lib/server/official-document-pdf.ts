import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { languageLocale } from '@/lib/language';
import type { Language, LedgerEntryKind, OfficialDocumentType } from '@/lib/types';
import { officialDocumentTitle } from '@/lib/user-i18n';
import { applyBrand } from '@/lib/branding';

export interface OfficialDocumentPdfInput {
  documentNumber: string;
  documentType: string;
  title?: string;
  language: string;
  version: number;
  localizationRevision?: number;
  issuedAt: string;
  isDemo: boolean;
  contentHash?: string | null;
  snapshot: Record<string, unknown>;
  branding?: {
    bankName: string;
    revision: number;
    logoBytes?: Uint8Array;
  };
}

interface PdfRow {
  label: string;
  value: string;
}

interface PdfSection {
  title: string;
  rows: PdfRow[];
}

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const CONTENT_WIDTH = A4.width - MARGIN * 2;
const WORDMARK_PATH = path.join(process.cwd(), 'public', 'brand', 'monalyz', 'monalyz-wordmark-reversed-white.png');
const REGULAR_FONT_PATH = path.join(process.cwd(), 'assets', 'fonts', 'NotoSans-Regular.ttf');
const BOLD_FONT_PATH = path.join(process.cwd(), 'assets', 'fonts', 'NotoSans-Bold.ttf');

const COPY = {
  fr: {
    descriptor: 'DOCUMENT BANCAIRE ÉMIS PAR {bankName}', reference: 'Référence', version: 'Version', page: 'Page',
    issuedOn: 'Émis le', revision: 'Révision de localisation', fingerprint: 'Empreinte des données SHA-256',
    demo: 'DÉMONSTRATION — AUCUNE VALEUR', subject: 'Document bancaire officiel {bankName}',
    account: 'Compte', operation: 'Opération', loan: 'Prêt', period: 'Période du relevé', entriesTitle: 'Écritures comptables',
    yes: 'Oui', no: 'Non', unavailable: 'Non renseigné', from: 'Du', to: 'au', balance: 'Solde', availableBalance: 'Solde disponible',
    labels: {
      holderName: 'Titulaire', accountType: 'Type de compte', accountNumber: 'Numéro de compte', iban: 'IBAN', bic: 'BIC / SWIFT',
      institutionName: 'Établissement', branchName: 'Agence', branchCode: 'Code agence', currency: 'Devise', openedAt: 'Ouvert le', asOf: 'Situation au',
      reference: 'Référence de l’opération', recipientName: 'Bénéficiaire', recipientAccountMasked: 'Compte bénéficiaire', amount: 'Montant', targetAmount: 'Montant reçu', settledAt: 'Exécuté le',
      loanReference: 'Référence du prêt', requestedAmount: 'Montant du prêt', duration: 'Durée', annualRate: 'Taux annuel indicatif', status: 'Décision / statut', disbursedAt: 'Versé le',
      valueDate: 'Date de valeur', entryReference: 'Référence', entryAmount: 'Mouvement', balanceAfter: 'Solde après écriture',
    },
    accountTypes: { current: 'Compte courant', savings: 'Compte d’épargne' },
    entryKinds: { migration_opening_balance: 'Solde initial', account_opening: 'Ouverture du compte', manual_adjustment: 'Ajustement effectué par la banque', transfer_debit: 'Virement', loan_credit: 'Versement du prêt' },
    statuses: { submitted: 'Transmise', under_review: 'En cours d’analyse', approved_for_external_funding: 'Approuvée', external_funding_recorded: 'Versement enregistré', external_settlement_confirmed: 'Finalisée', rejected: 'Refusée', cancelled: 'Annulée', external_failed: 'Échec externe' },
  },
  en: {
    descriptor: 'BANK DOCUMENT ISSUED BY {bankName}', reference: 'Reference', version: 'Version', page: 'Page',
    issuedOn: 'Issued on', revision: 'Localisation revision', fingerprint: 'SHA-256 data fingerprint',
    demo: 'DEMONSTRATION — NO LEGAL VALUE', subject: 'Official {bankName} bank document',
    account: 'Account', operation: 'Transaction', loan: 'Loan', period: 'Statement period', entriesTitle: 'Account entries',
    yes: 'Yes', no: 'No', unavailable: 'Not provided', from: 'From', to: 'to', balance: 'Balance', availableBalance: 'Available balance',
    labels: {
      holderName: 'Account holder', accountType: 'Account type', accountNumber: 'Account number', iban: 'IBAN', bic: 'BIC / SWIFT',
      institutionName: 'Institution', branchName: 'Branch', branchCode: 'Branch code', currency: 'Currency', openedAt: 'Opened on', asOf: 'Position as of',
      reference: 'Transaction reference', recipientName: 'Recipient', recipientAccountMasked: 'Recipient account', amount: 'Amount', targetAmount: 'Amount received', settledAt: 'Completed on',
      loanReference: 'Loan reference', requestedAmount: 'Loan amount', duration: 'Term', annualRate: 'Illustrative annual rate', status: 'Decision / status', disbursedAt: 'Disbursed on',
      valueDate: 'Value date', entryReference: 'Reference', entryAmount: 'Entry', balanceAfter: 'Balance after entry',
    },
    accountTypes: { current: 'Current account', savings: 'Savings account' },
    entryKinds: { migration_opening_balance: 'Opening balance', account_opening: 'Account opening', manual_adjustment: 'Adjustment made by the bank', transfer_debit: 'Transfer', loan_credit: 'Loan disbursement' },
    statuses: { submitted: 'Submitted', under_review: 'Under review', approved_for_external_funding: 'Approved', external_funding_recorded: 'Disbursement recorded', external_settlement_confirmed: 'Completed', rejected: 'Declined', cancelled: 'Cancelled', external_failed: 'External processing failed' },
  },
  de: {
    descriptor: 'VON {bankName} AUSGESTELLTES BANKDOKUMENT', reference: 'Referenz', version: 'Version', page: 'Seite',
    issuedOn: 'Ausgestellt am', revision: 'Lokalisierungsrevision', fingerprint: 'SHA-256-Fingerabdruck der Daten',
    demo: 'DEMONSTRATION — OHNE GÜLTIGKEIT', subject: 'Offizielles {bankName}-Bankdokument',
    account: 'Konto', operation: 'Vorgang', loan: 'Kredit', period: 'Auszugszeitraum', entriesTitle: 'Kontobuchungen',
    yes: 'Ja', no: 'Nein', unavailable: 'Nicht angegeben', from: 'Vom', to: 'bis', balance: 'Saldo', availableBalance: 'Verfügbarer Saldo',
    labels: {
      holderName: 'Kontoinhaber', accountType: 'Kontoart', accountNumber: 'Kontonummer', iban: 'IBAN', bic: 'BIC / SWIFT',
      institutionName: 'Institut', branchName: 'Filiale', branchCode: 'Filialcode', currency: 'Währung', openedAt: 'Eröffnet am', asOf: 'Stand vom',
      reference: 'Vorgangsreferenz', recipientName: 'Empfänger', recipientAccountMasked: 'Empfängerkonto', amount: 'Betrag', targetAmount: 'Empfangsbetrag', settledAt: 'Ausgeführt am',
      loanReference: 'Kreditreferenz', requestedAmount: 'Kreditbetrag', duration: 'Laufzeit', annualRate: 'Unverbindlicher Jahreszins', status: 'Entscheidung / Status', disbursedAt: 'Ausgezahlt am',
      valueDate: 'Wertstellung', entryReference: 'Referenz', entryAmount: 'Buchung', balanceAfter: 'Saldo nach Buchung',
    },
    accountTypes: { current: 'Girokonto', savings: 'Sparkonto' },
    entryKinds: { migration_opening_balance: 'Anfangssaldo', account_opening: 'Kontoeröffnung', manual_adjustment: 'Anpassung durch die Bank', transfer_debit: 'Überweisung', loan_credit: 'Kreditauszahlung' },
    statuses: { submitted: 'Eingereicht', under_review: 'In Prüfung', approved_for_external_funding: 'Genehmigt', external_funding_recorded: 'Auszahlung erfasst', external_settlement_confirmed: 'Abgeschlossen', rejected: 'Abgelehnt', cancelled: 'Storniert', external_failed: 'Externe Verarbeitung fehlgeschlagen' },
  },
  es: {
    descriptor: 'DOCUMENTO BANCARIO EMITIDO POR {bankName}', reference: 'Referencia', version: 'Versión', page: 'Página',
    issuedOn: 'Emitido el', revision: 'Revisión de localización', fingerprint: 'Huella SHA-256 de los datos',
    demo: 'DEMOSTRACIÓN — SIN VALIDEZ', subject: 'Documento bancario oficial de {bankName}',
    account: 'Cuenta', operation: 'Operación', loan: 'Préstamo', period: 'Periodo del estado', entriesTitle: 'Movimientos contables',
    yes: 'Sí', no: 'No', unavailable: 'No informado', from: 'Del', to: 'al', balance: 'Saldo', availableBalance: 'Saldo disponible',
    labels: {
      holderName: 'Titular', accountType: 'Tipo de cuenta', accountNumber: 'Número de cuenta', iban: 'IBAN', bic: 'BIC / SWIFT',
      institutionName: 'Entidad', branchName: 'Sucursal', branchCode: 'Código de sucursal', currency: 'Moneda', openedAt: 'Abierta el', asOf: 'Situación a fecha de',
      reference: 'Referencia de la operación', recipientName: 'Beneficiario', recipientAccountMasked: 'Cuenta beneficiaria', amount: 'Importe', targetAmount: 'Importe recibido', settledAt: 'Ejecutada el',
      loanReference: 'Referencia del préstamo', requestedAmount: 'Importe del préstamo', duration: 'Plazo', annualRate: 'Tipo anual orientativo', status: 'Decisión / estado', disbursedAt: 'Desembolsado el',
      valueDate: 'Fecha valor', entryReference: 'Referencia', entryAmount: 'Movimiento', balanceAfter: 'Saldo tras el movimiento',
    },
    accountTypes: { current: 'Cuenta corriente', savings: 'Cuenta de ahorro' },
    entryKinds: { migration_opening_balance: 'Saldo inicial', account_opening: 'Apertura de la cuenta', manual_adjustment: 'Ajuste realizado por el banco', transfer_debit: 'Transferencia', loan_credit: 'Desembolso del préstamo' },
    statuses: { submitted: 'Enviada', under_review: 'En evaluación', approved_for_external_funding: 'Aprobada', external_funding_recorded: 'Desembolso registrado', external_settlement_confirmed: 'Finalizada', rejected: 'Rechazada', cancelled: 'Cancelada', external_failed: 'Error de procesamiento externo' },
  },
} as const;

function brandedCopy(input: OfficialDocumentPdfInput, language: Language) {
  return applyBrand(COPY[language], input.branding?.bankName || 'Monalyz');
}

function parseLanguage(value: string): Language {
  return value === 'en' || value === 'de' || value === 'es' ? value : 'fr';
}

function parseDocumentType(value: string): OfficialDocumentType {
  const supported: OfficialDocumentType[] = ['bank_details', 'account_statement', 'balance_certificate', 'transfer_confirmation', 'loan_disbursement_confirmation', 'loan_decision'];
  return supported.includes(value as OfficialDocumentType) ? value as OfficialDocumentType : 'account_statement';
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return fallback;
}

function cleanPdfText(value: string) {
  return value.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function dateValue(value: unknown, language: Language, fallback: string, withTime = false) {
  if (typeof value !== 'string') return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(languageLocale(language), withTime
    ? { dateStyle: 'long', timeStyle: 'short' }
    : { dateStyle: 'long' }).format(date);
}

function moneyFromMinor(value: unknown, currency: unknown, language: Language, fallback: string) {
  const amountMinor = typeof value === 'number' ? value : Number(value);
  const currencyCode = typeof currency === 'string' ? currency.toUpperCase() : '';
  if (!Number.isFinite(amountMinor) || !/^[A-Z]{3}$/.test(currencyCode)) return fallback;
  const exponent = ['JPY', 'KRW', 'XOF', 'XAF'].includes(currencyCode) ? 0 : 2;
  try {
    return new Intl.NumberFormat(languageLocale(language), { style: 'currency', currency: currencyCode }).format(amountMinor / 10 ** exponent);
  } catch {
    return `${new Intl.NumberFormat(languageLocale(language)).format(amountMinor / 10 ** exponent)} ${currencyCode}`;
  }
}

function monthValue(value: unknown, language: Language, fallback: string) {
  const months = Number(value);
  if (!Number.isFinite(months)) return fallback;
  return new Intl.NumberFormat(languageLocale(language), { style: 'unit', unit: 'month', unitDisplay: 'long' }).format(months);
}

function percentValue(value: unknown, language: Language, fallback: string) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return fallback;
  return new Intl.NumberFormat(languageLocale(language), { style: 'percent', maximumFractionDigits: 2 }).format(rate);
}

function buildSections(input: OfficialDocumentPdfInput, language: Language, documentType: OfficialDocumentType): PdfSection[] {
  const t = brandedCopy(input, language);
  const snapshot = input.snapshot;
  const account = objectValue(snapshot.account);
  const transfer = objectValue(snapshot.transfer);
  const loan = objectValue(snapshot.loan);
  const currency = account.currency ?? transfer.currency ?? loan.currency;
  const accountRows: PdfRow[] = [
    { label: t.labels.holderName, value: textValue(account.holderName, t.unavailable) },
    { label: t.labels.accountType, value: t.accountTypes[textValue(account.accountType, 'current') as 'current' | 'savings'] ?? t.unavailable },
    { label: t.labels.accountNumber, value: textValue(account.accountNumber, t.unavailable) },
    { label: t.labels.iban, value: textValue(account.iban, t.unavailable) },
    { label: t.labels.bic, value: textValue(account.bic, t.unavailable) },
    { label: t.labels.institutionName, value: textValue(account.institutionName, t.unavailable) },
    { label: t.labels.branchName, value: textValue(account.branchName, t.unavailable) },
    { label: t.labels.branchCode, value: textValue(account.branchCode, t.unavailable) },
    { label: t.labels.currency, value: textValue(account.currency, t.unavailable) },
    { label: t.labels.openedAt, value: dateValue(account.openedAt, language, t.unavailable) },
  ];

  if (documentType === 'bank_details') return [{ title: t.account, rows: accountRows }];
  if (documentType === 'balance_certificate') return [{ title: t.account, rows: [
    ...accountRows.slice(0, 4),
    { label: t.balance, value: moneyFromMinor(account.balanceMinor, currency, language, t.unavailable) },
    { label: t.availableBalance, value: moneyFromMinor(account.availableBalanceMinor, currency, language, t.unavailable) },
    { label: t.labels.asOf, value: dateValue(account.asOf, language, t.unavailable, true) },
  ] }];
  if (documentType === 'transfer_confirmation') return [
    { title: t.operation, rows: [
      { label: t.labels.reference, value: textValue(transfer.reference, input.documentNumber) },
      { label: t.labels.recipientName, value: textValue(transfer.recipientName, t.unavailable) },
      { label: t.labels.recipientAccountMasked, value: textValue(transfer.recipientAccountMasked, t.unavailable) },
      { label: t.labels.amount, value: moneyFromMinor(transfer.amountMinor, transfer.currency, language, t.unavailable) },
      { label: t.labels.targetAmount, value: moneyFromMinor(transfer.targetAmountMinor, transfer.targetCurrency, language, t.unavailable) },
      { label: t.labels.settledAt, value: dateValue(transfer.settledAt, language, t.unavailable, true) },
    ] },
    { title: t.account, rows: accountRows.slice(0, 5) },
  ];
  if (documentType === 'loan_disbursement_confirmation' || documentType === 'loan_decision') return [
    { title: t.loan, rows: [
      { label: t.labels.loanReference, value: textValue(loan.reference, t.unavailable) },
      { label: t.labels.requestedAmount, value: moneyFromMinor(loan.requestedAmountMinor, loan.currency, language, t.unavailable) },
      { label: t.labels.duration, value: monthValue(loan.durationMonths, language, t.unavailable) },
      { label: t.labels.annualRate, value: percentValue(loan.annualRate, language, t.unavailable) },
      { label: t.labels.status, value: t.statuses[textValue(loan.status, 'submitted') as keyof typeof t.statuses] ?? t.unavailable },
      { label: t.labels.reference, value: textValue(loan.disbursementReference, t.unavailable) },
      { label: t.labels.disbursedAt, value: dateValue(loan.disbursedAt, language, t.unavailable, true) },
    ] },
    ...(Object.keys(account).length ? [{ title: t.account, rows: accountRows.slice(0, 5) }] : []),
  ];

  const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
  return [
    { title: t.period, rows: [
      { label: t.from, value: dateValue(snapshot.periodStart, language, t.unavailable) },
      { label: t.to, value: dateValue(snapshot.periodEnd, language, t.unavailable) },
    ] },
    { title: t.account, rows: [
      ...accountRows.slice(0, 4),
      { label: t.balance, value: moneyFromMinor(account.balanceMinor, currency, language, t.unavailable) },
    ] },
    { title: t.entriesTitle, rows: entries.map((rawEntry) => {
      const entry = objectValue(rawEntry);
      const kind = textValue(entry.entryKind, 'manual_adjustment') as LedgerEntryKind;
      const label = `${dateValue(entry.valueDate, language, t.unavailable)} · ${t.entryKinds[kind] ?? t.entryKinds.manual_adjustment}`;
      const value = `${moneyFromMinor(entry.amountMinor, entry.currency, language, t.unavailable)} · ${t.labels.balanceAfter}: ${moneyFromMinor(entry.balanceAfterMinor, entry.currency, language, t.unavailable)} · ${t.labels.entryReference}: ${textValue(entry.internalReference, t.unavailable)}`;
      return { label, value };
    }) },
  ];
}

function wrapText(value: string, font: PDFFont, size: number, width: number) {
  const paragraphs = cleanPdfText(value).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

function drawPageChrome(page: PDFPage, wordmark: PDFImage, regular: PDFFont, bold: PDFFont, input: OfficialDocumentPdfInput, language: Language, pageNumber: number, pageCount: number) {
  const t = brandedCopy(input, language);
  page.drawRectangle({ x: 0, y: A4.height - 82, width: A4.width, height: 82, color: rgb(0.04, 0.08, 0.2) });
  const size = wordmark.scaleToFit(150, 30);
  page.drawImage(wordmark, { x: MARGIN, y: A4.height - 50, width: size.width, height: size.height });
  page.drawText(t.descriptor, { x: MARGIN, y: A4.height - 66, font: regular, size: 8, color: rgb(0.7, 0.8, 1) });
  page.drawRectangle({ x: 0, y: A4.height - 86, width: A4.width, height: 4, color: rgb(0.1, 0.35, 0.82) });
  page.drawText(`${t.reference}: ${cleanPdfText(input.documentNumber)}`, { x: MARGIN, y: 30, font: regular, size: 7.5, color: rgb(0.35, 0.4, 0.5) });
  const pagination = `${t.version} ${input.version} · ${t.page} ${pageNumber} / ${pageCount}`;
  page.drawText(pagination, { x: A4.width - MARGIN - regular.widthOfTextAtSize(pagination, 7.5), y: 30, font: regular, size: 7.5, color: rgb(0.35, 0.4, 0.5) });
  if (input.isDemo) page.drawText(t.demo, { x: 62, y: 390, rotate: degrees(34), font: bold, size: 30, color: rgb(0.9, 0.3, 0.3), opacity: 0.16 });
}

export async function renderOfficialDocumentPdf(input: OfficialDocumentPdfInput) {
  const language = parseLanguage(input.language);
  const documentType = parseDocumentType(input.documentType);
  const bankName = input.branding?.bankName || 'Monalyz';
  const t = brandedCopy(input, language);
  const title = applyBrand(officialDocumentTitle(language, documentType), bankName);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes, fallbackWordmarkBytes] = await Promise.all([
    readFile(REGULAR_FONT_PATH), readFile(BOLD_FONT_PATH),
    input.branding?.logoBytes ? Promise.resolve(null) : readFile(WORDMARK_PATH),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const wordmark = await pdf.embedPng(
    input.branding?.logoBytes ?? fallbackWordmarkBytes!,
  );
  const sections = buildSections(input, language, documentType);
  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - 122;
  const addPage = () => { page = pdf.addPage([A4.width, A4.height]); y = A4.height - 116; };

  for (const line of wrapText(title, bold, 18, CONTENT_WIDTH)) {
    page.drawText(line, { x: MARGIN, y, font: bold, size: 18, color: rgb(0.04, 0.08, 0.2) });
    y -= 23;
  }
  const issuedText = `${t.issuedOn} ${dateValue(input.issuedAt, language, t.unavailable, true)} · ${t.revision} ${input.localizationRevision ?? 2}`;
  page.drawText(issuedText, { x: MARGIN, y: y - 3, font: regular, size: 8.5, color: rgb(0.35, 0.4, 0.5) });
  y -= 34;

  for (const section of sections) {
    if (y < 105) addPage();
    page.drawText(section.title, { x: MARGIN, y, font: bold, size: 11.5, color: rgb(0.1, 0.25, 0.6) });
    y -= 19;
    if (!section.rows.length) {
      page.drawText(t.unavailable, { x: MARGIN, y, font: regular, size: 9, color: rgb(0.35, 0.4, 0.5) });
      y -= 24;
    }
    for (const row of section.rows) {
      const valueLines = wrapText(row.value, regular, 9.2, CONTENT_WIDTH - 181);
      const labelLines = wrapText(row.label, bold, 8.2, 165);
      const rowHeight = Math.max(29, Math.max(valueLines.length * 12, labelLines.length * 11) + 12);
      if (y - rowHeight < 55) addPage();
      page.drawRectangle({ x: MARGIN, y: y - rowHeight + 4, width: CONTENT_WIDTH, height: rowHeight, color: rgb(0.965, 0.975, 0.99), borderColor: rgb(0.88, 0.9, 0.94), borderWidth: 0.5 });
      labelLines.forEach((line, index) => page.drawText(line, { x: MARGIN + 10, y: y - 12 - index * 11, font: bold, size: 8.2, color: rgb(0.25, 0.3, 0.4) }));
      valueLines.forEach((line, index) => page.drawText(line, { x: MARGIN + 181, y: y - 12 - index * 12, font: regular, size: 9.2, color: rgb(0.04, 0.08, 0.2) }));
      y -= rowHeight + 3;
    }
    y -= 12;
  }

  const fingerprint = input.contentHash ?? createHash('sha256').update(JSON.stringify(input.snapshot)).digest('hex');
  if (y < 82) addPage();
  const fingerprintText = `${t.fingerprint}: ${fingerprint}`;
  wrapText(fingerprintText, regular, 7.4, CONTENT_WIDTH).forEach((line, index) => page.drawText(line, { x: MARGIN, y: y - index * 10, font: regular, size: 7.4, color: rgb(0.35, 0.4, 0.5) }));

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => drawPageChrome(pdfPage, wordmark, regular, bold, input, language, index + 1, pages.length));
  const issuedDate = new Date(input.issuedAt);
  pdf.setTitle(title);
  pdf.setSubject(input.isDemo ? t.demo : t.subject);
  pdf.setKeywords([bankName, `brand-revision-${input.branding?.revision ?? 1}`, documentType, input.documentNumber, language, input.isDemo ? 'demonstration' : 'issued']);
  pdf.setAuthor(bankName);
  pdf.setCreator(bankName);
  pdf.setProducer(`${bankName} / pdf-lib / Noto Sans`);
  if (!Number.isNaN(issuedDate.getTime())) {
    pdf.setCreationDate(issuedDate);
    pdf.setModificationDate(issuedDate);
  }
  return pdf.save({ useObjectStreams: false });
}
