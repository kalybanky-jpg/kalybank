import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  EMAIL_OTP_LENGTH,
  isValidEmailOtp,
  normalizeEmailOtp,
  savePendingRegistration,
  getPendingRegistration,
  clearPendingRegistration,
  PENDING_REGISTRATION_STORAGE_KEY,
  PENDING_REGISTRATION_MAX_AGE_MS,
} from '../lib/auth-email-otp';

const readFileUtf8 = (relPath: string) =>
  readFile(new URL(relPath, import.meta.url), 'utf8');

test('normalizeEmailOtp strips non-digits and truncates to 6 characters', () => {
  assert.equal(EMAIL_OTP_LENGTH, 6);
  assert.equal(normalizeEmailOtp('123456'), '123456');
  assert.equal(normalizeEmailOtp('  12-34 56  '), '123456');
  assert.equal(normalizeEmailOtp('abc987654321xyz'), '987654');
  assert.equal(normalizeEmailOtp(''), '');
});

test('isValidEmailOtp strictly validates 6 digits', () => {
  assert.equal(isValidEmailOtp('123456'), true);
  assert.equal(isValidEmailOtp('000000'), true);
  assert.equal(isValidEmailOtp('12345'), false);
  assert.equal(isValidEmailOtp('1234567'), false);
  assert.equal(isValidEmailOtp('12345a'), false);
  assert.equal(isValidEmailOtp(null), false);
  assert.equal(isValidEmailOtp(undefined), false);
  assert.equal(isValidEmailOtp(123456), false);
});

test('pending registration state persistence (save, get, clear, ttl, recovery)', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  // Mock global window and storage
  const originalWindow = globalThis.window;
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mockStorage,
    sessionStorage: mockStorage,
  };

  try {
    // 1. Initial state is null
    assert.equal(getPendingRegistration(), null);

    // 2. Save registration state
    const now = Date.now();
    const cooldownUntil = now + 60_000;
    savePendingRegistration({
      email: '  Test.User@Monalyz.com  ',
      displayName: 'Test User',
      baseCurrency: 'EUR',
      resendCooldownUntil: cooldownUntil,
      submittedAt: now,
    });

    // 3. Retrieve and verify normalization
    const retrieved = getPendingRegistration();
    assert.ok(retrieved);
    assert.equal(retrieved.email, 'test.user@monalyz.com');
    assert.equal(retrieved.displayName, 'Test User');
    assert.equal(retrieved.baseCurrency, 'EUR');
    assert.equal(retrieved.resendCooldownUntil, cooldownUntil);
    assert.equal(retrieved.submittedAt, now);

    // 4. Test TTL expiry
    const expiredTime = now - (PENDING_REGISTRATION_MAX_AGE_MS + 1000);
    savePendingRegistration({
      email: 'expired@monalyz.com',
      resendCooldownUntil: now,
      submittedAt: expiredTime,
    });
    assert.equal(getPendingRegistration(), null);
    assert.equal(store.has(PENDING_REGISTRATION_STORAGE_KEY), false);

    // 5. Test clearPendingRegistration
    savePendingRegistration({
      email: 'clear-me@monalyz.com',
      resendCooldownUntil: now + 30_000,
      submittedAt: now,
    });
    assert.ok(getPendingRegistration());
    clearPendingRegistration();
    assert.equal(getPendingRegistration(), null);
    assert.equal(store.has(PENDING_REGISTRATION_STORAGE_KEY), false);

    // 6. Test corrupted storage recovery
    store.set(PENDING_REGISTRATION_STORAGE_KEY, 'not-valid-json{');
    assert.equal(getPendingRegistration(), null);
    assert.equal(store.has(PENDING_REGISTRATION_STORAGE_KEY), false);
  } finally {
    (globalThis as unknown as { window: unknown }).window = originalWindow;
  }
});

test('RegisterPage source code integrates pending registration persistence and recovery', async () => {
  const source = await readFileUtf8('../app/register/page.tsx');

  // Verify imports
  assert.match(source, /getPendingRegistration/);
  assert.match(source, /savePendingRegistration/);
  assert.match(source, /clearPendingRegistration/);

  // Verify mount recovery
  assert.match(source, /const pending = getPendingRegistration\(\);/);
  assert.match(source, /setSubmitted\(true\);/);

  // Verify save on signUp
  assert.match(source, /savePendingRegistration\(\{[\s\S]*?email: normalizedEmail/);

  // Verify save on resend
  assert.match(source, /handleResendOtp[\s\S]*?savePendingRegistration/);

  // Verify clear on verifyOtp success
  assert.match(source, /handleVerifyOtp[\s\S]*?clearPendingRegistration\(\);[\s\S]*?window\.location\.assign\('\/onboarding'\)/);
});
