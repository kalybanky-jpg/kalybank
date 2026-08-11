import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createTawkIdentityHash,
  createTawkIdentityPayload,
  createTawkWebhookIdentityMarker,
  getTawkServerConfig,
  getVapidPublicKey,
  parseTawkWidgetIds,
  resolveTawkWidgetId,
  selectTawkLocale,
  TawkConfigurationError,
} from '../lib/support/tawk-server';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const VAPID_PUBLIC_KEY = `B${'A'.repeat(86)}`;
const WEBHOOK_IDENTITY_SECRET = 'test-webhook-identity-secret-32-chars';

test('tawk.to Secure Mode signs the exact Supabase UUID with HMAC SHA-256', () => {
  assert.equal(
    createTawkIdentityHash(USER_ID, 'test-secret'),
    'a94f2f365abfe020d6cec64d7ee82da5d9da699780dd451ba15610c69c63283d',
  );
  assert.throws(
    () => createTawkIdentityHash('not-a-uuid', 'test-secret'),
    TypeError,
  );
  assert.throws(
    () => createTawkIdentityHash(USER_ID.toUpperCase(), 'test-secret'),
    TypeError,
  );
});

test('the transcript identity marker cryptographically binds the Supabase UUID', () => {
  const marker = createTawkWebhookIdentityMarker(
    USER_ID,
    WEBHOOK_IDENTITY_SECRET,
  );
  assert.match(
    marker,
    /^\[mz1:550e8400-e29b-41d4-a716-446655440000:[0-9a-f]{32}\]$/,
  );
  assert.equal(
    marker,
    '[mz1:550e8400-e29b-41d4-a716-446655440000:6587a8709b1386f458b21af9caab242d]',
  );
  assert.equal(
    marker,
    createTawkWebhookIdentityMarker(USER_ID, WEBHOOK_IDENTITY_SECRET),
  );
  assert.notEqual(
    marker,
    createTawkWebhookIdentityMarker(
      '550e8400-e29b-41d4-a716-446655440001',
      WEBHOOK_IDENTITY_SECRET,
    ),
  );
  assert.throws(
    () => createTawkWebhookIdentityMarker(USER_ID, 'too-short'),
    TawkConfigurationError,
  );
});

test('widget configuration supports exact, primary, default, and fr fallbacks', () => {
  const widgets = parseTawkWidgetIds(
    JSON.stringify({
      default: 'default-widget',
      en: 'english-widget',
      'pt-BR': 'brazil-widget',
      de_DE: 'german-widget',
      ja: 'future-language-widget',
    }),
  );

  assert.equal(resolveTawkWidgetId('pt-BR', widgets), 'brazil-widget');
  assert.equal(resolveTawkWidgetId('en-GB', widgets), 'english-widget');
  assert.equal(resolveTawkWidgetId('de-DE', widgets), 'german-widget');
  assert.equal(resolveTawkWidgetId('ja-JP', widgets), 'future-language-widget');
  assert.equal(resolveTawkWidgetId('nl-NL', widgets), 'default-widget');
  assert.equal(resolveTawkWidgetId(null, widgets), 'default-widget');

  const frenchFallback = parseTawkWidgetIds('{"fr":"french-widget"}');
  assert.equal(resolveTawkWidgetId('nl-NL', frenchFallback), 'french-widget');
});

test('the active query language wins over the persisted profile language', () => {
  assert.equal(selectTawkLocale('EN_us', 'fr'), 'en-us');
  assert.equal(selectTawkLocale('', 'fr'), 'fr');
  assert.equal(selectTawkLocale('../invalid', 'de'), 'de');
});

test('invalid widget mappings fail closed', () => {
  for (const value of [
    undefined,
    'not-json',
    '[]',
    '{"en":"english-widget"}',
    '{"default":"../../widget"}',
    '{"fr-FR":"one","fr_fr":"two","default":"fallback"}',
  ]) {
    assert.throws(
      () => parseTawkWidgetIds(value),
      TawkConfigurationError,
    );
  }
});

test('server configuration builds the public identity without exposing its API key', () => {
  const environment = {
    TAWK_PROPERTY_ID: 'property-id',
    TAWK_WIDGET_IDS:
      '{"default":"french-widget","fr":"french-widget","en":"english-widget","de":"german-widget","es":"spanish-widget","it":"italian-widget","nl":"dutch-widget"}',
    TAWK_API_KEY: 'server-only-api-key',
    TAWK_WEBHOOK_IDENTITY_SECRET: WEBHOOK_IDENTITY_SECRET,
    VAPID_PUBLIC_KEY,
    NODE_ENV: 'test',
  } as NodeJS.ProcessEnv;
  const config = getTawkServerConfig(environment);
  const identity = createTawkIdentityPayload(
    {
      userId: USER_ID,
      email: 'user@example.com',
      name: '  Ada Lovelace  ',
      locale: 'fr-FR',
    },
    config,
  );

  assert.deepEqual(identity, {
    userId: USER_ID,
    hash: createTawkIdentityHash(USER_ID, environment.TAWK_API_KEY!),
    name: `Ada Lovelace ${createTawkWebhookIdentityMarker(
      USER_ID,
      WEBHOOK_IDENTITY_SECRET,
    )}`,
    email: 'user@example.com',
    propertyId: 'property-id',
    widgetId: 'french-widget',
  });
  assert.equal('apiKey' in identity, false);
  assert.equal('webhookIdentitySecret' in identity, false);
  assert.equal(resolveTawkWidgetId('it-IT', config.widgetIds), 'italian-widget');
  assert.equal(resolveTawkWidgetId('nl-NL', config.widgetIds), 'dutch-widget');
  assert.equal(getVapidPublicKey(environment), VAPID_PUBLIC_KEY);
  assert.throws(
    () =>
      getVapidPublicKey({
        NODE_ENV: 'test',
        VAPID_PUBLIC_KEY: 'not-a-p256-key',
      }),
    TawkConfigurationError,
  );
});

test('server configuration requires one distinct widget per supported language', () => {
  const baseEnvironment = {
    TAWK_PROPERTY_ID: 'property-id',
    TAWK_API_KEY: 'server-only-api-key',
    TAWK_WEBHOOK_IDENTITY_SECRET: WEBHOOK_IDENTITY_SECRET,
    VAPID_PUBLIC_KEY,
    NODE_ENV: 'test',
  } as NodeJS.ProcessEnv;

  assert.throws(
    () =>
      getTawkServerConfig({
        ...baseEnvironment,
        TAWK_WIDGET_IDS:
          '{"default":"french-widget","fr":"french-widget","en":"english-widget","de":"german-widget"}',
      }),
    /dedicated widgets for: es, it, nl/,
  );
  assert.throws(
    () =>
      getTawkServerConfig({
        ...baseEnvironment,
        TAWK_WIDGET_IDS:
          '{"default":"french-widget","fr":"french-widget","en":"shared-widget","de":"shared-widget","es":"spanish-widget","it":"italian-widget","nl":"dutch-widget"}',
      }),
    /distinct widget for each supported language/,
  );
});

test('committed environment documentation includes distinct Italian and Dutch widget slots', async () => {
  for (const file of ['.env.example', '.env.remote.example']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /"it":"widget-it"/);
    assert.match(source, /"nl":"widget-nl"/);
  }
});
