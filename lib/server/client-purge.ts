import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  storageChunks,
  validateClientPurgeStorageReference,
  type ClientPurgeImpact,
  type ClientPurgeStorageBucket,
  type ClientPurgeStorageOwnershipScope,
  type ClientPurgeStorageReference,
} from '@/lib/client-purge';
import { createPrivilegedClient, noStoreJson } from '@/lib/server/api';
import { createBoundedPrivilegedFetch } from '@/lib/server/bounded-privileged-fetch';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

type PrivilegedClient = ReturnType<typeof createPrivilegedClient>;
type RpcResult<T> = Promise<{
  data: T | null;
  error: { code?: string; message: string } | null;
}>;
type UntypedRpcClient = {
  rpc<T>(name: string, args?: Record<string, unknown>): RpcResult<T>;
};

export type ActiveAdmin = {
  user: { id: string };
  email: string;
  worker: PrivilegedClient;
};

export type PreparedPurge = {
  challengeId: string;
  expiresAt: string;
  inventoryComplete: boolean;
  impact: ClientPurgeImpact;
};

type PendingPurge = {
  challenge_id: string;
  actor_id: string;
  target_user_id: string;
  challenge_digest: string;
  target_email_digest: string;
  idempotency_key: string;
  stage: PurgeStage;
};

export type ClientPurgeState = {
  status: 'preview' | 'running' | 'failed' | 'waiting_sweep';
  stage: PurgeStage;
  challengeId?: string;
  sweepNotBefore: string | null;
  canResume?: boolean;
  expiresAt?: string | null;
  storagePhase?: StoragePhase;
  targetEmail?: string;
  authDeleted?: boolean;
  ignoredUnsafeStorageReferences?: number;
};

type StorageManifestEntry = {
  bucket: ClientPurgeStorageBucket;
  objectPath: string;
  ownershipScope: ClientPurgeStorageOwnershipScope;
};

type PurgeStage =
  | 'storage'
  | 'database'
  | 'waiting_sweep'
  | 'storage_sweep'
  | 'auth'
  | 'verify';

export const CLIENT_PURGE_STORAGE_VERIFY_CONCURRENCY = 8;
export const CLIENT_PURGE_AUTH_FETCH_TIMEOUT_MS = 15_000;
export const CLIENT_PURGE_AUTH_REQUEST_TIMEOUT_MS = 18_000;
export const CLIENT_PURGE_INTERACTIVE_REQUEST_TIMEOUT_MS = 18_000;

export function createClientPurgeRequestSignal(callerSignal?: AbortSignal) {
  const deadline = AbortSignal.timeout(
    CLIENT_PURGE_INTERACTIVE_REQUEST_TIMEOUT_MS,
  );
  return callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
}

type StoragePhase =
  | 'idle'
  | 'references'
  | 'scan'
  | 'delete'
  | 'verify_manifest'
  | 'verify_prefix'
  | 'complete';

type StorageWork =
  | {
      kind: 'database' | 'wait' | 'complete';
      phase: StoragePhase;
      complete: boolean;
      processed?: number;
      unsafeIgnored?: number;
    }
  | {
      kind: 'scan';
      claimToken: string;
      scanId: number;
      bucket: ClientPurgeStorageBucket;
      prefix: string;
      offset: number;
      limit: number;
      complete: false;
    }
  | {
      kind: 'delete' | 'verify_manifest';
      claimToken: string;
      items: StorageManifestEntry[];
      complete: false;
    }
  | {
      kind: 'verify_prefix';
      claimToken: string;
      bucket: ClientPurgeStorageBucket;
      prefix: string;
      complete: false;
    };

function rpc<T>(client: PrivilegedClient, name: string, args: Record<string, unknown>) {
  return (client as unknown as UntypedRpcClient).rpc<T>(name, args);
}

export function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function purgeChallengeToken(
  actorId: string,
  targetUserId: string,
  idempotencyKey: string,
) {
  const secret = process.env.CLIENT_PURGE_CHALLENGE_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('PURGE_CHALLENGE_CONFIG_MISSING');
  }
  return createHmac('sha256', secret)
    .update(
      JSON.stringify({
        purpose: 'client-purge-preview-v1',
        actorId,
        targetUserId,
        idempotencyKey,
      }),
      'utf8',
    )
    .digest('base64url');
}

export async function requireActiveAdmin(requestSignal?: AbortSignal): Promise<
  { admin: ActiveAdmin; response: null } | { admin: null; response: ReturnType<typeof noStoreJson> }
