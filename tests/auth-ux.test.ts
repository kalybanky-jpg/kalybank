import assert from 'node:assert/strict';
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
      messages.register.passwordPlaceholder,
      messages.register.confirmPasswordPlaceholder,
      messages.register.passwordHint,
      messages.register.showPassword,
      messages.register.hidePassword,
      messages.resetPassword.emailPlaceholder,
      messages.resetPassword.passwordPlaceholder,
      messages.resetPassword.confirmPasswordPlaceholder,
      messages.resetPassword.passwordHint,
      messages.resetPassword.showPassword,
      messages.resetPassword.hidePassword,
    ];

    assert.equal(guidance.length, 21);
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
