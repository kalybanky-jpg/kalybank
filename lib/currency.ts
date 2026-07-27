import { Currency, CurrencyRates } from './types';

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

const RATE_CACHE_KEY = 'novabank_currency_rates_v1_updated';

export async function fetchLiveCurrencyRates(): Promise<CurrencyRates> {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (cached) {
      try {
        const parsed: CurrencyRates = JSON.parse(cached);
        const age = Date.now() - new Date(parsed.updatedAt).getTime();
        // Use cache if under 1 hour old
        if (age < 3600000 && parsed.rates?.CAD && parsed.rates?.USD && parsed.rates?.GBP) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse cached currency rates', e);
      }
    }
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/EUR', {
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        const newRates: CurrencyRates = {
          base: 'EUR',
          rates: {
            EUR: 1.0,
            USD: data.rates.USD || DEFAULT_RATES.rates.USD,
            CAD: data.rates.CAD || DEFAULT_RATES.rates.CAD,
            CHF: data.rates.CHF || DEFAULT_RATES.rates.CHF,
            GBP: data.rates.GBP || DEFAULT_RATES.rates.GBP,
            MXN: data.rates.MXN || DEFAULT_RATES.rates.MXN,
            BRL: data.rates.BRL || DEFAULT_RATES.rates.BRL,
            COP: data.rates.COP || DEFAULT_RATES.rates.COP,
            ARS: data.rates.ARS || DEFAULT_RATES.rates.ARS,
            XOF: data.rates.XOF || DEFAULT_RATES.rates.XOF,
            XAF: data.rates.XAF || DEFAULT_RATES.rates.XAF,
            MAD: data.rates.MAD || DEFAULT_RATES.rates.MAD,
            ZAR: data.rates.ZAR || DEFAULT_RATES.rates.ZAR,
            EGP: data.rates.EGP || DEFAULT_RATES.rates.EGP,
            NGN: data.rates.NGN || DEFAULT_RATES.rates.NGN,
          },
          updatedAt: new Date().toISOString(),
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(newRates));
        }
        return newRates;
      }
    }
  } catch (err) {
    console.warn('Could not fetch live exchange rates, using fallback baseline', err);
  }

  return DEFAULT_RATES;
}

export function convertAmount(
  amountInEUR: number,
  targetCurrency: string,
  rates: CurrencyRates = DEFAULT_RATES
): number {
  const rate = rates.rates[targetCurrency as any] || 1.0;
  return amountInEUR * rate;
}

export function convertAnyAmount(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string,
  rates: CurrencyRates = DEFAULT_RATES
): number {
  const rateSrc = rates.rates[sourceCurrency as any] || 1.0;
  const rateTarget = rates.rates[targetCurrency as any] || 1.0;
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

  const currencySymbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    CAD: 'CA$',
    CHF: 'CHF',
    GBP: '£',
  };

  const formattedNum = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);

  const symbol = currencySymbols[targetCurrency] || targetCurrency;

  if (locale.startsWith('fr')) {
    return `${formattedNum} ${symbol}`;
  } else {
    return `${symbol} ${formattedNum}`;
  }
}

export function formatDirectCurrency(
  amount: number,
  currency: string,
  locale: string = 'fr-FR'
): string {
  const currencySymbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    CAD: 'CA$',
    CHF: 'CHF',
    GBP: '£',
    MXN: 'MX$',
    BRL: 'R$',
    COP: 'COP$',
    ARS: 'ARS$',
    XOF: 'CFA',
    XAF: 'FCFA',
    MAD: 'DH',
    ZAR: 'R',
    EGP: 'E£',
    NGN: '₦',
  };

  const symbol = currencySymbols[currency] || currency;

  const formattedNum = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  if (locale.startsWith('fr')) {
    return `${formattedNum} ${symbol}`;
  } else {
    return `${symbol} ${formattedNum}`;
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
