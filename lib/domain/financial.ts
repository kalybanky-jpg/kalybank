export const CURRENCY_EXPONENTS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export function currencyExponent(currency: string) {
  return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2;
}

export function toMinorUnits(amount: number, currency: string) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Le montant doit être un nombre strictement positif.');
  }

  const factor = 10 ** currencyExponent(currency);
  const minor = Math.round((amount + Number.EPSILON) * factor);
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new Error('Le montant dépasse la précision prise en charge.');
  }
  return minor;
}

export function fromMinorUnits(amountMinor: number, currency: string) {
  return amountMinor / 10 ** currencyExponent(currency);
}

export function maskFinancialIdentifier(identifier: string) {
  const compact = identifier.trim().replace(/\s+/g, ' ');
  if (!compact) throw new Error('La référence du bénéficiaire est obligatoire.');

  const visible = compact.slice(-4);
  return `${'•'.repeat(Math.min(Math.max(compact.length - 4, 4), 12))}${visible}`;
}

export function transferProgress(status: string, completedChecks: number) {
  if (status === 'external_settlement_confirmed') return 100;
  if (['rejected', 'cancelled', 'external_failed'].includes(status)) return 0;
  if (status === 'external_execution_recorded') return 90;
  if (status === 'approved_for_external_execution') return 75;
  return Math.min(70, Math.max(5, completedChecks * 17));
}

export function loanProgress(status: string, completedChecks: number) {
  if (status === 'external_settlement_confirmed') return 100;
  if (['rejected', 'cancelled', 'external_failed'].includes(status)) return 0;
  if (status === 'external_funding_recorded') return 90;
  if (status === 'approved_for_external_funding') return 75;
  return Math.min(70, Math.max(5, completedChecks * 17));
}

export function isTerminalWorkflowStatus(status: string) {
  return [
    'external_settlement_confirmed',
    'rejected',
    'cancelled',
    'external_failed',
  ].includes(status);
}