> {
  const effectiveRequestSignal =
    requestSignal ?? createClientPurgeRequestSignal();
  const supabase = await createClient({
    fetch: createBoundedPrivilegedFetch(
      CLIENT_PURGE_AUTH_FETCH_TIMEOUT_MS,
      fetch,
      effectiveRequestSignal,
    ),
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      admin: null,
      response: noStoreJson({ error: 'Authentification requise.' }, 401),
    };
  }

  let worker: PrivilegedClient;
  try {
    worker = createPrivilegedClient(
      'SUPABASE_SECRET_KEY est requise pour administrer les clients.',
      {
        fetchTimeoutMs: CLIENT_PURGE_AUTH_FETCH_TIMEOUT_MS,
        requestTimeoutMs: CLIENT_PURGE_INTERACTIVE_REQUEST_TIMEOUT_MS,
        requestSignal: effectiveRequestSignal,
      },
    );
  } catch {
    return {
      admin: null,
      response: noStoreJson({ error: 'Service administrateur indisponible.' }, 503),
    };
  }

  const { data: staff, error: staffError } = await worker
    .from('staff_members')
    .select('role,active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (staffError || !staff || staff.role !== 'admin' || !staff.active) {
    return {
      admin: null,
      response: noStoreJson({ error: 'Administrateur actif requis.' }, 403),
    };
  }
  if (!user.email) {
    return {
      admin: null,
      response: noStoreJson({ error: 'E-mail administrateur introuvable.' }, 409),
    };
  }
  return { admin: { user, email: user.email, worker }, response: null };
}

export async function verifyAdminPassword(
  admin: ActiveAdmin,
  password: string,
  requestSignal?: AbortSignal,
) {
  const { url, publishableKey } = getPublicSupabaseConfig();
  const authDeadline = AbortSignal.timeout(CLIENT_PURGE_AUTH_REQUEST_TIMEOUT_MS);
  const authRequestSignal = requestSignal
    ? AbortSignal.any([requestSignal, authDeadline])
    : authDeadline;
  const verifier = createSupabaseClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: createBoundedPrivilegedFetch(
        CLIENT_PURGE_AUTH_FETCH_TIMEOUT_MS,
        fetch,
        authRequestSignal,
      ),
    },
  });
  const { data, error } = await verifier.auth.signInWithPassword({
    email: admin.email,
    password,
  });
  if (authRequestSignal.aborted) {
    throw new Error('PURGE_AUTH_TIMEOUT');
  }
  if (error && error.code !== 'invalid_credentials') {
    throw new Error('PURGE_AUTH_UNAVAILABLE');
  }
  const valid = !error && data.user?.id === admin.user.id;
  if (data.session) await verifier.auth.signOut({ scope: 'local' });
  return valid;
}

export async function assertPurgeTargetAllowed(
  admin: ActiveAdmin,
  targetUserId: string,
) {
  if (targetUserId === admin.user.id) throw new Error('SELF_PURGE_FORBIDDEN');
  const { data: staff, error: staffError } = await admin.worker
    .from('staff_members')
    .select('user_id')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (staffError) throw new Error('STAFF_LOOKUP_FAILED');
  if (staff) throw new Error('STAFF_PURGE_FORBIDDEN');
}

export async function authoritativeClient(
  admin: ActiveAdmin,
  targetUserId: string,
) {
  await assertPurgeTargetAllowed(admin, targetUserId);

  const { data, error } = await admin.worker.auth.admin.getUserById(targetUserId);
  if (error || !data.user?.email) throw new Error('CLIENT_NOT_FOUND');
  return data.user;
}

export async function purgeStatus(admin: ActiveAdmin, targetUserId: string) {
  await assertPurgeTargetAllowed(admin, targetUserId);
  const { data, error } = await rpc<ClientPurgeState>(
    admin.worker,
    'admin_get_client_purge_status',
    { p_actor_id: admin.user.id, p_target_user_id: targetUserId },
  );
  if (error) throw new Error(error.message ?? 'PURGE_STATUS_FAILED');
  return data;
}

