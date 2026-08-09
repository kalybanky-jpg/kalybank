import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateSupportIdentitySecret,
  generateSupportRetrySecret,
  generateTawkWebhookSecret,
  generateVapidKeys,
} from '../scripts/generate-vapid-keys';

test('generateVapidKeys returns URL-safe P-256 material accepted by Web Push', () => {
  const keys = generateVapidKeys();
  const publicKey = Buffer.from(keys.publicKey, 'base64url');
  const privateKey = Buffer.from(keys.privateKey, 'base64url');

  assert.equal(publicKey.byteLength, 65);
  assert.equal(publicKey[0], 0x04);
  assert.equal(privateKey.byteLength, 32);
  assert.match(keys.publicKey, /^[A-Za-z0-9_-]+$/);
  assert.match(keys.privateKey, /^[A-Za-z0-9_-]+$/);
});

test('generateSupportIdentitySecret returns 256 bits of random server-only material', () => {
  const first = generateSupportIdentitySecret();
  const second = generateSupportIdentitySecret();
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.match(second, /^[0-9a-f]{64}$/);
  assert.notEqual(first, second);
});

test('generateSupportRetrySecret returns an independent 256-bit token', () => {
  const identitySecret = generateSupportIdentitySecret();
  const retrySecret = generateSupportRetrySecret();

  assert.match(retrySecret, /^[0-9a-f]{64}$/);
  assert.notEqual(retrySecret, identitySecret);
});

test('generateTawkWebhookSecret returns a distinct 256-bit webhook key', () => {
  const identitySecret = generateSupportIdentitySecret();
  const retrySecret = generateSupportRetrySecret();
  const webhookSecret = generateTawkWebhookSecret();

  assert.match(webhookSecret, /^[0-9a-f]{64}$/);
  assert.notEqual(webhookSecret, identitySecret);
  assert.notEqual(webhookSecret, retrySecret);
});
