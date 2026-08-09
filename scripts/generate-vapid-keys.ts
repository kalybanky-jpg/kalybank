import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url');
}

export function generateVapidKeys() {
  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const jwk = privateKey.export({ format: 'jwk' });

  if (!jwk.x || !jwk.y || !jwk.d) {
    throw new Error('La génération de la paire VAPID a échoué.');
  }

  const publicKey = Buffer.concat([
    Buffer.from([0x04]),
    decodeBase64Url(jwk.x),
    decodeBase64Url(jwk.y),
  ]).toString('base64url');

  return {
    publicKey,
    privateKey: decodeBase64Url(jwk.d).toString('base64url'),
  };
}

export function generateSupportIdentitySecret() {
  return randomBytes(32).toString('hex');
}

export function generateSupportRetrySecret() {
  return randomBytes(32).toString('hex');
}

export function generateTawkWebhookSecret() {
  return randomBytes(32).toString('hex');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const keys = generateVapidKeys();
  const webhookIdentitySecret = generateSupportIdentitySecret();
  const transcriptRetrySecret = generateSupportRetrySecret();
  const tawkWebhookSecret = generateTawkWebhookSecret();
  process.stdout.write(
    [
      `VAPID_PUBLIC_KEY=${keys.publicKey}`,
      `VAPID_PRIVATE_KEY=${keys.privateKey}`,
      `TAWK_WEBHOOK_IDENTITY_SECRET=${webhookIdentitySecret}`,
      `SUPPORT_TRANSCRIPT_RETRY_SECRET=${transcriptRetrySecret}`,
      `TAWK_WEBHOOK_SECRET=${tawkWebhookSecret}`,
      '',
      'Conservez VAPID_PRIVATE_KEY uniquement dans les secrets de la Supabase Edge Function.',
      'Définissez TAWK_WEBHOOK_IDENTITY_SECRET avec la même valeur côté Next.js et Supabase Edge.',
      'Conservez SUPPORT_TRANSCRIPT_RETRY_SECRET uniquement dans Supabase Vault et les secrets Edge.',
      'Copiez TAWK_WEBHOOK_SECRET dans la configuration du webhook tawk.to.',
    ].join('\n'),
  );
}