export async function authorizePurgeResume(
  admin: ActiveAdmin,
  targetUserId: string,
  exactEmail: string,
) {
  await assertPurgeTargetAllowed(admin, targetUserId);
  const lookup = await admin.worker.auth.admin.getUserById(targetUserId);
  if (!missingAuthUser(lookup.data.user, lookup.error)) {
    if (lookup.error) throw new Error('AUTH_LOOKUP_FAILED');
    if (lookup.data.user?.email !== exactEmail) {
      throw new Error('EMAIL_CONFIRMATION_MISMATCH');
    }
  }
  const { data, error } = await rpc<ClientPurgeState>(
    admin.worker,
    'admin_resume_client_purge',
    {
      p_actor_id: admin.user.id,
      p_target_user_id: targetUserId,
      p_target_email_digest: digest(exactEmail),
    },
  );
  if (error || !data) {
    throw new Error(error?.message ?? error?.code ?? 'PURGE_RESUME_INVALID');
  }
  return data;
}

export async function preparePurge(
  admin: ActiveAdmin,
  targetUserId: string,
  idempotencyKey: string,
) {
  const target = await authoritativeClient(admin, targetUserId);
  const challengeToken = purgeChallengeToken(
    admin.user.id,
    targetUserId,
    idempotencyKey,
  );
  const args = {
      p_actor_id: admin.user.id,
      p_target_user_id: targetUserId,
      p_challenge_digest: digest(challengeToken),
      p_target_email_digest: digest(target.email!),
      p_target_email: target.email!,
      p_idempotency_key: idempotencyKey,
  };
  let { data, error } = await rpc<PreparedPurge>(
    admin.worker,
    'admin_prepare_client_purge',
    args,
  );
  if (error || !data) throw new Error(error?.code ?? 'PURGE_PREVIEW_FAILED');
  if (!data.inventoryComplete) {
    await processStorageWorkUnit(admin, targetUserId, data.challengeId);
    ({ data, error } = await rpc<PreparedPurge>(
      admin.worker,
      'admin_prepare_client_purge',
      args,
    ));
    if (error || !data) throw new Error(error?.code ?? 'PURGE_PREVIEW_FAILED');
  }
  return {
    challengeId: data.challengeId,
    expiresAt: data.expiresAt,
    impact: data.impact,
    pending: !data.inventoryComplete,
    idempotencyKey,
    challengeToken,
    targetEmail: target.email!,
  };
}

export async function recoverPurgePreview(
  admin: ActiveAdmin,
  targetUserId: string,
) {
  const { data, error } = await rpc<{
    idempotencyKey?: string;
    targetEmail?: string;
    invalidated?: boolean;
    reason?: string;
  }>(admin.worker, 'admin_get_client_purge_preview', {
    p_actor_id: admin.user.id,
    p_target_user_id: targetUserId,
  });
  if (error || !data || data.invalidated || !data.idempotencyKey) {
    throw new Error(
      data?.reason === 'email_changed'
        ? 'PURGE_TARGET_EMAIL_CHANGED'
        : (error?.message ?? error?.code ?? 'PURGE_PREVIEW_NOT_FOUND'),
    );
  }
  return preparePurge(admin, targetUserId, data.idempotencyKey);
}

async function storageObjectExists(
  worker: PrivilegedClient,
  bucket: ClientPurgeStorageBucket,
  objectPath: string,
) {
  const segments = objectPath.split('/');
  const fileName = segments.pop();
  if (!fileName) return false;
  const parent = segments.join('/');
  let offset = 0;
  do {
    const { data, error } = await worker.storage.from(bucket).list(parent, {
      search: fileName,
      limit: 1_000,
      offset,
    });
    if (error) throw new Error('STORAGE_VERIFY_FAILED');
    const entries = data ?? [];
    if (
      entries.some(
        (entry) => typeof entry.id === 'string' && entry.name === fileName,
      )
    ) {
      return true;
    }
    offset += entries.length;
    if (entries.length < 1_000) return false;
  } while (Number.isSafeInteger(offset));
  throw new Error('STORAGE_LIST_LIMIT');
}

async function anyClaimedStorageObjectExists(
  worker: PrivilegedClient,
  targetUserId: string,
  entries: readonly StorageManifestEntry[],
) {
  let nextIndex = 0;
  let present = false;
  const inspectNext = async (): Promise<void> => {
    const index = nextIndex;
    nextIndex += 1;
    const entry = entries[index];
    if (!entry || present) return;
    const reference = validateClaimedStorageEntry(targetUserId, entry);
    if (
      await storageObjectExists(
        worker,
        reference.bucket,
        reference.objectPath,
      )
    ) {
      present = true;
      return;
    }
    await inspectNext();
  };
  await Promise.all(
    Array.from(
      {
        length: Math.min(
          CLIENT_PURGE_STORAGE_VERIFY_CONCURRENCY,
          entries.length,
        ),
      },
      () => inspectNext(),
    ),
  );
  return present;
}

