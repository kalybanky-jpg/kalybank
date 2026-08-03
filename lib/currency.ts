import type { Currency, CurrencyRates } from './types';
import { languageLocale } from './language';

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'CAD', 'CHF', 'GBP'] as const;

export function isSupportedCurrency(value: unknown): value is Currency {
  return (
    typeof value === 'string' &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}

// Default static fallback rates based on recent live baseline
export const DEFAULT_RATES: CurrencyRates = {
  base: 'EUR',
  rates: {
    EUR: 1.0,
    USD: 1.085,
    CAD: 1.482,
    CHF: 0.965,
    GBP: 0.854,
    // Latam
    MXN: 18.25,
    BRL: 5.42,
    COP: 4320.0,
    ARS: 960.0,
    // Africa
    XOF: 655.95,
    XAF: 655.95,
    MAD: 10.75,
    ZAR: 19.82,
    EGP: 52.45,
    NGN: 1620.0,
  },
  updatedAt: '2026-07-23T00:00:00.000Z',
};

export async function fetchLiveCurrencyRates(): Promise<CurrencyRates> {
  // No banking or market-data API is called. These rates are an explicit
  // configurable baseline used only for non-binding estimates.
  return DEFAULT_RATES;
}

export function convertAmount(
  amountInEUR: number,
  targetCurrency: string,
  rates: CurrencyRates = DEFAULT_RATES
): number {
  const rate = rates.rates[targetCurrency] || 1.0;
  return amountInEUR * rate;
}

export function convertAnyAmount(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string,
  rates: CurrencyRates = DEFAULT_RATES
): number {
  const rateSrc = rates.rates[sourceCurrency] || 1.0;
  const rateTarget = rates.rates[targetCurrency] || 1.0;
  // Convert from source currency to EUR base, then from EUR base to target currency
  const amountInEUR = amount / rateSrc;
  return amountInEUR * rateTarget;
}

export function formatCurrency(
  amountInEUR: number,
  targetCurrency: Currency = 'EUR',
  rates: CurrencyRates = DEFAULT_RATES,
  locale: string = 'fr-FR'
): string {
  const converted = convertAmount(amountInEUR, targetCurrency, rates);

  return new Intl.NumberFormat(languageLocale(locale), {
    style: 'currency',
    currency: targetCurrency,
    currencyDisplay: 'symbol',
  }).format(converted);
}

export function formatDirectCurrency(
  amount: number,
  currency: string,
  locale: string = 'fr-FR'
): string {
  try {
    return new Intl.NumberFormat(languageLocale(locale), {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(languageLocale(locale)).format(amount)} ${currency}`;
  }
}

export function getDefaultCurrencyByCountry(country: string): Currency {
  const c = (country || '').trim().toLowerCase();
  if (
    c.includes('france') ||
    c.includes('allemagne') ||
    c.includes('espagne') ||
    c.includes('italie') ||
    c.includes('belgique') ||
    c.includes('pays-bas') ||
    c.includes('portugal') ||
    c.includes('autriche') ||
    c.includes('irlande') ||
    c.includes('euro') ||
    c.includes('europe')
  ) {
    return 'EUR';
  }
  if (
    c.includes('suisse') ||
    c.includes('switzerland') ||
    c.includes('chf')
  ) {
    return 'CHF';
  }
  if (
    c.includes('royaume-uni') ||
    c.includes('royaume uni') ||
    c.includes('united kingdom') ||
    c.includes('uk') ||
    c.includes('england') ||
    c.includes('gbp') ||
    c.includes('londres')
  ) {
    return 'GBP';
  }
  if (
    c.includes('canada') ||
    c.includes('cad')
  ) {
    return 'CAD';
  }
  if (
    c.includes('usa') ||
    c.includes('états-unis') ||
    c.includes('etats-unis') ||
    c.includes('united states') ||
    c.includes('america')
  ) {
    return 'USD';
  }
  return 'USD'; // default fallback
}
