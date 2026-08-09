import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PasswordField from '../components/auth/PasswordField';
import { publicMessages } from '../lib/public-i18n';
import { SUPPORTED_LANGUAGES } from '../lib/language';
import {
  EMAIL_OTP_LENGTH,
  isValidEmailOtp,
  normalizeEmailOtp,
} from '../lib/auth-email-otp';

test('every supported language provides complete authentication form guidance', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const messages = publicMessages[language];
    const guidance = [
      messages.login.emailPlaceholder,
      messages.login.passwordPlaceholder,
      messages.login.showPassword,
      messages.login.hidePassword,
      messages.adminLogin.emailPlaceholder,
      messages.adminLogin.passwordPlaceholder,
      messages.adminLogin.showPassword,
      messages.adminLogin.hidePassword,
      messages.register.displayNamePlaceholder,
      messages.register.emailPlaceholder,
      messages.register.baseCurrency,
      messages.register.baseCurrencyPlaceholder,
      messages.register.baseCurrencyHint,
      messages.register.baseCurrencyRequiredError,
      messages.register.passwordPlaceholder,
      messages.register.confirmPasswordPlaceholder,
      messages.register.passwordHint,
      messages.register.showPassword,
      messages.register.hidePassword,
      messages.register.resetAccess,
      messages.resetPassword.emailPlaceholder,
      messages.resetPassword.passwordPlaceholder,
      messages.resetPassword.confirmPasswordPlaceholder,
      messages.resetPassword.passwordHint,
      messages.resetPassword.showPassword,
      messages.resetPassword.hidePassword,
    ];

    assert.equal(guidance.length, 26);
    for (const value of guidance) {
      assert.ok(value.trim().length > 0, `missing ${language} authentication guidance`);
    }
    assert.notEqual(messages.login.email, messages.login.emailPlaceholder);
    assert.notEqual(messages.register.password, messages.register.passwordPlaceholder);
    assert.notEqual(messages.resetPassword.showPassword, messages.resetPassword.hidePassword);
  }
});

test('password field renders its visible label, guidance, and accessibility contract', () => {
  const markup = renderToStaticMarkup(
    React.createElement(PasswordField, {
      id: 'test-password',
      name: 'newPassword',
      label: 'New password',
      value: '',
      onChange: () => undefined,
      autoComplete: 'new-password',
      placeholder: 'Create a secure password',
      showPasswordLabel: 'Show password',
      hidePasswordLabel: 'Hide password',
      describedBy: 'form-error',
      helpText: 'Use at least 10 characters.',
      helpTextId: 'password-hint',
      invalid: true,
      minLength: 10,
      dark: true,
    }),
  );

  assert.match(markup, /<label for="test-password"/);
  assert.match(markup, /type="password"/);
  assert.match(markup, /autoComplete="new-password"/);
  assert.match(markup, /placeholder="Create a secure password"/);
  assert.match(markup, /aria-describedby="form-error password-hint"/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /minLength="10"/);
  assert.match(markup, /<button type="button"/);
  assert.match(markup, /aria-label="Show password"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /id="password-hint"/);
});

test('email OTP handling shares the six-digit Supabase contract', () => {
  assert.equal(EMAIL_OTP_LENGTH, 6);
  assert.equal(normalizeEmailOtp(' 12a34-567 '), '123456');
  assert.equal(isValidEmailOtp('123456'), true);
  assert.equal(isValidEmailOtp('12345'), false);
  assert.equal(isValidEmailOtp('12345678'), false);
});

test('registration email guidance never guarantees delivery for an existing account', () => {
  const conditionalMarkers = {
    fr: ['Si cette adresse', 'Si un code peut être envoyé'],
    en: ['If this address', 'If a code can be sent'],
    de: ['Wenn diese Adresse', 'Wenn für diese Anfrage'],
    es: ['Si esta dirección', 'Si se puede enviar'],
  } as const;

  for (const language of SUPPORTED_LANGUAGES) {
    const [requestMarker, resendMarker] = conditionalMarkers[language];
    assert.match(publicMessages[language].register.checkEmailBody, new RegExp(`^${requestMarker}`));
    assert.match(publicMessages[language].register.resendSuccess, new RegExp(`^${resendMarker}`));
  }
});

test('registration requires one base currency and sends identical currency metadata', async () => {
  const source = await readFile(
    new URL('../app/register/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /<select[^>]*id="register-base-currency"[^>]*required[^>]*>/);
  assert.match(source, /<option value="" disabled>/);
  assert.match(source, /SUPPORTED_CURRENCIES\.map/);
  assert.match(source, /base_currency:\s*baseCurrency/);
  assert.match(source, /preferred_currency:\s*baseCurrency/);
});
