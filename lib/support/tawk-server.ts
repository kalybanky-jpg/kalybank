import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';

const SAFE_TAWK_ID = /^[A-Za-z0-9_-]{1,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALE = /^[a-z0-9]{1,8}(?:-[a-z0-9]{1,8})*$/;
const SUPPORT_IDENTITY_MARKER_VERSION = 'mz1';
const SUPPORT_IDENTITY_HMAC_CONTEXT = 'mz1:';
const SUPPORT_IDENTITY_TAG_HEX_LENGTH = 32;
const MAX_TAWK_VISITOR_NAME_LENGTH = 180;
const REQUIRED_WIDGET_LOCALES = ['fr', 'en', 'de', 'es', 'it', 'nl'] as const;

export class TawkConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TawkConfigurationError';
  }
}

export type TawkWidgetIds = Readonly<Record<string, string>>;

export type TawkServerConfig = {
  propertyId: string;
  widgetIds: TawkWidgetIds;
  apiKey: string;
  webhookIdentitySecret: string;
};

export type TawkIdentityPayload = {
  userId: string;
  hash: string;
  name: string;
  email: string;
  propertyId: string;
  widgetId: string;
};

function requiredEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new TawkConfigurationError(`${name} is required.`);
  }
  if (/[\r\n\0]/.test(value)) {
    throw new TawkConfigurationError(`${name} contains invalid characters.`);
  }
  return value;
}

function parseSafeTawkId(value: string, name: string) {
  const normalized = value.trim();
  if (!SAFE_TAWK_ID.test(normalized)) {
    throw new TawkConfigurationError(`${name} is invalid.`);
  }
  return normalized;
}

export function normalizeTawkLocale(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().replaceAll('_', '-').toLowerCase();
  return LOCALE.test(normalized) ? normalized : null;
}

export function selectTawkLocale(
  requestedLocale: string | null | undefined,
  profileLocale: string | null | undefined,
) {
  return normalizeTawkLocale(requestedLocale) ?? profileLocale ?? null;
}

export function parseTawkWidgetIds(value: string | undefined): TawkWidgetIds {
  if (!value?.trim()) {
    throw new TawkConfigurationError('TAWK_WIDGET_IDS is required.');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    throw new TawkConfigurationError('TAWK_WIDGET_IDS must be valid JSON.');
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new TawkConfigurationError('TAWK_WIDGET_IDS must be a JSON object.');
  }

  const widgetIds: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  for (const [rawLocale, rawWidgetId] of Object.entries(decoded)) {
    const locale =
      rawLocale.trim().toLowerCase() === 'default'
        ? 'default'
        : normalizeTawkLocale(rawLocale);
    if (!locale) {
      throw new TawkConfigurationError(
        'TAWK_WIDGET_IDS contains an invalid locale key.',
      );
    }
    if (Object.prototype.hasOwnProperty.call(widgetIds, locale)) {
      throw new TawkConfigurationError(
        'TAWK_WIDGET_IDS contains duplicate normalized locale keys.',
      );
    }
    if (typeof rawWidgetId !== 'string') {
      throw new TawkConfigurationError(
        'TAWK_WIDGET_IDS values must be widget identifiers.',
      );
    }
    widgetIds[locale] = parseSafeTawkId(
      rawWidgetId,
      `TAWK_WIDGET_IDS.${locale}`,
    );
  }

  if (!widgetIds.default && !widgetIds.fr) {
    throw new TawkConfigurationError(
      'TAWK_WIDGET_IDS must define a default or fr fallback.',
    );
  }

  return Object.freeze(widgetIds);
}

export function resolveTawkWidgetId(
  locale: string | null | undefined,
  widgetIds: TawkWidgetIds,
) {
  const normalizedLocale = normalizeTawkLocale(locale);
  const candidates = normalizedLocale
    ? [normalizedLocale, normalizedLocale.split('-')[0], 'default', 'fr']
    : ['default', 'fr'];

  for (const candidate of new Set(candidates)) {
    const widgetId = widgetIds[candidate];
    if (widgetId) return widgetId;
  }

  throw new TawkConfigurationError(
    'No tawk.to widget matches the requested locale or configured fallbacks.',
  );
}

