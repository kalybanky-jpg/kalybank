import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ClientPurgeValidationError,
  ClientPurgeOwnershipError,
  isClientOwnedStoragePath,
  manifestChunks,
  parseClientPurgeExecution,
  parseClientPurgePreview,
  parseClientPurgeResume,
  parseClientPurgeTarget,
  storageChunks,
  validateClientPurgeStorageReference,
} from '../lib/client-purge';
import { digest, normalizeEmail, validSweepSecret } from '../lib/server/client-purge';

const targetUserId = '10000000-0000-4000-8000-000000000001';
const challengeId = '20000000-0000-4000-8000-000000000001';
const idempotencyKey = '30000000-0000-4000-8000-000000000001';
const challengeToken = 'A'.repeat(43);

test('les charges preview et suppression sont strictement validées', () => {
  assert.deepEqual(
    parseClientPurgePreview({ idempotencyKey }),
    { idempotencyKey },
  );
  assert.equal(parseClientPurgeTarget(targetUserId), targetUserId);
  assert.deepEqual(
    parseClientPurgeExecution({
      challengeId,
      idempotencyKey,
      challengeToken,
      exactEmail: 'client@example.test',
      currentPassword: 'password-secret',
    }),
    {
      challengeId,
      idempotencyKey,
      challengeToken,
      exactEmail: 'client@example.test',
      currentPassword: 'password-secret',
    },
  );
  assert.throws(
    () =>
      parseClientPurgeExecution({
        challengeId,
        idempotencyKey,
        challengeToken,
        exactEmail: ' client@example.test',
        currentPassword: 'password-secret',
      }),
    ClientPurgeValidationError,
  );
  assert.deepEqual(
    parseClientPurgeResume({
      resume: true,
      exactEmail: 'client@example.test',
      currentPassword: 'password-secret',
    }),
    {
      resume: true,
      exactEmail: 'client@example.test',
      currentPassword: 'password-secret',
    },
  );
  assert.throws(
    () => parseClientPurgePreview({ idempotencyKey, unexpected: true }),
    ClientPurgeValidationError,
  );
  assert.throws(
    () =>
      parseClientPurgeResume({
        resume: true,
        exactEmail: 'client@example.test',
        currentPassword: 'password-secret',
        challengeToken,
      }),
    ClientPurgeValidationError,
  );
});

test('les suppressions Storage sont dédupliquées et plafonnées à 1000 objets', () => {
  const paths = Array.from({ length: 2_005 }, (_, index) => `owner/${index}`);
  paths.push('owner/0');
  const chunks = storageChunks(paths);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [1_000, 1_000, 5]);
  assert.equal(chunks[0][0], 'owner/0');
  const opaquePath = 'owner/relevé 🧾.pdf ';
  assert.deepEqual(storageChunks([opaquePath]), [[opaquePath]]);
  assert.throws(() => storageChunks(['owner/file\0.pdf']), RangeError);
  assert.throws(() => storageChunks(paths, 1_001), RangeError);
  assert.throws(() => storageChunks(['owner/../other']), RangeError);
  assert.deepEqual(
    manifestChunks(Array.from({ length: 2_005 }, (_, index) => index)).map(
      (batch) => batch.length,
    ),
    [1_000, 1_000, 5],
  );
});

test('les chemins Storage sous préfixe restent strictement dans le namespace cible', () => {
  const foreignUserId = '10000000-0000-4000-8000-000000000002';
  assert.equal(
    isClientOwnedStoragePath(targetUserId, `${targetUserId}/proof.pdf`),
    true,
  );
  assert.equal(
    isClientOwnedStoragePath(targetUserId, `${foreignUserId}/proof.pdf`),
    false,
  );
  assert.throws(
    () =>
      validateClientPurgeStorageReference(targetUserId, {
        bucket: 'kyc-evidence',
        objectPath: `${foreignUserId}/proof.pdf`,
        ownershipScope: 'target_prefix',
        ownershipValid: false,
      }),
    ClientPurgeOwnershipError,
  );
  assert.doesNotThrow(() =>
    validateClientPurgeStorageReference(targetUserId, {
      bucket: 'external-execution-evidence',
      objectPath: `${foreignUserId}/admin-proof.pdf`,
      ownershipScope: 'relational',
      ownershipValid: true,
    }),
  );
  assert.doesNotThrow(() =>
    validateClientPurgeStorageReference(targetUserId, {
      bucket: 'external-execution-evidence',
      objectPath: `${foreignUserId}/preuve héritée 🧾.pdf `,
      ownershipScope: 'relational',
      ownershipValid: true,
    }),
  );
});