function validateClaimedStorageEntry(
  targetUserId: string,
  entry: StorageManifestEntry,
) {
  const reference: ClientPurgeStorageReference = {
    bucket: entry.bucket,
    objectPath: entry.objectPath,
    ownershipScope: entry.ownershipScope,
    ownershipValid: true,
  };
  validateClientPurgeStorageReference(targetUserId, reference);
  return reference;
}

function extractPurgeRpcError(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const message = 'message' in error ? error.message : null;
    if (
      typeof message === 'string' &&
      /^PURGE_[A-Z0-9_]+$/.test(message.trim())
    ) {
      return message.trim();
    }
    const code = 'code' in error ? error.code : null;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  return fallback;
}

async function acknowledgeStorageWork(
  admin: ActiveAdmin,
  targetUserId: string,
  challengeId: string,
  claimToken: string,
  kind: 'scan' | 'delete' | 'verify_manifest' | 'verify_prefix',
  result: Record<string, unknown>,
) {
  const { error } = await rpc<Record<string, unknown>>(
    admin.worker,
    'admin_ack_client_purge_storage_work',
    {
      p_actor_id: admin.user.id,
      p_target_user_id: targetUserId,
      p_challenge_id: challengeId,
      p_claim_token: claimToken,
      p_kind: kind,
      p_result: result,
    },
  );
  if (error) throw new Error(extractPurgeRpcError(error, 'STORAGE_WORK_ACK_FAILED'));
}

export async function processStorageWorkUnit(
  admin: ActiveAdmin,
  targetUserId: string,
  challengeId: string,
) {
  const { data: work, error } = await rpc<StorageWork>(
    admin.worker,
    'admin_claim_client_purge_storage_work',
    {
      p_actor_id: admin.user.id,
      p_target_user_id: targetUserId,
      p_challenge_id: challengeId,
      p_limit: 1_000,
    },
  );
  if (error || !work) {
    throw new Error(extractPurgeRpcError(error, 'STORAGE_WORK_CLAIM_FAILED'));
  }
  if (work.kind === 'database' || work.kind === 'wait' || work.kind === 'complete') {
    return work;
  }

  if (work.kind === 'scan') {
    const { data, error: listError } = await admin.worker.storage
      .from(work.bucket)
      .list(work.prefix, {
        limit: work.limit,
        offset: work.offset,
        sortBy: { column: 'name', order: 'asc' },
      });
    if (listError) throw new Error('STORAGE_LIST_FAILED');
    const objects: string[] = [];
    const prefixes: string[] = [];
    for (const entry of data ?? []) {
      const exactPath = `${work.prefix}/${entry.name}`;
      if (typeof entry.id === 'string') {
        validateClientPurgeStorageReference(targetUserId, {
          bucket: work.bucket,
          objectPath: exactPath,
          ownershipScope: 'target_prefix',
          ownershipValid: true,
        });
        objects.push(exactPath);
      } else {
        validateClientPurgeStorageReference(targetUserId, {
          bucket: work.bucket,
          objectPath: `${exactPath}/_`,
          ownershipScope: 'target_prefix',
          ownershipValid: true,
        });
        prefixes.push(exactPath);
      }
    }
    await acknowledgeStorageWork(
      admin,
      targetUserId,
      challengeId,
      work.claimToken,
      'scan',
      { objects, prefixes, returnedCount: objects.length + prefixes.length },
    );
    return { ...work, processed: objects.length + prefixes.length };
  }

  if (work.kind === 'delete') {
    const byBucket = new Map<ClientPurgeStorageBucket, string[]>();
    for (const entry of work.items) {
      const reference = validateClaimedStorageEntry(targetUserId, entry);
      const paths = byBucket.get(reference.bucket) ?? [];
      paths.push(reference.objectPath);
      byBucket.set(reference.bucket, paths);
    }
    for (const [bucket, paths] of byBucket) {
      for (const chunk of storageChunks(paths)) {
        const { error: removeError } = await admin.worker.storage
          .from(bucket)
          .remove(chunk);
        if (removeError) throw new Error('STORAGE_REMOVE_FAILED');
      }
    }
    await acknowledgeStorageWork(
      admin,
      targetUserId,
      challengeId,
      work.claimToken,
      'delete',
      { removed: true },
    );
    return { ...work, processed: work.items.length };
  }

  if (work.kind === 'verify_manifest') {
    const absent = !(await anyClaimedStorageObjectExists(
      admin.worker,
      targetUserId,
      work.items,
    ));
    await acknowledgeStorageWork(
      admin,
      targetUserId,
      challengeId,
      work.claimToken,
      'verify_manifest',
      { absent },
    );
    return { ...work, processed: work.items.length, absent };
  }

  if (work.kind !== 'verify_prefix') {
    throw new Error('STORAGE_WORK_KIND_INVALID');
  }
  const { data, error: prefixError } = await admin.worker.storage
    .from(work.bucket)
    .list(work.prefix, { limit: 1, offset: 0 });
  if (prefixError) throw new Error('STORAGE_VERIFY_FAILED');
  const empty = (data ?? []).length === 0;
  await acknowledgeStorageWork(
    admin,
    targetUserId,
    challengeId,
    work.claimToken,
    'verify_prefix',
    { empty },
  );
  return { ...work, processed: data?.length ?? 0, empty };
}