export function getTawkServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): TawkServerConfig {
  const widgetIds = parseTawkWidgetIds(environment.TAWK_WIDGET_IDS);
  const missingLocales = REQUIRED_WIDGET_LOCALES.filter(
    (locale) => !widgetIds[locale],
  );
  if (missingLocales.length > 0) {
    throw new TawkConfigurationError(
      `TAWK_WIDGET_IDS must define dedicated widgets for: ${missingLocales.join(', ')}.`,
    );
  }

  const localizedWidgetIds = REQUIRED_WIDGET_LOCALES.map(
    (locale) => widgetIds[locale],
  );
  if (new Set(localizedWidgetIds).size !== localizedWidgetIds.length) {
    throw new TawkConfigurationError(
      'TAWK_WIDGET_IDS must use a distinct widget for each supported language.',
    );
  }

  return {
    propertyId: parseSafeTawkId(
      requiredEnvironmentValue(environment, 'TAWK_PROPERTY_ID'),
      'TAWK_PROPERTY_ID',
    ),
    widgetIds,
    apiKey: requiredEnvironmentValue(environment, 'TAWK_API_KEY'),
    webhookIdentitySecret: requiredEnvironmentValue(
      environment,
      'TAWK_WEBHOOK_IDENTITY_SECRET',
    ),
  };
}

export function createTawkIdentityHash(userId: string, apiKey: string) {
  if (!UUID.test(userId) || userId !== userId.toLowerCase()) {
    throw new TypeError('A canonical Supabase user UUID is required.');
  }
  if (!apiKey || /[\r\n\0]/.test(apiKey)) {
    throw new TawkConfigurationError('TAWK_API_KEY is invalid.');
  }

  return createHmac('sha256', apiKey).update(userId, 'utf8').digest('hex');
}

export function createTawkWebhookIdentityMarker(
  userId: string,
  secret: string,
) {
  if (!UUID.test(userId) || userId !== userId.toLowerCase()) {
    throw new TypeError('A canonical Supabase user UUID is required.');
  }
  if (secret.length < 32 || /[\r\n\0]/.test(secret)) {
    throw new TawkConfigurationError(
      'TAWK_WEBHOOK_IDENTITY_SECRET must contain at least 32 characters.',
    );
  }

  const tag = createHmac('sha256', secret)
    .update(`${SUPPORT_IDENTITY_HMAC_CONTEXT}${userId}`, 'utf8')
    .digest('hex')
    .slice(0, SUPPORT_IDENTITY_TAG_HEX_LENGTH);
  return `[${SUPPORT_IDENTITY_MARKER_VERSION}:${userId}:${tag}]`;
}

function markedTawkVisitorName(
  displayName: string,
  userId: string,
  secret: string,
) {
  const marker = createTawkWebhookIdentityMarker(userId, secret);
  const maximumDisplayLength = MAX_TAWK_VISITOR_NAME_LENGTH - marker.length - 1;
  const boundedDisplayName = Array.from(displayName)
    .slice(0, maximumDisplayLength)
    .join('')
    .trim();
  return `${boundedDisplayName || userId} ${marker}`;
}

export function createTawkIdentityPayload(
  input: {
    userId: string;
    email: string;
    name?: string | null;
    locale?: string | null;
  },
  config: TawkServerConfig,
): TawkIdentityPayload {
  const email = input.email.trim();
  if (!email) {
    throw new TypeError('An authenticated email is required.');
  }

  const displayName = input.name?.trim() || email.split('@')[0] || input.userId;
  return {
    userId: input.userId,
    hash: createTawkIdentityHash(input.userId, config.apiKey),
    // The official transcript webhook omits Secure Mode's userId. This signed,
    // agent-visible suffix lets the Edge Function bind a transcript to the
    // Supabase UUID without trusting the visitor-editable e-mail address.
    name: markedTawkVisitorName(
      displayName,
      input.userId,
      config.webhookIdentitySecret,
    ),
    email,
    propertyId: config.propertyId,
    widgetId: resolveTawkWidgetId(input.locale, config.widgetIds),
  };
}

export function getVapidPublicKey(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const publicKey = requiredEnvironmentValue(environment, 'VAPID_PUBLIC_KEY');
  if (!/^[A-Za-z0-9_-]+$/.test(publicKey)) {
    throw new TawkConfigurationError(
      'VAPID_PUBLIC_KEY must be unpadded base64url.',
    );
  }

  const decoded = Buffer.from(publicKey, 'base64url');
  if (decoded.byteLength !== 65 || decoded[0] !== 0x04) {
    throw new TawkConfigurationError(
      'VAPID_PUBLIC_KEY must be an uncompressed P-256 public key.',
    );
  }

  return publicKey;
}
