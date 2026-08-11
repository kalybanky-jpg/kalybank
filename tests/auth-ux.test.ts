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
import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SYMBOLS,
  SUPABASE_PASSWORD_REQUIRED_CHARACTERS,
} from '../lib/password-policy';

function decodeSupabasePasswordGroups(value: string) {
  const parts = value.split(':');
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (part?.endsWith('\\')) {
      parts[index] = `${part.slice(0, -1)}:${parts[index + 1]}`;
      parts[index + 1] = '';
    }
  }
  return parts.filter(Boolean);
}

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
      messages.resetPassword.adminPasswordHint,
      messages.resetPassword.adminPasswordError,
      messages.resetPassword.showPassword,
      messages.resetPassword.hidePassword,
    ];

    assert.equal(guidance.length, 28);
    for (const value of guidance) {
      assert.ok(value.trim().length > 0, `missing ${language} authentication guidance`);
    }
    assert.notEqual(messages.login.email, messages.login.emailPlaceholder);
    assert.notEqual(messages.register.password, messages.register.passwordPlaceholder);
    assert.notEqual(messages.resetPassword.showPassword, messages.resetPassword.hidePassword);
  }
});

test('registration field guidance stays concise and professional', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const { baseCurrencyHint, passwordHint } = publicMessages[language].register;

    for (const hint of [baseCurrencyHint, passwordHint]) {
      assert.ok(
        hint.trim().split(/\s+/).length <= 12,
        `${language} registration guidance is too long`,
      );
    }
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

test('registration and recovery share the strong Supabase password policy', async () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(PASSWORD_MAX_LENGTH, 72);
  assert.equal(isStrongPassword('Aa1!abcd'), true);
  assert.equal(isStrongPassword('Aa1!abc'), false);
  assert.equal(isStrongPassword('Strong!Banking-2026'), true);
  assert.equal(isStrongPassword('onlylettersanddigits2026'), false);
  assert.equal(isStrongPassword('StrongBanking2026é'), false);
  assert.equal(
    isStrongPassword(`Aa1!${'é'.repeat(35)}`),
    false,
    'the bcrypt limit is enforced against UTF-8 bytes',
  );
  const requiredGroups = decodeSupabasePasswordGroups(
    SUPABASE_PASSWORD_REQUIRED_CHARACTERS,
  );
  assert.equal(requiredGroups.length, 4);
  assert.equal(requiredGroups[3], PASSWORD_SYMBOLS);
  assert.equal(requiredGroups[3]?.includes('!'), true);
  assert.equal(requiredGroups[3]?.includes('"'), true);
  assert.equal(requiredGroups[3]?.includes(':'), true);

  const [registration, recovery, config] = await Promise.all([
    readFile(new URL('../app/register/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/reset-pin/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8'),
  ]);

  assert.match(registration, /isStrongPassword\(password\)/);
  assert.match(registration, /minLength=\{PASSWORD_MIN_LENGTH\}/);
  assert.match(registration, /maxLength=\{PASSWORD_MAX_LENGTH\}/);
  assert.match(recovery, /isStrongPassword\(password\)/);
  assert.match(recovery, /isStrongAdminPassword\(password\)/);
  assert.match(recovery, /publicMessages\[isAdminRecovery \? 'fr' : language\]\.resetPassword/);
  assert.match(recovery, /!isAdminRecovery && \([\s\S]*?<LanguageSelector/);
  assert.match(recovery, /role === 'admin' && !isStrongAdminPassword\(password\)/);
  assert.match(recovery, /minLength=\{recoveryPasswordMinLength\}/);
  assert.match(recovery, /maxLength=\{PASSWORD_MAX_LENGTH\}/);
  assert.match(recovery, /role === 'admin' \? '\/admin-login' : '\/login'/);
  assert.match(config, /minimum_password_length = 8/);
  assert.match(
    config,
    /password_requirements = "lower_upper_letters_digits_symbols"/,
  );
});

test('registration email guidance never guarantees delivery for an existing account', () => {
  const conditionalMarkers = {
    fr: ['Si cette adresse', 'Si un code peut être envoyé', 'réinitialisez votre mot de passe'],
    en: ['If this address', 'If a code can be sent', 'reset your password'],
    de: ['Wenn diese Adresse', 'Wenn für diese Anfrage', 'setzen Sie Ihr Passwort zurück'],
    es: ['Si esta dirección', 'Si se puede enviar', 'restablezca su contraseña'],
    it: ['Se questo indirizzo', 'Se è possibile inviare', 'reimposti la password'],
    nl: ['Als dit adres', 'Als een code kan worden verzonden', 'stel uw wachtwoord opnieuw in'],
  } as const;

  for (const language of SUPPORTED_LANGUAGES) {
    const [requestMarker, resendMarker, recoveryMarker] = conditionalMarkers[language];
    assert.match(publicMessages[language].register.checkEmailBody, new RegExp(`^${requestMarker}`));
    assert.match(publicMessages[language].register.resendSuccess, new RegExp(`^${resendMarker}`));
    assert.match(publicMessages[language].register.checkEmailBody, new RegExp(recoveryMarker));
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
