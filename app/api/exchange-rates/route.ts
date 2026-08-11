import { NextResponse } from 'next/server';
import {
  createFallbackCurrencyRates,
  FRANKFURTER_RATES_URL,
  parseFrankfurterV2Rates,
} from '@/lib/currency';

export const revalidate = 3600;

const REVALIDATE_SECONDS = revalidate;

const liveResponseHeaders = (provider: string, date: string) => ({
  'Cache-Control':
    `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
  'X-Exchange-Rate-Date': date,
  'X-Exchange-Rate-Fallback': 'false',
  'X-Exchange-Rate-Provider': provider,
});

const fallbackResponse = () => {
  const snapshot = createFallbackCurrencyRates(
    'Frankfurter est temporairement indisponible ou a renvoyé des taux invalides.',
  );
  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Exchange-Rate-Date': snapshot.date,
      'X-Exchange-Rate-Fallback': 'true',
      'X-Exchange-Rate-Provider': snapshot.provider,
    },
  });
};

export async function GET() {
  try {
    const upstreamResponse = await fetch(FRANKFURTER_RATES_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ExchangeRateService/1.0',
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!upstreamResponse.ok) {
      return fallbackResponse();
    }

    const snapshot = parseFrankfurterV2Rates(await upstreamResponse.json());
    return NextResponse.json(snapshot, {
      headers: liveResponseHeaders(snapshot.provider, snapshot.date),
    });
  } catch {
    return fallbackResponse();
  }
}
