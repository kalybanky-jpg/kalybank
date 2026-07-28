import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authFailureRedirect,
  configuredServerAppOrigin,
  safeHttpOrigin,
  safeInternalPath,
} from '../lib/security/navigation';

const fallback = '/myaccount';

test('safeInternalPath accepts only normalized same-origin application paths', () => {
  assert.equal(safeInternalPath('/onboarding?step=2#proof', fallback), '/onboarding?step=2#proof');
  assert.equal(safeInternalPath('/admin/transfers', fallback), '/admin/transfers');
});

test('safeInternalPath blocks absolute, protocol-relative and backslash redirects', () => {
  for (const candidate of [
    null,
    '',
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
    '/%5c%5cattacker.example',
    '/%00admin',
    '/%E0%A4%A',
  ]) {
    assert.equal(safeInternalPath(candidate, fallback), fallback);
  }
});

test('safeHttpOrigin accepts only canonical HTTP origins', () => {
  assert.equal(safeHttpOrigin('https://app.kaly.test/path?q=1'), 'https://app.kaly.test');
  assert.equal(safeHttpOrigin('http://127.0.0.1:3000/auth/callback'), 'http://127.0.0.1:3000');
  assert.equal(safeHttpOrigin('javascript:alert(1)'), null);
  assert.equal(safeHttpOrigin('not a URL'), null);
});

test('configuredServerAppOrigin refuses request-host fallback in production', () => {
  const previousAppOrigin = process.env.APP_ORIGIN;
  const previousPublicOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  delete process.env.APP_ORIGIN;
  delete process.env.NEXT_PUBLIC_APP_ORIGIN;

  try {
    assert.equal(
      configuredServerAppOrigin('https://untrusted-host.example', 'production'),
      null,
    );
    assert.equal(
      configuredServerAppOrigin('http://127.0.0.1:3000', 'development'),
      'http://127.0.0.1:3000',
    );
  } finally {
    if (previousAppOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousAppOrigin;
    if (previousPublicOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    else process.env.NEXT_PUBLIC_APP_ORIGIN = previousPublicOrigin;
  }
});

test('configuredServerAppOrigin prioritizes the server-only canonical origin', () => {
  const previousAppOrigin = process.env.APP_ORIGIN;
  const previousPublicOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  process.env.APP_ORIGIN = 'https://kaly.example/callback';
  process.env.NEXT_PUBLIC_APP_ORIGIN = 'https://public.example';

  try {
    assert.equal(
      configuredServerAppOrigin('https://request.example', 'production'),
      'https://kaly.example',
    );
  } finally {
    if (previousAppOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousAppOrigin;
    if (previousPublicOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    else process.env.NEXT_PUBLIC_APP_ORIGIN = previousPublicOrigin;
  }
});

test('authFailureRedirect closes stale sessions on protected routes', () => {
  assert.equal(
    authFailureRedirect('/myaccount'),
    '/login?error=session&next=%2Fmyaccount',
  );
  assert.equal(
    authFailureRedirect('/onboarding/identity'),
    '/login?error=session&next=%2Fonboarding%2Fidentity',
  );
  assert.equal(
    authFailureRedirect('/admin/transfers'),
    '/admin-login?error=session',
  );
  assert.equal(
    authFailureRedirect('/reset-pin', '?mode=update'),
    '/reset-pin?error=recovery_session',
  );
  assert.equal(authFailureRedirect('/login'), null);
});
