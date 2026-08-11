import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRANKFURTER_PROVIDER,
  FRANKFURTER_QUOTE_CURRENCIES,
  FRANKFURTER_RATES_URL,
  STATIC_FALLBACK_PROVIDER,
} from '../lib/currency';
import { GET } from '../app/api/exchange-rates/route';

const upstreamRates = () =>
  FRANKFURTER_QUOTE_CURRENCIES.map((quote, index) => ({
    date: '2026-08-08',
    base: 'EUR',
    quote,
    rate: index + 1.25,
  }));

test('exchange-rate API validates Frankfurter and exposes cache metadata', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestedOptions: Record<string, unknown> | undefined;
  globalThis.fetch = (async (input, options) => {
    requestedUrl = String(input);
    requestedOptions = options as unknown as Record<string, unknown>;
    return new Response(JSON.stringify(upstreamRates()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const response = await GET();
    const body = await response.json();

    assert.equal(requestedUrl, FRANKFURTER_RATES_URL);
    assert.equal(
      (requestedOptions?.next as { revalidate?: number }).revalidate,
      3600,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-exchange-rate-provider'), FRANKFURTER_PROVIDER);
    assert.equal(response.headers.get('x-exchange-rate-fallback'), 'false');
    assert.match(response.headers.get('cache-control') ?? '', /s-maxage=3600/);
    assert.equal(body.provider, FRANKFURTER_PROVIDER);
    assert.equal(body.date, '2026-08-08');
    assert.equal(body.fallback, false);
    assert.equal(body.rates.EUR, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('exchange-rate API returns a non-cacheable, explicit fallback', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify([{ invalid: true }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

  try {
    const response = await GET();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-exchange-rate-fallback'), 'true');
    assert.equal(body.provider, STATIC_FALLBACK_PROVIDER);
    assert.equal(body.fallback, true);
    assert.match(body.fallbackReason, /Frankfurter/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
