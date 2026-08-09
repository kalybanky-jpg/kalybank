import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_PASSWORD_MIN_LENGTH,
  AdminCredentialValidationError,
  isStrongAdminPassword,
  normalizeAdminEmail,
  parseAdminCredentialChange,
} from '../lib/admin-credentials';

const currentEmail = 'admin@monalyz.test';
const currentPassword = 'Current!Admin-2026';

test('les changements d’identifiants sont normalisés et strictement validés', () => {
  assert.equal(normalizeAdminEmail('  ADMIN@Example.COM '), 'admin@example.com');
  assert.deepEqual(
    parseAdminCredentialChange(
      {
        kind: 'email',
        email: '  Direction@Example.COM ',
        currentPassword,
      },
      currentEmail,
    ),
    {
      kind: 'email',
      email: 'direction@example.com',
      currentPassword,
    },
  );
  assert.deepEqual(
    parseAdminCredentialChange(
      {
        kind: 'password',
        currentPassword,
        newPassword: 'New!Admin-Password-2026',
        confirmPassword: 'New!Admin-Password-2026',
      },
      currentEmail,
    ),
    {
      kind: 'password',
      currentPassword,
      newPassword: 'New!Admin-Password-2026',
    },
  );
  assert.equal(ADMIN_PASSWORD_MIN_LENGTH, 16);
  assert.equal(ADMIN_PASSWORD_MAX_LENGTH, 72);
  assert.equal(isStrongAdminPassword('New!Admin-Password-2026'), true);
  assert.equal(isStrongAdminPassword('new-admin-password-2026'), false);
  assert.equal(isStrongAdminPassword('New Admin Password 2026!'), false);
});

test('les valeurs inchangées, faibles ou non confirmées sont refusées', () => {
  const codeOf = (operation: () => unknown) => {
    try {
      operation();
      return null;
    } catch (error) {
      assert.ok(error instanceof AdminCredentialValidationError);
      return error.code;
    }
  };

  assert.equal(
    codeOf(() =>
      parseAdminCredentialChange(
        { kind: 'email', email: currentEmail, currentPassword },
        currentEmail,
      ),
    ),
    'EMAIL_UNCHANGED',
  );
  assert.equal(
    codeOf(() =>
      parseAdminCredentialChange(
        { kind: 'email', email: 'adresse-invalide', currentPassword },
        currentEmail,
      ),
    ),
    'INVALID_EMAIL',
  );
  assert.equal(
    codeOf(() =>
      parseAdminCredentialChange(
        {
          kind: 'password',
          currentPassword,
          newPassword: 'New!Admin-Password-2026',
          confirmPassword: 'Different!Password-2026',
        },
        currentEmail,
      ),
    ),
    'PASSWORD_MISMATCH',
  );
  assert.equal(
    codeOf(() =>
      parseAdminCredentialChange(
        {
          kind: 'password',
          currentPassword,
          newPassword: currentPassword,
          confirmPassword: currentPassword,
        },
        currentEmail,
      ),
    ),
    'PASSWORD_REUSED',
  );
  assert.equal(
    codeOf(() =>
      parseAdminCredentialChange(
        {
          kind: 'password',
          currentPassword,
          newPassword: 'too-short1!',
          confirmPassword: 'too-short1!',
        },
        currentEmail,
      ),
    ),
    'WEAK_PASSWORD',
  );
});

test('la route d’identifiants réauthentifie le même admin avant tout privilège', async () => {
  const route = await readFile(
    new URL('../app/api/admin/credentials/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(route, /isSameOriginMutation\(request\)/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /role !== 'admin'/);
  assert.match(
    route,
    /signInWithPassword\([\s\S]*email: admin\.email[\s\S]*password: change\.currentPassword/,
  );
  assert.match(route, /verified\.user\?\.id === admin\.user\.id/);
  assert.match(route, /verifier\.auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(route, /updateUserById\([\s\S]*admin\.user\.id/);
  assert.match(route, /email_confirm: true/);
  assert.match(route, /admin\.supabase\.auth\.signOut\(\{ scope: 'global' \}\)/);
  assert.match(route, /p_email_changed:[\s\S]*p_password_changed:/);
  assert.match(route, /worker\.rpc\([\s\S]*'record_admin_credentials_update'/);
  assert.doesNotMatch(route, /from\('audit_events'\)\.insert/);
  assert.doesNotMatch(route, /payload\.userId|payload\.role|service_role/);
  assert.doesNotMatch(
    route,
    /console\.(?:log|warn|error)\([\s\S]*?(?:rawBody|currentPassword|newPassword)/,
  );
});

test('l’espace admin expose deux formulaires accessibles et force la reconnexion', async () => {
  const [settings, login] = await Promise.all([
    readFile(
      new URL('../components/AdminCredentialsSettings.tsx', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../app/admin-login/page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(settings, /Modifier l’adresse e-mail/);
  assert.match(settings, /Modifier le mot de passe/);
  assert.equal((settings.match(/autoComplete="current-password"/g) ?? []).length, 2);
  assert.equal((settings.match(/autoComplete="new-password"/g) ?? []).length, 2);
  assert.match(settings, /credentials: 'same-origin'/);
  assert.match(settings, /method: 'PUT'/);
  assert.match(settings, /setCurrentEmail\(body\.email\)/);
  assert.match(
    settings,
    /parseAdminCredentialChange\(payload, currentEmail\)/,
  );
  assert.doesNotMatch(settings, /parseAdminCredentialChange\(payload, email\)/);
  assert.match(settings, /signOut\(\{ scope: 'local' \}\)/);
  assert.match(settings, /window\.location\.replace\(`\/admin-login\?updated=\$\{kind\}`\)/);
  assert.match(login, /href="\/reset-pin\?next=\/admin-login"/);
  assert.match(login, /updated === 'email'/);
  assert.match(login, /updated === 'password'/);
});
