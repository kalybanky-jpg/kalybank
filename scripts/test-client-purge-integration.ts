import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { storageChunks } from '../lib/client-purge';
import {
  digest,
  executePurge,
  pendingPurges,
  preparePurge,
  purgeStatus,
  recoverPurgePreview,
  type ActiveAdmin,
  type ClientPurgeState,
} from '../lib/server/client-purge';
import type { Database } from '../lib/supabase/database.types';
import { assertDestructivePurgeRunsInGithubActions } from './client-purge-integration-guard';

const LOCAL_API_PORT = '54321';
const DATABASE_CONTAINER = 'supabase_db_KALY';
const TEST_PASSWORD = 'CI-Purge-Only!2026-aA7';
type Worker = SupabaseClient<Database>;
type UntypedRpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
};
type ClaimedDeleteWork = {
  kind: 'delete';
  claimToken: string;
  items: Array<{
    bucket: 'upload-staging' | 'kyc-evidence' | 'loan-evidence' | 'official-documents';
    objectPath: string;
    ownershipScope: 'target_prefix' | 'relational';
  }>;
};

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function guardedLocalConfiguration() {
  assertDestructivePurgeRunsInGithubActions(process.env);
  const rawUrl =
    process.env.SUPABASE_URL?.trim() || process.env.API_URL?.trim() || '';
  const url = new URL(rawUrl);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== LOCAL_API_PORT ||
    url.username ||
    url.password ||
    url.pathname !== '/'
  ) {
    throw new Error('REFUSING_NON_LOCAL_SUPABASE_PURGE_TEST');
  }
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SERVICE_ROLE_KEY?.trim() ||
    '';
  if (!serviceKey) throw new Error('LOCAL_SERVICE_ROLE_KEY_MISSING');
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() ?? '';
  if (!anonKey) throw new Error('LOCAL_ANON_KEY_MISSING');
  requiredEnvironment('CLIENT_PURGE_CHALLENGE_SECRET');
  return { url: url.origin, serviceKey, anonKey };
}

function localDatabaseContainer() {
  const container = spawnSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  );
  const databaseContainer = container.stdout
    .split(/\r?\n/)
    .map((name) => name.trim())
    .find((name) => name.toLowerCase() === DATABASE_CONTAINER.toLowerCase());
  if (container.status !== 0 || !databaseContainer) {
    throw new Error('LOCAL_SUPABASE_DATABASE_CONTAINER_NOT_FOUND');
  }
  return databaseContainer;
}

