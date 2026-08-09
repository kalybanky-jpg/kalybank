export interface PushRegistrationPayload {
  endpoint: string;
  expirationTime: number | null;
  p256dh: string;
  authKey: string;
}

const MAX_ENDPOINT_LENGTH = 4_096;
const MAX_KEY_LENGTH = 1_024;
const BASE64_URL = /^[A-Za-z0-9_-]+={0,2}$/;

function validPushKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_KEY_LENGTH &&
    BASE64_URL.test(value)
  );
}

export function parsePushRegistrationPayload(
  value: unknown,
): PushRegistrationPayload | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.endpoint !== 'string' ||
    candidate.endpoint.length === 0 ||
    candidate.endpoint.length > MAX_ENDPOINT_LENGTH
  ) {
    return null;
  }

  try {
    const endpoint = new URL(candidate.endpoint);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
      return null;
    }
  } catch {
    return null;
  }

  const keys = candidate.keys;
  if (!keys || typeof keys !== 'object') return null;
  const keyValues = keys as Record<string, unknown>;
  if (!validPushKey(keyValues.p256dh) || !validPushKey(keyValues.auth)) {
    return null;
  }

  const expirationTime = candidate.expirationTime;
  if (
    expirationTime !== undefined &&
    expirationTime !== null &&
    (typeof expirationTime !== 'number' ||
      !Number.isSafeInteger(expirationTime) ||
      expirationTime < 0)
  ) {
    return null;
  }

  return {
    endpoint: candidate.endpoint,
    expirationTime:
      typeof expirationTime === 'number' ? expirationTime : null,
    p256dh: keyValues.p256dh,
    authKey: keyValues.auth,
  };
}
