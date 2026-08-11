import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../supabase/migrations/20260811060932_add_italian_dutch_customer_localization.sql',
  import.meta.url,
);
const schemaUrl = new URL('../supabase/schema.sql', import.meta.url);

const customerLanguages = ['fr', 'en', 'de', 'es', 'it', 'nl'];

function functionBody(source: string, declaration: string) {
  const declarationStart = source.indexOf(declaration);
  assert.ok(declarationStart >= 0, `${declaration} must exist`);

  const bodyStart = source.indexOf('$$', declarationStart);
  const bodyEnd = source.indexOf('$$;', bodyStart + 2);
  assert.ok(bodyStart >= 0 && bodyEnd > bodyStart, `${declaration} must have a body`);

  return source.slice(bodyStart + 2, bodyEnd).trim().replaceAll('\r\n', '\n');
}

function constraintLanguages(source: string, constraintName: string) {
  const constraintStart = source.indexOf(constraintName);
  assert.ok(constraintStart >= 0, `${constraintName} must exist`);

  const allowlistStart = source.indexOf("'fr'", constraintStart);
  assert.ok(allowlistStart >= 0, `${constraintName} must have a language allowlist`);
  const allowlistEnd = source.indexOf('\n', allowlistStart);
  const definition = source.slice(
    allowlistStart,
    allowlistEnd >= 0 ? allowlistEnd : undefined,
  );
  return [...definition.matchAll(/'(fr|en|de|es|it|nl)'/g)].map(
    ([, language]) => language,
  );
}

test('Italian and Dutch are added to every persisted customer-language allowlist', async () => {
  const migration = await readFile(migrationUrl, 'utf8');
  const allowlist = "('fr', 'en', 'de', 'es', 'it', 'nl')";

  assert.match(migration, /profiles_preferred_language_allowed/);
  assert.match(migration, /kyc_drafts_preferred_language_check/);
  assert.match(migration, /official_documents_language_check/);
  assert.ok(
    migration.split(allowlist).length - 1 >= 6,
    'all constraints and function allowlists must use the six-language contract',
  );
  assert.match(migration, /OFFICIAL_DOCUMENT_LANGUAGE_ALLOWLIST_REWRITE_FAILED/);
  assert.match(migration, /legacy_occurrences <> 1/);
});

test('rewritten privileged functions retain a closed execution contract', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  for (const functionName of [
    'private.handle_new_user',
    'public.save_kyc_draft',
    'private.enqueue_kyc_message',
  ]) {
    const start = migration.indexOf(`create or replace function ${functionName}`);
    assert.ok(start >= 0, `${functionName} must be replaced explicitly`);
    const end = migration.indexOf('$$;', start);
    const definition = migration.slice(start, end);
    assert.match(definition, /security definer/);
    assert.match(definition, /set search_path = ''/);
  }

  assert.match(
    migration,
    /revoke all on function private\.handle_new_user\(\)[\s\S]*from public, anon, authenticated;[\s\S]*grant execute on function private\.handle_new_user\(\)[\s\S]*to service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.save_kyc_draft\(integer, jsonb, jsonb, text\)[\s\S]*to authenticated, service_role;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.branch_manager_issue_official_document\([\s\S]*to authenticated, service_role;/,
  );
  assert.match(
    migration,
    /revoke all on function private\.enqueue_kyc_message\(\)[\s\S]*from public, anon, authenticated;[\s\S]*grant execute on function private\.enqueue_kyc_message\(\)[\s\S]*to service_role;/,
  );
});

test('KYC notifications are keyed at the source with canonical French audit copy', async () => {
  const migration = await readFile(migrationUrl, 'utf8');
  const enqueueStart = migration.indexOf(
    'create or replace function private.enqueue_kyc_message()',
  );
  const enqueueEnd = migration.indexOf('$$;', enqueueStart);
  const enqueue = migration.slice(enqueueStart, enqueueEnd);

  assert.match(enqueue, /message_key_text := case new\.status/);
  for (const messageKey of [
    'kyc_submitted',
    'kyc_information_requested',
    'kyc_resubmitted',
    'kyc_approved',
    'kyc_rejected',
  ]) {
    assert.match(enqueue, new RegExp(`'${messageKey}'`));
  }
  assert.match(enqueue, /message_key,[\s\S]*message_params,[\s\S]*action_path/);
  assert.match(enqueue, /'kycId', new\.id/);
  assert.match(enqueue, /'status', new\.status/);
  assert.match(enqueue, /'version', new\.version/);
  assert.match(enqueue, /'reasonCode', new\.correction_reason_code/);
  assert.match(enqueue, /'dueAt', new\.correction_due_at/);
  assert.match(enqueue, /Dossier d’identité transmis/);
  assert.match(enqueue, /Le dossier d’identité a été transmis pour vérification\./);
  assert.doesNotMatch(enqueue, /when 'it'/);
  assert.doesNotMatch(enqueue, /when 'nl'/);
});

test('the committed schema snapshot matches the migration contract', async () => {
  const [migration, schema] = await Promise.all([
    readFile(migrationUrl, 'utf8'),
    readFile(schemaUrl, 'utf8'),
  ]);

  for (const constraintName of [
    'profiles_preferred_language_allowed',
    'kyc_drafts_preferred_language_check',
    'official_documents_language_check',
  ]) {
    assert.deepEqual(
      constraintLanguages(migration, constraintName),
      customerLanguages,
      `${constraintName} migration allowlist must be complete and ordered`,
    );
    assert.deepEqual(
      constraintLanguages(schema, constraintName),
      customerLanguages,
      `${constraintName} snapshot allowlist must match the migration`,
    );
  }

  for (const [migrationDeclaration, schemaDeclaration] of [
    [
      'create or replace function private.handle_new_user()',
      'CREATE OR REPLACE FUNCTION "private"."handle_new_user"()',
    ],
    [
      'create or replace function public.save_kyc_draft(',
      'CREATE OR REPLACE FUNCTION "public"."save_kyc_draft"(',
    ],
    [
      'create or replace function private.enqueue_kyc_message()',
      'CREATE OR REPLACE FUNCTION "private"."enqueue_kyc_message"()',
    ],
  ]) {
    assert.equal(
      functionBody(schema, schemaDeclaration),
      functionBody(migration, migrationDeclaration),
      `${migrationDeclaration} source must be identical in the snapshot`,
    );
  }

  const issuer = functionBody(
    schema,
    'CREATE OR REPLACE FUNCTION "public"."branch_manager_issue_official_document"(',
  );
  assert.match(issuer, /normalized_language not in \('fr', 'en', 'de', 'es', 'it', 'nl'\)/);
  assert.doesNotMatch(issuer, /normalized_language not in \('fr', 'en', 'de', 'es'\)/);
});