test('les secrets et e-mails sont condensés de façon déterministe', () => {
  assert.equal(normalizeEmail(' Client@Example.TEST '), 'client@example.test');
  assert.equal(digest('secret').length, 64);
  const previous = process.env.CLIENT_PURGE_SWEEP_SECRET;
  process.env.CLIENT_PURGE_SWEEP_SECRET = 'sweep-secret-32-characters-long!';
  assert.equal(validSweepSecret('sweep-secret-32-characters-long!'), true);
  assert.equal(validSweepSecret('wrong-secret'), false);
  if (previous === undefined) delete process.env.CLIENT_PURGE_SWEEP_SECRET;
  else process.env.CLIENT_PURGE_SWEEP_SECRET = previous;
});

test('les routes imposent admin actif, origine, mot de passe et e-mail exact', async () => {
  const [access, preview, previewContinue, purge, listing] = await Promise.all([
    readFile(new URL('../lib/server/client-purge.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/admin/clients/[userId]/purge/preview/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/admin/clients/[userId]/purge/preview/continue/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/admin/clients/[userId]/purge/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/admin/clients/route.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(access, /staff\.role !== 'admin' \|\| !staff\.active/);
  assert.match(access, /targetUserId === admin\.user\.id/);
  assert.match(access, /STAFF_PURGE_FORBIDDEN/);
  assert.match(access, /CLIENT_PURGE_AUTH_FETCH_TIMEOUT_MS = 15_000/);
  assert.match(access, /CLIENT_PURGE_AUTH_REQUEST_TIMEOUT_MS = 18_000/);
  assert.match(access, /createBoundedPrivilegedFetch\(/);
  assert.match(access, /authRequestSignal/);
  assert.match(access, /effectiveRequestSignal/);
  assert.match(access, /createClient\(\{[\s\S]*fetch:/);
  assert.match(preview, /isSameOriginMutation\(request\)/);
  assert.match(preview, /createClientPurgeRequestSignal\(request\.signal\)/);
  assert.match(previewContinue, /isSameOriginMutation\(request\)/);
  assert.match(previewContinue, /createClientPurgeRequestSignal\(request\.signal\)/);
  assert.match(previewContinue, /recoverPurgePreview/);
  assert.match(previewContinue, /Record<string, unknown>\)\.continue !== true/);
  assert.match(purge, /isSameOriginMutation\(request\)/);
  assert.match(purge, /input\.exactEmail !== target\.email/);
  assert.match(purge, /createClientPurgeRequestSignal\(request\.signal\)/);
  assert.match(
    purge,
    /verifyAdminPassword\([\s\S]*?access\.admin,[\s\S]*?input\.currentPassword,[\s\S]*?requestSignal/,
  );
  assert.match(purge, /parseClientPurgeResume/);
  assert.match(purge, /export async function GET/);
  assert.match(purge, /export async function POST/);
  assert.match(listing, /admin_list_client_purge_candidates/);
  assert.match(listing, /createClientPurgeRequestSignal\(request\.signal\)/);
  assert.match(listing, /auth\.admin\.getUserById\(row\.user_id\)/);
  assert.doesNotMatch(purge, /console\.(?:log|warn|error)/);
});

test('l’orchestration traite une unité durable bornée puis Storage, RPC, Auth et vérification', async () => {
  const [source, shared] = await Promise.all([
    readFile(new URL('../lib/server/client-purge.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/client-purge.ts', import.meta.url), 'utf8'),
  ]);
  const storage = source.indexOf("'admin_claim_client_purge_storage_work'");
  const relational = source.indexOf("'admin_purge_client_relational_data'");
  const authDelete = source.indexOf('auth.admin.deleteUser');
  const authVerify = source.lastIndexOf('auth.admin.getUserById');
  const finalize = source.indexOf("'admin_finalize_client_purge'");
  assert.ok(storage > 0 && storage < relational);
  assert.ok(relational < authDelete);
  assert.ok(authDelete < authVerify);
  assert.ok(authVerify < finalize);
  assert.match(source, /p_limit: 1_000/);
  assert.match(source, /storageChunks\(paths\)/);
  assert.match(source, /if \(stage === 'storage'\)/);
  assert.match(source, /if \(stage === 'database'\)/);
  assert.match(source, /if \(stage === 'storage_sweep'\)/);
  assert.match(source, /state\.status === 'waiting_sweep'/);
  assert.match(source, /admin_ack_client_purge_storage_work/);
  assert.match(source, /export async function processStorageWorkUnit/);
  assert.match(source, /CLIENT_PURGE_STORAGE_VERIFY_CONCURRENCY = 8/);
  assert.doesNotMatch(source, /admin_store_client_purge_manifest/);
  assert.doesNotMatch(source, /admin_client_purge_storage_paths/);
  assert.doesNotMatch(source, /Promise\.all\(work\.items\.map/);
  assert.match(source, /admin_list_pending_client_purges/);
  assert.match(source, /validateClientPurgeStorageReference/);
  assert.ok(
    (source.match(/await processStorageWorkUnit\(/g) ?? []).length >= 4,
    'preview, initial, delayed and final Storage cycles are explicit',
  );
  assert.match(shared, /'upload-staging'/);
});

test('le contrat SQL est privé, verrouillé, ordonné et efface son propre état', async () => {
  const migration = await readFile(
    new URL(
      '../supabase/migrations/20260811070824_guarded_client_data_purge.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(migration, /create table private\.client_purge_operations/);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /to service_role/);
  assert.match(migration, /SELF_PURGE_FORBIDDEN/);
  assert.match(migration, /STAFF_PURGE_FORBIDDEN/);
  assert.match(
    migration,
    /revoke all on table public\.profiles, public\.staff_members from service_role;[\s\S]*grant select on table public\.profiles, public\.staff_members to service_role;/,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:insert|update|delete)[^;]*public\.(?:profiles|staff_members)[^;]*service_role/i,
  );
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /set access_status = 'frozen'/);
  assert.match(migration, /from auth\.users as users/);
  assert.match(migration, /coalesce\(profile\.access_status, 'missing'\)/);
  assert.match(migration, /interval '2 hours 5 minutes'/);
  assert.match(migration, /create table private\.client_purge_storage_manifest/);
  assert.match(migration, /create table private\.client_purge_storage_scan_queue/);
  assert.match(migration, /create table private\.client_purge_entity_manifest/);
  assert.match(migration, /primary key \(challenge_id, bucket, object_path\)/);
  assert.doesNotMatch(migration, /storage_manifest jsonb/);
  assert.match(migration, /support_email_manifest jsonb/);
  assert.match(migration, /'preservedAdmins'/);
  assert.match(migration, /entity_id text not null/);
  assert.match(migration, /client_purge_storage_manifest_work_idx/);
  assert.match(migration, /client_purge_storage_manifest_expired_claim_idx/);
  assert.match(migration, /client_purge_storage_manifest_relational_path_idx/);
  assert.match(migration, /scope_digest text/);
  assert.match(migration, /PURGE_PREVIEW_STALE/);
  assert.match(migration, /PURGE_EVIDENCE_PATH_QUARANTINED/);
  assert.match(migration, /PURGE_EVIDENCE_PATH_OWNERSHIP_CONFLICT/);
  assert.match(
    migration,
    /if p_cycle_stage in \('preview', 'storage'\) then[\s\S]*delete from private\.client_purge_storage_manifest[\s\S]*ownership_scope = 'relational'/,
  );
  assert.match(migration, /delete from private\.client_purge_entity_manifest/);
  assert.match(migration, /old_relation_id/);
  assert.match(migration, /new_relation_id/);
  assert.match(migration, /old_data/);
  assert.match(migration, /new_data/);
  assert.match(migration, /admin_resume_client_purge/);
  assert.match(migration, /admin_get_client_purge_status/);
  assert.match(migration, /PURGE_MANIFEST_OWNERSHIP_INVALID/);
  assert.match(migration, /admin_claim_client_purge_storage_work/);
  assert.match(migration, /admin_ack_client_purge_storage_work/);
  assert.match(migration, /admin_assert_client_purge_auth_ready/);
  assert.match(migration, /client_purge_storage_references/);
  assert.match(migration, /private\.lock_client_mutation\(owner_id\)/);
  assert.match(migration, /private\.client_purge_lock_key\(p_target_user_id\)/);
  assert.match(migration, /UNGUARDED_AUTH_DELETE_FORBIDDEN/);
  assert.match(migration, /PURGE_TARGET_EMAIL_CHANGED/);
  assert.match(migration, /PURGE_TARGET_PROMOTION_FORBIDDEN/);
  assert.match(migration, /monalyz\.allow_ledger_maintenance/);
  assert.match(migration, /monalyz\.allow_official_document_maintenance/);
  assert.ok(
    migration.indexOf('delete from public.official_documents') <
      migration.indexOf('delete from public.financial_positions'),
  );
  assert.ok(
    migration.lastIndexOf('delete from private.client_purge_operations') >
      migration.indexOf('admin_finalize_client_purge'),
  );
  assert.doesNotMatch(migration, /delete from storage\.(?:objects|buckets)/i);
  const purgeFinalization = migration.slice(
    migration.indexOf('create or replace function public.admin_purge_client_relational_data'),
    migration.indexOf('create or replace function public.admin_list_pending_client_purges'),
  );
  assert.doesNotMatch(purgeFinalization, /insert into public\.audit_events/i);
  assert.doesNotMatch(
    migration,
    /grant select, insert, update, delete on table private\.client_purge_operations/i,
  );
  assert.doesNotMatch(
    migration,
    /lower\(metadata::text\) like '%' \|\| target_email/i,
  );
  assert.doesNotMatch(migration, /strpos\([^\n]*metadata/i);
  assert.match(migration, /drop function public\.admin_store_client_purge_manifest/);
  assert.match(migration, /drop function public\.admin_client_purge_storage_paths/);
  assert.ok(
    (migration.match(/(?:transcript\.)?user_id is null/g) ?? []).length >= 2,
    'historical e-mails may only match unresolved support transcripts',
  );
});

test('l’interface Clients est mobile-first avec une confirmation rapide et réauthentifiée', async () => {
  const ui = await readFile(
    new URL('../components/AdminClientsView.tsx', import.meta.url),
    'utf8',
  );
  assert.match(ui, /grid min-w-0 gap-3 md:hidden/);
  assert.match(ui, /hidden overflow-x-auto md:block/);
  assert.match(ui, /<Dialog/);
  assert.match(ui, /<DialogPanel/);
  assert.match(ui, /initialFocusRef=\{passwordInput\}/);
  assert.match(ui, /autoComplete="current-password"/);
  assert.match(ui, /exactEmail: preview\.targetEmail/);
  assert.match(ui, /method: 'POST'/);
  assert.match(ui, /\/api\/admin\/clients\/\$\{selected\.id\}\/purge/);
  assert.match(ui, /Reprendre la suppression/);
  assert.match(ui, /au moins deux heures et cinq minutes plus tard/);
  assert.match(ui, /safe-area-inset-bottom/);
  assert.match(ui, /unsafeStorageReferences/);
  assert.match(ui, />Notifications</);
  assert.match(ui, /min-\[380px\]:flex-row/);
  assert.match(ui, /Inventaire Storage automatique en cours/);
  assert.doesNotMatch(ui, /Recopiez exactement l’e-mail du client/);
  assert.match(ui, /Le curseur est conservé/);
  assert.match(ui, /Auth supprimée — finalisation à reprendre/);
  assert.match(ui, /Admins conservés/);
  assert.match(ui, /CLIENT_PURGE_EXTERNAL_CHECKLIST/);
  assert.match(ui, /createClientPurgeCompletionMonitor/);
  assert.match(ui, /target\.email/);
  assert.doesNotMatch(ui, /sans répéter les étapes terminées/i);
});

test('le sweep différé est livré comme Scheduled Function versionnée sans secret dans les logs', async () => {
  const worker = await readFile(
    new URL('../netlify/functions/client-purge-sweep.ts', import.meta.url),
    'utf8',
  );
  const route = await readFile(
    new URL('../app/api/internal/client-purge-sweep/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(worker, /schedule: '\* \* \* \* \*'/);
  assert.match(worker, /\/api\/internal\/client-purge-sweep/);
  assert.match(worker, /x-client-purge-sweep-secret/);
  assert.match(
    worker,
    /CLIENT_PURGE_SCHEDULED_FUNCTION_TIMEOUT_MS = 25_000/,
  );
  assert.match(
    worker,
    /AbortSignal\.timeout\(CLIENT_PURGE_SCHEDULED_FUNCTION_TIMEOUT_MS\)/,
  );
  assert.match(route, /CLIENT_PURGE_SWEEP_BUDGET_MS = 20_000/);
  assert.match(route, /CLIENT_PURGE_SUPABASE_TIMEOUT_MS = 15_000/);
  assert.match(route, /CLIENT_PURGE_INVOCATION_TIMEOUT_MS = 18_000/);
  assert.match(
    route,
    /fetchTimeoutMs:\s*CLIENT_PURGE_SUPABASE_TIMEOUT_MS/,
  );
  assert.match(
    route,
    /requestTimeoutMs:\s*CLIENT_PURGE_INVOCATION_TIMEOUT_MS/,
  );
  assert.match(route, /requestSignal:\s*invocationSignal/);
  assert.match(route, /!invocationSignal\.aborted/);
  assert.match(route, /Date\.now\(\) \+ CLIENT_PURGE_SWEEP_BUDGET_MS/);
  assert.ok(20_000 < 25_000 && 25_000 < 30_000);
  assert.ok(15_000 < 18_000 && 18_000 < 20_000);
  assert.doesNotMatch(worker, /JSON\.stringify\([^)]*secret/);
});

test('la CI exécute le scénario destructif uniquement sur Supabase éphémère', async () => {
  const [workflow, integration, packageJson] = await Promise.all([
    readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
    readFile(
      new URL('../scripts/test-client-purge-integration.ts', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ]);
  const reset = workflow.indexOf('Reset database');
  const destructive = workflow.indexOf('Test guarded client purge end to end');
  const stop = workflow.indexOf('Stop Supabase');
  assert.ok(reset >= 0 && reset < destructive && destructive < stop);
  assert.match(workflow, /MONALYZ_ALLOW_DESTRUCTIVE_LOCAL_PURGE_TEST=1/);
  assert.match(workflow, /bun run test:client-purge:integration/);
  assert.match(integration, /assertDestructivePurgeRunsInGithubActions\(process\.env\)/);
  assert.match(integration, /REFUSING_NON_LOCAL_SUPABASE_PURGE_TEST/);
  assert.match(integration, /length: 2_001/);
  assert.match(integration, /TEST_STORAGE_REMOVE_SUCCEEDED_BEFORE_ACK/);
  assert.match(integration, /claim_token = :'claim_token'/);
  assert.match(integration, /createSignedUploadUrl/);
  assert.match(integration, /uploadToSignedUrl/);
  assert.match(integration, /lateSignedUploadSwept: true/);
  assert.match(integration, /auth\.admin\.deleteUser/);
  assert.match(integration, /Auth may succeed before the durable auth-to-verify transition/);
  assert.match(integration, /PURGE_MUTATION_DEADLOCK_TIMEOUT/);
  assert.match(integration, /mutationRaceResult\.status/);
  assert.match(integration, /crossTenantPreserved: true/);
  assert.match(integration, /authOrphanCovered: true/);
  assert.match(packageJson, /"test:client-purge:integration"/);
});

test('les émissions et finalisations de téléversement refusent un profil gelé ou absent', async () => {
  const [intents, evidence, guard] = await Promise.all([
    readFile(new URL('../app/api/upload-intents/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/evidence/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/server/profile-access.ts', import.meta.url), 'utf8'),
  ]);
  assert.ok((intents.match(/hasActiveProfile\(worker, user\.id\)/g) ?? []).length >= 2);
  assert.ok((evidence.match(/hasActiveProfile\(worker, user\.id\)/g) ?? []).length >= 2);
  assert.match(guard, /data\?\.access_status === 'active'/);
});