async function markStage(
  admin: ActiveAdmin,
  challengeId: string,
  stage: PurgeStage,
  errorCode?: string,
) {
  const { error } = await rpc<null>(admin.worker, 'admin_mark_client_purge_stage', {
    p_actor_id: admin.user.id,
    p_challenge_id: challengeId,
    p_stage: stage,
    p_error_code: errorCode?.slice(0, 100) ?? null,
  });
  if (error) throw new Error('PURGE_STATE_UPDATE_FAILED');
}

function missingAuthUser(
  user: unknown,
  error: { code?: string; status?: number } | null,
) {
  if (user) return false;
  return !error || error.code === 'user_not_found' || error.status === 404;
}

export async function executePurge(input: {
  admin: ActiveAdmin;
  targetUserId: string;
  challengeId: string;
  challengeDigest?: string;
  emailDigest?: string;
  idempotencyKey?: string;
  startState?: ClientPurgeState;
  leaseAlreadyAcquired?: boolean;
}) {
  const { admin, challengeId, targetUserId } = input;
  let stage: PurgeStage = input.startState?.stage ?? 'storage';
  let leaseAcquired = Boolean(input.leaseAlreadyAcquired);
  try {
    let state = input.startState;
    if (!state) {
      if (!input.challengeDigest || !input.emailDigest || !input.idempotencyKey) {
        throw new Error('PURGE_CHALLENGE_INVALID');
      }
      const { data, error: beginError } = await rpc<ClientPurgeState>(
        admin.worker,
        'admin_begin_client_purge',
        {
          p_actor_id: admin.user.id,
          p_target_user_id: targetUserId,
          p_challenge_id: challengeId,
          p_challenge_digest: input.challengeDigest,
          p_target_email_digest: input.emailDigest,
          p_idempotency_key: input.idempotencyKey,
        },
      );
      if (beginError || !data) {
        throw new Error(
          beginError?.message ?? beginError?.code ?? 'PURGE_CHALLENGE_INVALID',
        );
      }
      state = data;
      leaseAcquired = data.status !== 'waiting_sweep';
    }
    if (!state) throw new Error('PURGE_OPERATION_NOT_FOUND');
    stage = state.stage;

    if (state.status === 'waiting_sweep' || stage === 'waiting_sweep') {
      return {
        deleted: false as const,
        status: 'waiting_sweep' as const,
        stage: 'waiting_sweep' as const,
        sweepNotBefore: state.sweepNotBefore,
        ignoredUnsafeStorageReferences:
          state.ignoredUnsafeStorageReferences ?? 0,
      };
    }

    if (stage === 'storage') {
      const work = await processStorageWorkUnit(admin, targetUserId, challengeId);
      if (work.complete) {
        await markStage(admin, challengeId, 'database');
        stage = 'database';
      }
      return {
        deleted: false as const,
        status: 'processing' as const,
        stage,
        storagePhase: 'phase' in work ? work.phase : work.kind,
        workKind: work.kind,
      };
    }

    if (stage === 'database') {
      const { data, error: purgeError } = await rpc<ClientPurgeState>(
        admin.worker,
        'admin_purge_client_relational_data',
        {
          p_actor_id: admin.user.id,
          p_target_user_id: targetUserId,
          p_challenge_id: challengeId,
        },
      );
      if (purgeError || !data) {
        throw new Error(
          purgeError?.message ?? purgeError?.code ?? 'DATABASE_PURGE_FAILED',
        );
      }
      return {
        deleted: false as const,
        status: 'waiting_sweep' as const,
        stage: 'waiting_sweep' as const,
        sweepNotBefore: data.sweepNotBefore,
        ignoredUnsafeStorageReferences:
          data.ignoredUnsafeStorageReferences ?? 0,
      };
    }

    if (stage === 'storage_sweep') {
      const work = await processStorageWorkUnit(admin, targetUserId, challengeId);
      if (work.complete) {
        await markStage(admin, challengeId, 'auth');
        stage = 'auth';
      }
      return {
        deleted: false as const,
        status: 'processing' as const,
        stage,
        storagePhase: 'phase' in work ? work.phase : work.kind,
        workKind: work.kind,
      };
    }

    if (stage === 'auth') {
      // Promotion is checked once through the Auth/admin surface and again in a
      // locked SECURITY DEFINER RPC immediately before the destructive call.
      await assertPurgeTargetAllowed(admin, targetUserId);
      const { data: authReady, error: authReadyError } = await rpc<{
        allowed: boolean;
        targetEmail: string;
      }>(admin.worker, 'admin_assert_client_purge_auth_ready', {
        p_actor_id: admin.user.id,
        p_target_user_id: targetUserId,
        p_challenge_id: challengeId,
      });
      if (authReadyError || !authReady?.allowed) {
        throw new Error(authReadyError?.code ?? 'PURGE_AUTH_STAGE_INVALID');
      }
      const beforeDelete = await admin.worker.auth.admin.getUserById(targetUserId);
      if (!missingAuthUser(beforeDelete.data.user, beforeDelete.error)) {
        if (beforeDelete.error) throw new Error('AUTH_LOOKUP_FAILED');
        if (
          !beforeDelete.data.user?.email ||
          normalizeEmail(beforeDelete.data.user.email) !==
            normalizeEmail(authReady.targetEmail)
        ) {
          throw new Error('PURGE_TARGET_EMAIL_CHANGED');
        }
        const { error: deleteError } = await admin.worker.auth.admin.deleteUser(
          targetUserId,
          false,
        );
        if (deleteError && !missingAuthUser(null, deleteError)) {
          throw new Error(deleteError.code ?? 'AUTH_DELETE_FAILED');
        }
      }
      await markStage(admin, challengeId, 'verify');
      return {
        deleted: false as const,
        status: 'processing' as const,
        stage: 'verify' as const,
        authDeleted: true,
      };
    }

    if (stage === 'verify') {
      // A second targeted sweep after Auth deletion catches an upload that was
      // already in flight when the delayed sweep first observed an empty prefix.
      const work = await processStorageWorkUnit(admin, targetUserId, challengeId);
      if (!work.complete) {
        return {
          deleted: false as const,
          status: 'processing' as const,
          stage: 'verify' as const,
          storagePhase: 'phase' in work ? work.phase : work.kind,
          workKind: work.kind,
          authDeleted: true,
        };
      }
      const verification = await admin.worker.auth.admin.getUserById(targetUserId);
      if (!missingAuthUser(verification.data.user, verification.error)) {
        throw new Error('AUTH_VERIFY_FAILED');
      }
      const { data: finalized, error: finalizeError } = await rpc<boolean>(
        admin.worker,
        'admin_finalize_client_purge',
        {
          p_actor_id: admin.user.id,
          p_target_user_id: targetUserId,
          p_challenge_id: challengeId,
        },
      );
      if (finalizeError || !finalized) throw new Error('PURGE_VERIFY_FAILED');
      return {
        deleted: true as const,
        status: 'deleted' as const,
      };
    }
    throw new Error('PURGE_STAGE_INVALID');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PURGE_FAILED';
    if (leaseAcquired) {
      try {
        await markStage(admin, challengeId, stage, code);
      } catch {
        // The original error is safer and more useful than a secondary state error.
      }
    }
    throw error;
  }
}

export async function pendingPurges(worker: PrivilegedClient, limit = 1) {
  const { data, error } = await rpc<PendingPurge[]>(
    worker,
    'admin_list_pending_client_purges',
    { p_limit: limit },
  );
  if (error) throw new Error('PURGE_SWEEP_LOOKUP_FAILED');
  return data ?? [];
}

export function validSweepSecret(provided: string | null) {
  const expected = process.env.CLIENT_PURGE_SWEEP_SECRET?.trim();
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (expectedBytes.length < 32 || providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}
