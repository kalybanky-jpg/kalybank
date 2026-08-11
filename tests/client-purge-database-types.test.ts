import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Database } from '../lib/supabase/database.types';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type Assert<Condition extends true> = Condition;

type PurgeOperationRow =
  Database['private']['Tables']['client_purge_operations']['Row'];
type PurgeStorageManifestRow =
  Database['private']['Tables']['client_purge_storage_manifest']['Row'];
type PurgeStorageScanRow =
  Database['private']['Tables']['client_purge_storage_scan_queue']['Row'];
type PurgeEntityManifestRow =
  Database['private']['Tables']['client_purge_entity_manifest']['Row'];
type PurgeCandidate =
  Database['public']['Functions']['admin_list_client_purge_candidates']['Returns'][number];

const typeContract: {
  operation: Assert<
    Equal<
      keyof PurgeOperationRow,
      | 'actor_id'
      | 'challenge_digest'
      | 'challenge_id'
      | 'consumed_at'
      | 'created_at'
      | 'expires_at'
      | 'idempotency_key'
      | 'ignored_unsafe_storage_references'
      | 'last_error_code'
      | 'prefix_claim_token'
      | 'prefix_claimed_at'
      | 'reference_after_bucket'
      | 'reference_after_object_path'
      | 'reference_claim_token'
      | 'reference_claimed_at'
      | 'retry_after'
      | 'scope_digest'
      | 'stage'
      | 'status'
      | 'storage_cycle_stage'
      | 'storage_phase'
      | 'support_email_manifest'
      | 'sweep_not_before'
      | 'target_email'
      | 'target_email_digest'
      | 'target_user_id'
      | 'updated_at'
      | 'verify_prefix_index'
    >
  >;
  candidateCounts: Assert<
    Equal<
      Pick<
        PurgeCandidate,
        | 'account_count'
        | 'document_count'
        | 'loan_count'
        | 'total_count'
        | 'transfer_count'
      >,
      {
        account_count: number;
        document_count: number;
        loan_count: number;
        total_count: number;
        transfer_count: number;
      }
    >
  >;
  manifest: Assert<
    Equal<
      keyof PurgeStorageManifestRow,
      | 'bucket'
      | 'challenge_id'
      | 'claim_token'
      | 'claimed_at'
      | 'created_at'
      | 'deleted_at'
      | 'object_path'
      | 'ownership_scope'
      | 'processing_status'
      | 'verified_at'
    >
  >;
  scan: Assert<
    Equal<
      keyof PurgeStorageScanRow,
      | 'bucket'
      | 'challenge_id'
      | 'claim_token'
      | 'claimed_at'
      | 'created_at'
      | 'cycle_stage'
      | 'id'
      | 'next_offset'
      | 'prefix'
      | 'status'
      | 'updated_at'
    >
  >;
  entities: Assert<
    Equal<keyof PurgeEntityManifestRow, 'challenge_id' | 'entity_id' | 'entity_type'>
  >;
} = {
  operation: true,
  candidateCounts: true,
  manifest: true,
  scan: true,
  entities: true,
};

const publicPurgeFunctions = [
  'admin_ack_client_purge_storage_work',
  'admin_assert_client_purge_auth_ready',
  'admin_begin_client_purge',
  'admin_claim_client_purge_storage_work',
  'admin_finalize_client_purge',
  'admin_get_client_purge_preview',
  'admin_get_client_purge_status',
  'admin_list_client_purge_candidates',
  'admin_list_pending_client_purges',
  'admin_mark_client_purge_stage',
  'admin_prepare_client_purge',
  'admin_purge_client_relational_data',
  'admin_resume_client_purge',
] as const satisfies readonly (keyof Database['public']['Functions'])[];

const privatePurgeFunctions = [
  'audit_event_matches_client',
  'client_purge_lock_key',
  'client_purge_scope_digest',
  'client_purge_storage_lock_key',
  'client_purge_residuals',
  'client_purge_storage_references',
  'initialize_client_purge_storage_cycle',
  'is_client_storage_object_key',
  'is_client_storage_path',
  'lock_client_mutation',
  'new_document_paths_are_owned',
  'refresh_client_purge_entity_manifest',
  'require_active_purge_admin',
  'seed_client_purge_storage_roots',
  'try_guard_client_mutation',
  'uuid_or_null',
] as const satisfies readonly (keyof Database['private']['Functions'])[];

test('les types Supabase exposent toute la surface SQL de purge appelable', async () => {
  assert.deepEqual(typeContract, {
    operation: true,
    candidateCounts: true,
    manifest: true,
    scan: true,
    entities: true,
  });

  const [migration, generatedTypes] = await Promise.all([
    readFile(
      new URL(
        '../supabase/migrations/20260811070824_guarded_client_data_purge.sql',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(
      new URL('../lib/supabase/database.types.ts', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(migration, /create table private\.client_purge_operations\s*\(/i);
  assert.match(
    migration,
    /create table private\.client_purge_storage_manifest\s*\(/i,
  );
  assert.match(
    migration,
    /create table private\.client_purge_storage_scan_queue\s*\(/i,
  );
  assert.match(
    migration,
    /create table private\.client_purge_entity_manifest\s*\(/i,
  );
  assert.match(generatedTypes, /client_purge_operations:\s*\{/);
  assert.match(generatedTypes, /client_purge_storage_manifest:\s*\{/);
  assert.match(generatedTypes, /client_purge_storage_scan_queue:\s*\{/);
  assert.match(generatedTypes, /client_purge_entity_manifest:\s*\{/);

  for (const functionName of publicPurgeFunctions) {
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.${functionName}\\s*\\(`, 'i'),
    );
    assert.match(generatedTypes, new RegExp(`\\s${functionName}: \\{`));
  }

  for (const functionName of privatePurgeFunctions) {
    assert.match(
      migration,
      new RegExp(`create or replace function private\\.${functionName}\\s*\\(`, 'i'),
    );
    assert.match(generatedTypes, new RegExp(`\\s${functionName}: \\{`));
  }
  assert.doesNotMatch(generatedTypes, /\sadmin_store_client_purge_manifest: \{/);
  assert.doesNotMatch(generatedTypes, /\sadmin_client_purge_storage_paths: \{/);
  assert.match(migration, /drop function public\.admin_store_client_purge_manifest/);
  assert.match(migration, /drop function public\.admin_client_purge_storage_paths/);
});