function dockerPsql(sql: string, variables: Record<string, string> = {}) {
  for (const value of Object.values(variables)) {
    if (!/^[0-9a-f-]{36}$/i.test(value)) {
      throw new Error('UNSAFE_PSQL_TEST_VARIABLE');
    }
  }
  const databaseContainer = localDatabaseContainer();
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      databaseContainer,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      ...Object.entries(variables).flatMap(([key, value]) => [
        '--set',
        `${key}=${value}`,
      ]),
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-tA',
    ],
    { encoding: 'utf8', input: sql },
  );
  if (result.status !== 0) {
    throw new Error(`LOCAL_PSQL_FAILED: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function holdSharedOwnerLock(targetUserId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) {
    throw new Error('UNSAFE_SHARED_LOCK_TARGET');
  }
  const child = spawn(
    'docker',
    [
      'exec', '-i', localDatabaseContainer(), 'psql', '-X',
      '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-tA',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  let readyResolved = false;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
    if (!readyResolved && stdout.includes('BARRIER_READY')) {
      readyResolved = true;
      resolveReady();
    }
  });
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });
  const done = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      if (!readyResolved) rejectReady(new Error(`LOCK_BARRIER_FAILED: ${stderr}`));
      if (code === 0) resolve();
      else reject(new Error(`LOCK_BARRIER_FAILED(${code}): ${stderr}`));
    });
  });
  child.stdin.end(
    `begin;\nselect pg_advisory_xact_lock_shared(private.client_purge_lock_key('${targetUserId}'::uuid));\n\\echo BARRIER_READY\nselect pg_sleep(2);\ncommit;\n`,
  );
  return { ready, done };
}

function timeTravelPurge(targetUserId: string) {
  dockerPsql(
    `update private.client_purge_operations
       set sweep_not_before = clock_timestamp() - interval '1 second',
           retry_after = clock_timestamp() - interval '1 second'
     where target_user_id = :'target_id'::uuid;`,
    { target_id: targetUserId },
  );
}

function expirePurgeLease(targetUserId: string) {
  dockerPsql(
    `update private.client_purge_operations
       set retry_after = clock_timestamp() - interval '1 second'
     where target_user_id = :'target_id'::uuid;`,
    { target_id: targetUserId },
  );
}

async function createAuthUser(
  worker: Worker,
  email: string,
) {
  const { data, error } = await worker.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: email.split('@')[0],
      base_currency: 'EUR',
      preferred_language: 'fr',
    },
  });
  if (error || !data.user) {
    throw new Error(`AUTH_FIXTURE_CREATE_FAILED: ${error?.message ?? 'no user'}`);
  }
  return data.user;
}

async function uploadMany(
  worker: Worker,
  bucket: string,
  paths: string[],
) {
  let cursor = 0;
  const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  await Promise.all(
    Array.from({ length: 25 }, async () => {
      while (cursor < paths.length) {
        const path = paths[cursor++];
        const { error } = await worker.storage.from(bucket).upload(path, content, {
          contentType: 'application/pdf',
          upsert: false,
        });
        if (error) throw new Error(`STORAGE_FIXTURE_UPLOAD_FAILED: ${error.message}`);
      }
    }),
  );
}

function seedRichClient(ownerId: string) {
  const kycId = randomUUID();
  const kycIdempotencyKey = randomUUID();
  const accountId = randomUUID();
  const loanId = randomUUID();
  const loanIdempotencyKey = randomUUID();
  const transcriptId = randomUUID();
  const outboxSeed = randomUUID();
  const pushSeed = randomUUID();
  const transcriptEventSeed = randomUUID();
  const transcriptChatSeed = randomUUID();
  const transcriptHashSeed = randomUUID();
  const ledgerSeed = randomUUID();
  dockerPsql(
    `begin;
     insert into public.kyc_drafts(
       owner_id, current_step, payload, document_object_paths, preferred_language
     ) values (
       :'owner_id'::uuid, 2, '{"integration":true}'::jsonb,
       jsonb_build_object('id_front', :'owner_id' || '/draft-proof.pdf'), 'fr'
     );
     insert into public.kyc_applications(
       id, owner_id, idempotency_key, first_name, last_name, date_of_birth,
       place_of_birth, nationality, address, occupation, income_range, fatca,
       pep, document_object_paths
     ) values (
       :'kyc_id'::uuid, :'owner_id'::uuid, :'kyc_key'::uuid,
       'Integration', 'Purge', '1990-01-01', 'Paris', 'FR', '{}'::jsonb,
       'Test', 'Test', false, false,
       jsonb_build_object('id_back', :'owner_id' || '/kyc-proof.pdf')
     );
     insert into public.financial_positions(id, owner_id, label, currency, amount_minor)
     values (:'account_id'::uuid, :'owner_id'::uuid, 'Integration account', 'EUR', 1000);
     insert into public.loan_applications(
       id, owner_id, idempotency_key, reference, requested_amount_minor,
       currency, duration_months, motive, motive_code, document_object_paths
     ) values (
       :'loan_id'::uuid, :'owner_id'::uuid, :'loan_key'::uuid,
       'PURGE-' || :'loan_key', 10000, 'EUR', 12, 'Personal', 'personal',
       jsonb_build_array(:'owner_id' || '/loan-proof.pdf')
     );
     insert into public.notifications(
       recipient_id, title, message, message_key, notification_type
     ) values (
       :'owner_id'::uuid, 'Integration', 'Purge this notification',
       'integration.client_purge', 'info'
     );
     insert into public.transactional_email_outbox(
       event_key, recipient_id, recipient_email, template_key, entity_type,
       entity_id, payload
     ) select
       'purge-' || :'outbox_seed', :'owner_id'::uuid, profile.email,
       'loan_submitted', 'loan', :'loan_id'::uuid, '{}'::jsonb
     from public.profiles profile where profile.user_id = :'owner_id'::uuid;
     insert into public.push_subscriptions(
       user_id, endpoint, endpoint_hash, p256dh, auth_key
     ) values (
       :'owner_id'::uuid, 'https://push.monalyz.test/' || :'push_seed',
       encode(extensions.digest(convert_to(:'push_seed', 'UTF8'), 'sha256'), 'hex'),
       repeat('A', 40), repeat('B', 10)
     );
     insert into public.audit_events(actor_id, action, entity_type, entity_id, metadata)
     select :'owner_id'::uuid, 'integration_purge', 'kyc', :'kyc_id'::uuid,
       jsonb_build_object('email', profile.email)
     from public.profiles profile where profile.user_id = :'owner_id'::uuid;
     insert into public.support_transcripts(
       id, user_id, tawk_event_id, tawk_property_id, tawk_chat_id,
       identity_status, event_at, payload, raw_body, raw_body_sha256
     ) values (
       :'transcript_id'::uuid, :'owner_id'::uuid,
       'purge-' || :'transcript_event_seed', 'integration-property',
       'chat-' || :'transcript_chat_seed', 'resolved', statement_timestamp(),
       '{}'::jsonb, '{}',
       encode(extensions.digest(
         convert_to(:'transcript_hash_seed', 'UTF8'), 'sha256'
       ), 'hex')
     );
     insert into public.financial_ledger_entries(
       account_id, owner_id, sequence_no, entry_key, entry_kind, amount_minor,
       currency, balance_before_minor, balance_after_minor, value_date, description
     ) values (
       :'account_id'::uuid, :'owner_id'::uuid, 1, 'purge-' || :'ledger_seed',
       'account_opening', 1000, 'EUR', 0, 1000, statement_timestamp(),
       'Integration opening balance'
     );
     commit;`,
    {
      owner_id: ownerId,
      kyc_id: kycId,
      kyc_key: kycIdempotencyKey,
      account_id: accountId,
      loan_id: loanId,
      loan_key: loanIdempotencyKey,
      outbox_seed: outboxSeed,
      push_seed: pushSeed,
      transcript_id: transcriptId,
      transcript_event_seed: transcriptEventSeed,
      transcript_chat_seed: transcriptChatSeed,
      transcript_hash_seed: transcriptHashSeed,
      ledger_seed: ledgerSeed,
    },
  );
  return { loanId, transcriptId };
}

async function assertAuthMissing(
  worker: Worker,
  userId: string,
) {
  const result = await worker.auth.admin.getUserById(userId);
  assert.equal(result.data.user, null);
  assert.ok(
    !result.error || result.error.status === 404 || result.error.code === 'user_not_found',
  );
}

async function resumeState(
  admin: ActiveAdmin,
  targetUserId: string,
  email: string,
) {
  const { data, error } = await admin.worker.rpc('admin_resume_client_purge', {
    p_actor_id: admin.user.id,
    p_target_user_id: targetUserId,
    p_target_email_digest: digest(email),
  });
  if (error || !data) throw new Error(`RESUME_FAILED: ${error?.message}`);
  return data as unknown as ClientPurgeState;
}

async function mark(
  admin: ActiveAdmin,
  challengeId: string,
  stage: 'storage' | 'database' | 'waiting_sweep' | 'storage_sweep' | 'auth' | 'verify',
  errorCode: string | null,
) {
  const { error } = await admin.worker.rpc('admin_mark_client_purge_stage', {
    p_actor_id: admin.user.id,
    p_challenge_id: challengeId,
    p_stage: stage,
    ...(errorCode === null ? {} : { p_error_code: errorCode }),
  });
  if (error) throw new Error(`MARK_${stage.toUpperCase()}_FAILED: ${error.message}`);
}

async function completePreview(
  admin: ActiveAdmin,
  targetUserId: string,
  idempotencyKey: string,
) {
  for (let batch = 0; batch < 500; batch += 1) {
    const preview = await preparePurge(admin, targetUserId, idempotencyKey);
    if (!preview.pending) return preview;
  }
  throw new Error('PREVIEW_BATCH_LIMIT_EXCEEDED');
}

type PurgeOutcome = Awaited<ReturnType<typeof executePurge>>;

async function continueUntil(
  admin: ActiveAdmin,
  targetUserId: string,
  challengeId: string,
  first: PurgeOutcome,
  stop: (outcome: PurgeOutcome) => boolean,
) {
  let outcome = first;
  for (let batch = 0; batch < 2_000; batch += 1) {
    if (stop(outcome) || outcome.deleted || outcome.status === 'waiting_sweep') {
      return outcome;
    }
    outcome = await executePurge({
      admin,
      targetUserId,
      challengeId,
      startState: {
        status: 'running',
        stage: outcome.stage,
        sweepNotBefore: null,
      },
      leaseAlreadyAcquired: true,
    });
  }
  throw new Error('PURGE_BATCH_LIMIT_EXCEEDED');
}

async function main() {
  const configuration = guardedLocalConfiguration();
  const worker = createClient<Database>(configuration.url, configuration.serviceKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const adminUser = await createAuthUser(worker, `purge-admin-${suffix}@example.test`);
  // staff_members intentionally has no direct service-role INSERT privilege.
  // Seed the admin only through the ephemeral CI database superuser instead of
  // weakening the production ACL for a test fixture.
  dockerPsql(
    `insert into public.staff_members(user_id, role, active)
     values (:'admin_id'::uuid, 'admin', true);`,
    { admin_id: adminUser.id },
  );
  const admin: ActiveAdmin = {
    user: { id: adminUser.id },
    email: adminUser.email!,
    worker,
  };

  const richEmail = `purge-rich-${suffix}@example.test`;
  const rich = await createAuthUser(worker, richEmail);
  const foreign = await createAuthUser(worker, `purge-foreign-${suffix}@example.test`);
  const richFixture = seedRichClient(rich.id);
  const ownObjects = Array.from(
    { length: 2_001 },
    (_, index) => `${rich.id}/bulk/${String(index).padStart(4, '0')}.pdf`,
  );
  const foreignObject = `${foreign.id}/cross-tenant.pdf`;
  await uploadMany(worker, 'kyc-evidence', [...ownObjects, foreignObject]);
  const lateSignedObject = `${rich.id}/late-signed-upload.pdf`;
  const { data: lateSignedUpload, error: lateSignedUploadError } = await worker.storage
    .from('kyc-evidence')
    .createSignedUploadUrl(lateSignedObject);
  if (lateSignedUploadError || !lateSignedUpload?.token) {
    throw new Error(
      `SIGNED_UPLOAD_FIXTURE_FAILED: ${lateSignedUploadError?.message ?? 'no token'}`,
    );
  }
  dockerPsql(
    `begin;
     alter table public.kyc_drafts disable trigger kyc_drafts_enforce_document_path_owner;
     update public.kyc_drafts
       set document_object_paths = jsonb_build_object('foreign', :'foreign_id' || '/cross-tenant.pdf')
       where owner_id = :'target_id'::uuid;
     alter table public.kyc_drafts enable trigger kyc_drafts_enforce_document_path_owner;
     commit;`,
    { target_id: rich.id, foreign_id: foreign.id },
  );

  const idempotencyKey = randomUUID();
  const firstPreviewBatch = await preparePurge(admin, rich.id, idempotencyKey);
  assert.equal(firstPreviewBatch.pending, true);
  const recoveredPreview = await recoverPurgePreview(admin, rich.id);
  assert.equal(recoveredPreview.challengeId, firstPreviewBatch.challengeId);
  assert.equal(recoveredPreview.idempotencyKey, idempotencyKey);
  let preview = await completePreview(admin, rich.id, idempotencyKey);
  assert.equal(preview.challengeId, firstPreviewBatch.challengeId);
  const retriedPreview = await preparePurge(admin, rich.id, idempotencyKey);
  assert.equal(retriedPreview.challengeId, preview.challengeId);
  assert.equal(retriedPreview.challengeToken, preview.challengeToken);
  assert.equal(preview.impact.unsafeStorageReferences, 1);
  assert.ok(preview.impact.storageObjects >= 2_001);

  dockerPsql(
    `update public.support_transcripts
       set user_id = :'foreign_id'::uuid
     where id = :'transcript_id'::uuid;`,
    { foreign_id: foreign.id, transcript_id: richFixture.transcriptId },
  );
  await assert.rejects(
    executePurge({
      admin,
      targetUserId: rich.id,
      challengeId: preview.challengeId,
      challengeDigest: digest(preview.challengeToken),
      emailDigest: digest(richEmail),
      idempotencyKey,
    }),
    /PURGE_PREVIEW_STALE/,
  );
  const staleChallengeId = preview.challengeId;
  preview = await completePreview(admin, rich.id, idempotencyKey);
  assert.equal(preview.challengeId, staleChallengeId);
  assert.equal(preview.pending, false);

  let richOutcome = await executePurge({
    admin,
    targetUserId: rich.id,
    challengeId: preview.challengeId,
    challengeDigest: digest(preview.challengeToken),
    emailDigest: digest(richEmail),
    idempotencyKey,
  });
  for (let batch = 0; batch < 2_000; batch += 1) {
    const state = await purgeStatus(admin, rich.id);
    if (state?.storagePhase === 'delete') break;
    assert.ok(state, 'the durable purge operation must remain visible');
    if (richOutcome.deleted) {
      throw new Error('PURGE_COMPLETED_BEFORE_STORAGE_DELETE_PHASE');
    }
    richOutcome = await executePurge({
      admin,
      targetUserId: rich.id,
      challengeId: preview.challengeId,
      startState: {
        status: 'running',
        stage: richOutcome.stage,
        sweepNotBefore: null,
      },
      leaseAlreadyAcquired: true,
    });
    if (batch === 1_999) throw new Error('DELETE_PHASE_BATCH_LIMIT_EXCEEDED');
  }

  const untypedWorker = worker as unknown as UntypedRpcClient;
  const deleteClaimResult = await untypedWorker.rpc(
    'admin_claim_client_purge_storage_work',
    {
      p_actor_id: admin.user.id,
      p_target_user_id: rich.id,
      p_challenge_id: preview.challengeId,
      p_limit: 1_000,
    },
  );
  if (deleteClaimResult.error) throw deleteClaimResult.error;
  const deleteClaim = deleteClaimResult.data as ClaimedDeleteWork;
  assert.equal(deleteClaim.kind, 'delete');
  assert.equal(deleteClaim.items.length, 1_000);
  const claimedPaths = new Map<string, string[]>();
  for (const entry of deleteClaim.items) {
    assert.ok(
      entry.objectPath === rich.id || entry.objectPath.startsWith(`${rich.id}/`),
      'a target-prefix delete claim cannot escape the target namespace',
    );
    const paths = claimedPaths.get(entry.bucket) ?? [];
    paths.push(entry.objectPath);
    claimedPaths.set(entry.bucket, paths);
  }
  for (const [bucket, paths] of claimedPaths) {
    for (const chunk of storageChunks(paths)) {
      const { error } = await worker.storage.from(bucket).remove(chunk);
      if (error) throw new Error(`UNACKED_STORAGE_REMOVE_FAILED: ${error.message}`);
    }
  }
  assert.equal(
    Number(dockerPsql(
      `select count(*) from private.client_purge_storage_manifest manifest
       where manifest.challenge_id = :'challenge_id'::uuid
         and manifest.claim_token = :'claim_token'::uuid
         and manifest.processing_status = 'delete_claimed';`,
      {
        challenge_id: preview.challengeId,
        claim_token: deleteClaim.claimToken,
      },
    )),
    1_000,
    'external deletion must be observable before its durable ACK',
  );
  await mark(
    admin,
    preview.challengeId,
    'storage',
    'TEST_STORAGE_REMOVE_SUCCEEDED_BEFORE_ACK',
  );
  dockerPsql(
    `update private.client_purge_storage_manifest
       set claimed_at = clock_timestamp() - interval '6 minutes'
     where challenge_id = :'challenge_id'::uuid
       and claim_token = :'claim_token'::uuid;
     update private.client_purge_operations
       set retry_after = clock_timestamp() - interval '1 second'
     where challenge_id = :'challenge_id'::uuid;`,
    {
      challenge_id: preview.challengeId,
      claim_token: deleteClaim.claimToken,
    },
  );
  const resumedUnackedStorage = await resumeState(admin, rich.id, richEmail);
  richOutcome = await executePurge({
    admin,
    targetUserId: rich.id,
    challengeId: preview.challengeId,
    startState: resumedUnackedStorage,
    leaseAlreadyAcquired: true,
  });
  assert.equal('workKind' in richOutcome && richOutcome.workKind, 'delete');
  const firstDeletedCount = Number(dockerPsql(
    `select count(*) from private.client_purge_storage_manifest manifest
     join private.client_purge_operations operation using (challenge_id)
     where operation.target_user_id = :'target_id'::uuid
       and manifest.processing_status = 'deleted';`,
    { target_id: rich.id },
  ));
  assert.equal(firstDeletedCount, 1_000);
  const firstDeletedFingerprint = dockerPsql(
    `select manifest.bucket || '|' || manifest.object_path || '|' || manifest.deleted_at::text
     from private.client_purge_storage_manifest manifest
     join private.client_purge_operations operation using (challenge_id)
     where operation.target_user_id = :'target_id'::uuid
       and manifest.processing_status = 'deleted'
     order by manifest.bucket, manifest.object_path limit 1;`,
    { target_id: rich.id },
  );
  await mark(admin, preview.challengeId, 'storage', 'TEST_AFTER_PAGE_ONE');
  expirePurgeLease(rich.id);
  const resumedStorage = await resumeState(admin, rich.id, richEmail);
  const secondStoragePage = await executePurge({
    admin,
    targetUserId: rich.id,
    challengeId: preview.challengeId,
    startState: resumedStorage,
    leaseAlreadyAcquired: true,
  });
  assert.equal('workKind' in secondStoragePage && secondStoragePage.workKind, 'delete');
  const secondDeletedCount = Number(dockerPsql(
    `select count(*) from private.client_purge_storage_manifest manifest
     join private.client_purge_operations operation using (challenge_id)
     where operation.target_user_id = :'target_id'::uuid
       and manifest.processing_status = 'deleted';`,
    { target_id: rich.id },
  ));
  assert.equal(secondDeletedCount, 2_000);
  assert.equal(
    dockerPsql(
      `select manifest.bucket || '|' || manifest.object_path || '|' || manifest.deleted_at::text
       from private.client_purge_storage_manifest manifest
       join private.client_purge_operations operation using (challenge_id)
       where operation.target_user_id = :'target_id'::uuid
         and manifest.processing_status = 'deleted'
       order by manifest.bucket, manifest.object_path limit 1;`,
      { target_id: rich.id },
    ),
    firstDeletedFingerprint,
  );
  richOutcome = await continueUntil(
    admin,
    rich.id,
    preview.challengeId,
    secondStoragePage,
    (outcome) => !outcome.deleted && outcome.stage === 'database',
  );
  await mark(admin, preview.challengeId, 'database', 'TEST_DATABASE_INTERRUPTION');
  expirePurgeLease(rich.id);
  const resumedDatabase = await resumeState(admin, rich.id, richEmail);
  richOutcome = await executePurge({
    admin,
    targetUserId: rich.id,
    challengeId: preview.challengeId,
    startState: resumedDatabase,
    leaseAlreadyAcquired: true,
  });
  assert.equal(richOutcome.status, 'processing');
  assert.equal(!richOutcome.deleted && richOutcome.stage, 'auth');
  assert.equal(richOutcome.ignoredUnsafeStorageReferences, 1);
  const persistedManifestSize = Number(
    dockerPsql(
      `select count(*)
       from private.client_purge_storage_manifest manifest
       join private.client_purge_operations operation
         on operation.challenge_id = manifest.challenge_id
       where operation.target_user_id = :'target_id'::uuid;`,
      { target_id: rich.id },
    ),
  );
  assert.ok(persistedManifestSize >= 2_001);
  assert.ok(
    new Date(richOutcome.sweepNotBefore!).getTime() - Date.now() >=
      2 * 60 * 60 * 1_000 + 4 * 60 * 1_000,
  );
  for (const [label, userId] of [
    ['staff/self', admin.user.id],
    ['unrelated client', foreign.id],
  ] as const) {
    const forbiddenDelete = await worker.auth.admin.deleteUser(userId, false);
    assert.ok(
      forbiddenDelete.error,
      `${label} Auth deletion must be rejected outside a ready purge operation`,
    );
    // GoTrue intentionally does not preserve the PostgreSQL trigger symbol and
    // can expose only `{}` here. pgTAP verifies the exact SQLSTATE/message;
    // this API-level assertion proves the attempted side effect did not occur.
    const retainedUser = await worker.auth.admin.getUserById(userId);
    assert.equal(
      retainedUser.error,
      null,
      `${label} must remain readable after the rejected Auth deletion`,
    );
    assert.equal(
      retainedUser.data.user?.id,
      userId,
      `${label} must remain the exact same Auth user after rejection`,
    );
  }
  assert.throws(
    () => dockerPsql(
      `insert into public.staff_members(user_id, role, active)
       values (:'target_id'::uuid, 'admin', true);`,
      { target_id: rich.id },
    ),
    /PURGE_TARGET_PROMOTION_FORBIDDEN/,
    'the database guard, not an ACL denial, rejects staff promotion during purge',
  );

  const authReady = await untypedWorker.rpc(
    'admin_assert_client_purge_auth_ready',
    {
      p_actor_id: admin.user.id,
      p_target_user_id: rich.id,
      p_challenge_id: preview.challengeId,
    },
  );
  if (authReady.error) throw authReady.error;
  const directAuthDelete = await worker.auth.admin.deleteUser(rich.id, false);
  if (directAuthDelete.error) {
    throw new Error(`DIRECT_AUTH_DELETE_FAILED: ${directAuthDelete.error.message}`);
  }
  assert.equal(
    dockerPsql(
      `select stage || ':' || status
       from private.client_purge_operations
       where challenge_id = :'challenge_id'::uuid;`,
      { challenge_id: preview.challengeId },
    ),
    'auth:running',
    'Auth may succeed before the durable auth-to-waiting transition',
  );
  await assertAuthMissing(worker, rich.id);

  // Resume the interrupted auth stage. The old identity is already gone, so
  // executePurge must not call deleteUser a second time and must durably enter
  // the residual waiting phase.
  richOutcome = await executePurge({
    admin,
    targetUserId: rich.id,
    challengeId: preview.challengeId,
    startState: {
      status: 'running',
      stage: 'auth',
      sweepNotBefore: richOutcome.sweepNotBefore,
    },
    leaseAlreadyAcquired: true,
  });
  assert.equal(richOutcome.status, 'waiting_sweep');
  assert.equal(!richOutcome.deleted && richOutcome.stage, 'waiting_sweep');
  assert.equal(richOutcome.authDeleted, true);
  assert.ok(
    new Date(richOutcome.sweepNotBefore!).getTime() - Date.now() >=
      2 * 60 * 60 * 1_000 + 4 * 60 * 1_000,
  );

  // Reusing the same e-mail is the central test-mode contract. The replacement
  // receives a different UUID and must stay outside the old purge namespace.
  const replacement = await createAuthUser(worker, richEmail);
  assert.notEqual(replacement.id, rich.id);
  const replacementObject = `${replacement.id}/replacement-proof.pdf`;
  await uploadMany(worker, 'kyc-evidence', [replacementObject]);
  const replacementClient = createClient<Database>(
    configuration.url,
    configuration.anonKey,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const replacementSession = await replacementClient.auth.signInWithPassword({
    email: richEmail,
    password: TEST_PASSWORD,
  });
  assert.equal(replacementSession.error, null);
  assert.equal(replacementSession.data.user?.id, replacement.id);

  const { error: lateUploadError } = await worker.storage
    .from('kyc-evidence')
    .uploadToSignedUrl(
      lateSignedObject,
      lateSignedUpload.token,
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x6c, 0x61, 0x74, 0x65]),
      { contentType: 'application/pdf' },
    );
  if (lateUploadError) {
    throw new Error(`LATE_SIGNED_UPLOAD_FAILED: ${lateUploadError.message}`);
  }
  const { error: lateDownloadBeforeSweepError } = await worker.storage
    .from('kyc-evidence')
    .download(lateSignedObject);
  assert.equal(lateDownloadBeforeSweepError, null);

  const { data: postAuthRows, error: postAuthRowsError } = await worker.rpc(
    'admin_list_client_purge_candidates',
    {
      p_actor_id: admin.user.id,
      p_search: richEmail,
      p_limit: 10,
      p_offset: 0,
    },
  );
  if (postAuthRowsError) throw postAuthRowsError;
  assert.ok(
    postAuthRows?.some(
      (row) => row.user_id === rich.id && row.access_status === 'auth_deleted',
    ),
  );
  assert.ok(
    postAuthRows?.some(
      (row) => row.user_id === replacement.id && row.access_status === 'active',
    ),
  );

  timeTravelPurge(rich.id);
  const [richPending] = await pendingPurges(worker);
  assert.equal(richPending.target_user_id, rich.id);
  const sweepAdmin = { ...admin, user: { id: richPending.actor_id } };
  let richFinal = await executePurge({
    admin: sweepAdmin,
    targetUserId: rich.id,
    challengeId: richPending.challenge_id,
    startState: { status: 'running', stage: richPending.stage, sweepNotBefore: null },
    leaseAlreadyAcquired: true,
  });
  await mark(sweepAdmin, preview.challengeId, 'storage_sweep', 'TEST_SWEEP_INTERRUPTION');
  expirePurgeLease(rich.id);
  const resumedSweep = await resumeState(sweepAdmin, rich.id, richEmail);
  richFinal = await executePurge({
    admin: sweepAdmin,
    targetUserId: rich.id,
    challengeId: preview.challengeId,
    startState: resumedSweep,
    leaseAlreadyAcquired: true,
  });
  richFinal = await continueUntil(
    sweepAdmin,
    rich.id,
    preview.challengeId,
    richFinal,
    (outcome) => !outcome.deleted && outcome.stage === 'verify',
  );
  await mark(sweepAdmin, preview.challengeId, 'verify', 'TEST_VERIFY_INTERRUPTION');
  expirePurgeLease(rich.id);
  const resumedVerify = await resumeState(sweepAdmin, rich.id, richEmail);
  richFinal = await executePurge({
    admin: sweepAdmin,
    targetUserId: rich.id,
    challengeId: preview.challengeId,
    startState: resumedVerify,
    leaseAlreadyAcquired: true,
  });
  richFinal = await continueUntil(
    sweepAdmin,
    rich.id,
    preview.challengeId,
    richFinal,
    () => false,
  );
  assert.equal(richFinal.deleted, true);
  assert.equal(await purgeStatus(admin, rich.id), null);
  const { data: foreignBytes, error: foreignDownloadError } = await worker.storage
    .from('kyc-evidence')
    .download(foreignObject);
  assert.equal(foreignDownloadError, null);
  assert.ok(foreignBytes);
  const { data: richPrefix, error: richPrefixError } = await worker.storage
    .from('kyc-evidence')
    .list(rich.id, { limit: 1_000 });
  assert.equal(richPrefixError, null);
  assert.deepEqual(richPrefix, []);
  const { error: lateDownloadAfterSweepError } = await worker.storage
    .from('kyc-evidence')
    .download(lateSignedObject);
  assert.ok(lateDownloadAfterSweepError);
  const replacementAuth = await worker.auth.admin.getUserById(replacement.id);
  assert.equal(replacementAuth.error, null);
  assert.equal(replacementAuth.data.user?.email, richEmail);
  assert.equal(
    dockerPsql(
      `select access_status from public.profiles where user_id = :'target_id'::uuid;`,
      { target_id: replacement.id },
    ),
    'active',
  );
  const { error: replacementDownloadError } = await worker.storage
    .from('kyc-evidence')
    .download(replacementObject);
  assert.equal(replacementDownloadError, null);
  await replacementClient.auth.signOut({ scope: 'local' });
  const purgedRelationCounts = JSON.parse(
    dockerPsql(
      `select jsonb_build_object(
         'profiles', (select count(*) from public.profiles where user_id = :'owner_id'::uuid),
         'kyc_drafts', (select count(*) from public.kyc_drafts where owner_id = :'owner_id'::uuid),
         'kyc_applications', (select count(*) from public.kyc_applications where owner_id = :'owner_id'::uuid),
         'financial_positions', (select count(*) from public.financial_positions where owner_id = :'owner_id'::uuid),
         'financial_ledger_entries', (select count(*) from public.financial_ledger_entries where owner_id = :'owner_id'::uuid),
         'loan_applications', (select count(*) from public.loan_applications where owner_id = :'owner_id'::uuid),
         'notifications', (select count(*) from public.notifications where recipient_id = :'owner_id'::uuid),
         'transactional_email_outbox', (select count(*) from public.transactional_email_outbox where recipient_id = :'owner_id'::uuid),
         'push_subscriptions', (select count(*) from public.push_subscriptions where user_id = :'owner_id'::uuid),
         'support_transcripts', (select count(*) from public.support_transcripts where user_id = :'owner_id'::uuid),
         'support_user_identities', (select count(*) from public.support_user_identities where user_id = :'owner_id'::uuid),
         'audit_events', (select count(*) from public.audit_events where actor_id = :'owner_id'::uuid)
       )::text;`,
      { owner_id: rich.id },
    ),
  ) as Record<string, number>;
  for (const [relation, count] of Object.entries(purgedRelationCounts)) {
    assert.equal(count, 0, `${relation} must be empty`);
  }
  assert.equal(
    dockerPsql(
      `select user_id::text from public.support_transcripts
       where id = :'transcript_id'::uuid;`,
      { transcript_id: richFixture.transcriptId },
    ),
    foreign.id,
  );

  const orphanEmail = `purge-orphan-${suffix}@example.test`;
  const orphan = await createAuthUser(worker, orphanEmail);
  dockerPsql(
    `delete from public.profiles where user_id = :'orphan_id'::uuid;`,
    { orphan_id: orphan.id },
  );
  const orphanKey = randomUUID();
  const orphanPreview = await completePreview(admin, orphan.id, orphanKey);
  assert.equal(orphanPreview.impact.profileRecords, 0);
  let orphanFirst = await executePurge({
    admin,
    targetUserId: orphan.id,
    challengeId: orphanPreview.challengeId,
    challengeDigest: digest(orphanPreview.challengeToken),
    emailDigest: digest(orphanEmail),
    idempotencyKey: orphanKey,
  });
  orphanFirst = await continueUntil(
    admin,
    orphan.id,
    orphanPreview.challengeId,
    orphanFirst,
    () => false,
  );
  assert.equal(orphanFirst.status, 'waiting_sweep');
  const orphanRetry = await executePurge({
    admin,
    targetUserId: orphan.id,
    challengeId: orphanPreview.challengeId,
    startState: {
      status: 'waiting_sweep',
      stage: 'waiting_sweep',
      sweepNotBefore: orphanFirst.sweepNotBefore,
    },
  });
  assert.equal(orphanRetry.status, 'waiting_sweep');
  timeTravelPurge(orphan.id);
  const [orphanPending] = await pendingPurges(worker);
  assert.equal(orphanPending.target_user_id, orphan.id);
  let orphanFinal = await executePurge({
    admin: { ...admin, user: { id: orphanPending.actor_id } },
    targetUserId: orphan.id,
    challengeId: orphanPending.challenge_id,
    startState: {
      status: 'running',
      stage: orphanPending.stage,
      sweepNotBefore: null,
    },
    leaseAlreadyAcquired: true,
  });
  orphanFinal = await continueUntil(
    admin,
    orphan.id,
    orphanPreview.challengeId,
    orphanFinal,
    () => false,
  );
  assert.equal(orphanFinal.deleted, true);
  await assertAuthMissing(worker, orphan.id);
  assert.equal(await purgeStatus(admin, orphan.id), null);

  const changedEmail = `purge-email-before-${suffix}@example.test`;
  const changedUser = await createAuthUser(worker, changedEmail);
  const changedKey = randomUUID();
  const changedPreview = await completePreview(admin, changedUser.id, changedKey);
  const changedAfterPreview = `purge-email-after-${suffix}@example.test`;
  const changedAuth = await worker.auth.admin.updateUserById(changedUser.id, {
    email: changedAfterPreview,
  });
  if (changedAuth.error) throw changedAuth.error;
  await assert.rejects(
    executePurge({
      admin,
      targetUserId: changedUser.id,
      challengeId: changedPreview.challengeId,
      challengeDigest: digest(changedPreview.challengeToken),
      emailDigest: digest(changedEmail),
      idempotencyKey: changedKey,
    }),
    /PURGE_TARGET_EMAIL_CHANGED/,
  );
  assert.equal(
    dockerPsql(
      `select status || ':' || coalesce((select access_status from public.profiles
        where user_id = :'target_id'::uuid), 'missing')
       from private.client_purge_operations
       where target_user_id = :'target_id'::uuid;`,
      { target_id: changedUser.id },
    ),
    'preview:active',
  );
  await assert.rejects(
    recoverPurgePreview(admin, changedUser.id),
    /PURGE_TARGET_EMAIL_CHANGED/,
  );
  assert.equal(
    Number(dockerPsql(
      `select count(*) from private.client_purge_operations
       where target_user_id = :'target_id'::uuid;`,
      { target_id: changedUser.id },
    )),
    0,
  );

  const raceEmail = `purge-race-${suffix}@example.test`;
  const raceUser = await createAuthUser(worker, raceEmail);
  const { loanId: raceLoanId } = seedRichClient(raceUser.id);
  dockerPsql(
    `update public.loan_applications set status = 'submitted'
     where id = :'loan_id'::uuid;`,
    { loan_id: raceLoanId },
  );
  const raceKey = randomUUID();
  const racePreview = await completePreview(admin, raceUser.id, raceKey);
  const branchClient = createClient<Database>(
    configuration.url,
    configuration.anonKey,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const branchSession = await branchClient.auth.signInWithPassword({
    email: admin.email,
    password: TEST_PASSWORD,
  });
  if (branchSession.error) throw branchSession.error;
  const barrier = holdSharedOwnerLock(raceUser.id);
  await barrier.ready;
  const purgeRacePromise = executePurge({
    admin,
    targetUserId: raceUser.id,
    challengeId: racePreview.challengeId,
    challengeDigest: digest(racePreview.challengeToken),
    emailDigest: digest(raceEmail),
    idempotencyKey: raceKey,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const branchRacePromise = (async () => {
    const result = await branchClient.rpc('branch_manager_approve_loan', {
        p_loan_id: raceLoanId,
        p_note: 'Concurrency barrier integration test',
      });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  })();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const concurrent = await Promise.race([
    Promise.allSettled([purgeRacePromise, branchRacePromise]),
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error('PURGE_MUTATION_DEADLOCK_TIMEOUT')),
        10_000,
      );
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
  await barrier.done;
  const purgeRaceResult = concurrent[0];
  const mutationRaceResult = concurrent[1];
  assert.equal(purgeRaceResult.status, 'fulfilled');
  assert.equal(
    mutationRaceResult.status,
    'rejected',
    'the queued loan mutation must be guarded after purge freezes its owner',
  );
  assert.match(
    String((mutationRaceResult as PromiseRejectedResult).reason),
    /PURGE_TARGET_(?:FROZEN|MUTATION_BUSY)/,
  );
  let raceOutcome = (purgeRaceResult as PromiseFulfilledResult<PurgeOutcome>).value;
  raceOutcome = await continueUntil(
    admin, raceUser.id, racePreview.challengeId, raceOutcome, () => false,
  );
  assert.equal(raceOutcome.status, 'waiting_sweep');
  timeTravelPurge(raceUser.id);
  const raceResume = await resumeState(admin, raceUser.id, raceEmail);
  raceOutcome = await executePurge({
    admin,
    targetUserId: raceUser.id,
    challengeId: racePreview.challengeId,
    startState: raceResume,
    leaseAlreadyAcquired: true,
  });
  raceOutcome = await continueUntil(
    admin, raceUser.id, racePreview.challengeId, raceOutcome, () => false,
  );
  assert.equal(raceOutcome.deleted, true);
  await assertAuthMissing(worker, raceUser.id);
  assert.equal(
    Number(dockerPsql(
      `select
        (select count(*) from public.loan_applications where owner_id = :'target_id'::uuid)
        + (select count(*) from public.audit_events
          where actor_id = :'target_id'::uuid or entity_id = :'loan_id'::uuid);`,
      { target_id: raceUser.id, loan_id: raceLoanId },
    )),
    0,
  );
  await branchClient.auth.signOut({ scope: 'local' });

  const annEmail = `ann-${suffix}@example.test`;
  const joannEmail = `joann-${suffix}@example.test`;
  const ann = await createAuthUser(worker, annEmail);
  const joann = await createAuthUser(worker, joannEmail);
  const joannAuditSeed = randomUUID();
  const annAuditSeed = randomUUID();
  dockerPsql(
    `insert into public.audit_events(
       actor_id, action, entity_type, entity_id, metadata
     ) select
       :'admin_id'::uuid, 'preserve_joann_' || :'joann_seed', 'integration',
       :'joann_entity_id'::uuid, jsonb_build_object('email', profile.email)
     from public.profiles profile where profile.user_id = :'joann_id'::uuid;
     insert into public.audit_events(
       actor_id, action, entity_type, entity_id, metadata
     ) select
       :'admin_id'::uuid, 'purge_ann_' || :'ann_seed', 'integration',
       :'ann_entity_id'::uuid, jsonb_build_object('email', profile.email)
     from public.profiles profile where profile.user_id = :'ann_id'::uuid;`,
    {
      admin_id: admin.user.id,
      joann_seed: joannAuditSeed,
      joann_entity_id: randomUUID(),
      joann_id: joann.id,
      ann_seed: annAuditSeed,
      ann_entity_id: randomUUID(),
      ann_id: ann.id,
    },
  );
  const annKey = randomUUID();
  const annPreview = await completePreview(admin, ann.id, annKey);
  let annOutcome = await executePurge({
    admin,
    targetUserId: ann.id,
    challengeId: annPreview.challengeId,
    challengeDigest: digest(annPreview.challengeToken),
    emailDigest: digest(annEmail),
    idempotencyKey: annKey,
  });
  annOutcome = await continueUntil(
    admin, ann.id, annPreview.challengeId, annOutcome, () => false,
  );
  assert.equal(annOutcome.status, 'waiting_sweep');
  timeTravelPurge(ann.id);
  const annState = await resumeState(admin, ann.id, annEmail);
  annOutcome = await executePurge({
    admin,
    targetUserId: ann.id,
    challengeId: annPreview.challengeId,
    startState: annState,
    leaseAlreadyAcquired: true,
  });
  annOutcome = await continueUntil(
    admin, ann.id, annPreview.challengeId, annOutcome, () => false,
  );
  assert.equal(annOutcome.deleted, true);
  assert.equal(
    dockerPsql(
      `select count(*)::text from public.audit_events
       where action = 'preserve_joann_' || :'joann_seed';`,
      { joann_seed: joannAuditSeed },
    ),
    '1',
  );
  assert.equal(
    dockerPsql(
      `select count(*)::text from public.audit_events
       where action = 'purge_ann_' || :'ann_seed';`,
      { ann_seed: annAuditSeed },
    ),
    '0',
  );

  console.info(
    JSON.stringify({
      event: 'client_purge_local_integration_passed',
      richStorageObjects: ownObjects.length,
      lateSignedUploadSwept: true,
      crossTenantPreserved: true,
      stalePreviewRebuilt: true,
      authOrphanCovered: true,
      changedEmailBlocked: true,
      exactAuditMatchingPreservedJoann: true,
      mutationRaceNoDeadlock: true,
      authDeletedBeforeWaitingSweep: true,
      emailReusedBeforeSweep: true,
      replacementPreserved: true,
      durableStoragePages: 3,
      resumedStages: ['storage', 'database', 'auth', 'waiting_sweep', 'storage_sweep', 'verify'],
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'UNKNOWN_INTEGRATION_FAILURE');
  process.exitCode = 1;
});
