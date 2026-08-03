import type { NextRequest } from 'next/server';
import {
  evidenceObjectPath,
  hasProtectedKycEvidencePath,
  hasReferencedEvidencePath,
} from '@/lib/domain/evidence';
import {
  createPrivilegedClient,
  isSameOriginMutation,
  noStoreJson,
} from '@/lib/server/api';
import {
  EVIDENCE_BUCKETS,
  MAX_EVIDENCE_UPLOAD_BYTES,
  STAGING_BUCKET,
  canStageEvidenceForRole,
  detectEvidenceType,
  hasExpectedPartialContentHeaders,
  isExpectedEvidenceStagingPath,
  stagingPathExtension,
  type EvidenceBucket,
} from '@/lib/server/staged-upload';
import { jsonStringValues } from '@/lib/supabase/json';
import { createClient } from '@/lib/supabase/server';
import type { AppErrorCode } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKETS = new Set<string>(EVIDENCE_BUCKETS);
const SIGNATURE_PREFIX_BYTES = 4_096;

async function readStoredSignature(
  worker: ReturnType<typeof createPrivilegedClient>,
  bucket: EvidenceBucket,
  path: string,
  size: number,
) {
  const { data, error } = await worker.storage
    .from(bucket)
    .createSignedUrl(path, 30);
  if (error || !data?.signedUrl) return null;

  const expectedBytes = Math.min(size, SIGNATURE_PREFIX_BYTES);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(data.signedUrl, {
      cache: 'no-store',
      headers: { Range: `bytes=0-${expectedBytes - 1}` },
      signal: controller.signal,
    });
    if (
      !hasExpectedPartialContentHeaders(
        response.status,
        response.headers,
        expectedBytes,
        size,
      )
    ) {
      await response.body?.cancel();
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length === expectedBytes ? bytes : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function errorJson(code: AppErrorCode, status: number) {
  return noStoreJson({ error: { code } }, status);
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return errorJson('PERMISSION_DENIED', 403);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return errorJson('AUTH_REQUIRED', 401);

  let payload: { bucket?: unknown; kind?: unknown; stagingPath?: unknown };
  try {
    payload = (await request.json()) as {
      bucket?: unknown;
      kind?: unknown;
      stagingPath?: unknown;
    };
  } catch {
    return errorJson('INVALID_REQUEST', 400);
  }

  if (
    typeof payload.bucket !== 'string' ||
    !BUCKETS.has(payload.bucket) ||
    typeof payload.kind !== 'string' ||
    !/^[a-z0-9_-]{1,64}$/.test(payload.kind) ||
    typeof payload.stagingPath !== 'string' ||
    payload.stagingPath.length > 500
  ) {
    return errorJson('INVALID_REQUEST', 400);
  }
  const bucket = payload.bucket as EvidenceBucket;
  const kind = payload.kind;
  const stagingPath = payload.stagingPath;
  if (!isExpectedEvidenceStagingPath(stagingPath, user.id, bucket, kind)) {
    return errorJson('INVALID_REQUEST', 400);
  }

  if (bucket === 'external-execution-evidence') {
    const { data: role, error: roleError } = await supabase.rpc(
      'current_app_role',
    );
    if (roleError || !canStageEvidenceForRole(bucket, role)) {
      return errorJson('PERMISSION_DENIED', 403);
    }
  }

  if (bucket === 'kyc-evidence') {
    const allowedKinds = new Set([
      'id_front',
      'id_back',
      'selfie',
      'proof_of_address',
    ]);
    if (!allowedKinds.has(kind)) {
      return errorJson('INVALID_REQUEST', 400);
    }
    const { data: existingKyc, error: kycError } = await supabase
      .from('kyc_applications')
      .select('status,requested_items')
      .eq('owner_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (kycError) return errorJson('SAVE_FAILED', 400);
    if (
      existingKyc &&
      (!['needs_information', 'rejected'].includes(existingKyc.status) ||
        !existingKyc.requested_items?.includes(kind))
    ) {
      return errorJson('PERMISSION_DENIED', 403);
    }
  }

  let worker: ReturnType<typeof createPrivilegedClient>;
  try {
    worker = createPrivilegedClient(
      'SUPABASE_SECRET_KEY est requise pour finaliser un téléversement.',
    );
  } catch {
    return errorJson('CONFIGURATION_UNAVAILABLE', 503);
  }

  let destinationPath: string | null = null;
  let finalized = false;
  try {
    const extension = stagingPathExtension(stagingPath);
    if (!extension) return errorJson('INVALID_REQUEST', 400);
    destinationPath = evidenceObjectPath(
      user.id,
      kind,
      extension,
      crypto.randomUUID(),
    );
    const { error: moveError } = await worker.storage
      .from(STAGING_BUCKET)
      .move(stagingPath, destinationPath, { destinationBucket: bucket });
    if (moveError) return errorJson('UPLOAD_FAILED', 400);

    const { data: stored, error: infoError } = await worker.storage
      .from(bucket)
      .info(destinationPath);
    const storedSize = stored?.size;
    if (
      infoError ||
      !Number.isSafeInteger(storedSize) ||
      !storedSize ||
      storedSize > MAX_EVIDENCE_UPLOAD_BYTES
    ) {
      return errorJson('INVALID_REQUEST', 413);
    }

    const signature = await readStoredSignature(
      worker,
      bucket,
      destinationPath,
      storedSize,
    );
    const detected = signature ? detectEvidenceType(signature) : null;
    if (
      !detected ||
      extension !== detected.extension ||
      stored.contentType !== detected.mimeType ||
      (bucket === 'kyc-evidence' &&
        kind === 'selfie' &&
        detected.mimeType !== 'image/jpeg')
    ) {
      return errorJson('INVALID_REQUEST', 415);
    }

    finalized = true;
    return noStoreJson({ path: destinationPath }, 201);
  } finally {
    try {
      const { error } = await worker.storage
        .from(STAGING_BUCKET)
        .remove([stagingPath]);
      if (error) {
        console.warn(
          JSON.stringify({ event: 'staging_evidence_cleanup_failed' }),
        );
      }
    } catch {
      console.warn(JSON.stringify({ event: 'staging_evidence_cleanup_failed' }));
    }
    if (destinationPath && !finalized) {
      try {
        const { error } = await worker.storage
          .from(bucket)
          .remove([destinationPath]);
        if (error) {
          console.warn(
            JSON.stringify({ event: 'invalid_evidence_cleanup_failed' }),
          );
        }
      } catch {
        console.warn(
          JSON.stringify({ event: 'invalid_evidence_cleanup_failed' }),
        );
      }
    }
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginMutation(request)) return errorJson('PERMISSION_DENIED', 403);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return errorJson('AUTH_REQUIRED', 401);

  let payload: { bucket?: unknown; paths?: unknown };
  try {
    payload = (await request.json()) as {
      bucket?: unknown;
      paths?: unknown;
    };
  } catch {
    return errorJson('INVALID_REQUEST', 400);
  }
  if (
    typeof payload.bucket !== 'string' ||
    !BUCKETS.has(payload.bucket) ||
    !Array.isArray(payload.paths) ||
    payload.paths.length < 1 ||
    payload.paths.length > 10 ||
    payload.paths.some(
      (path) =>
        typeof path !== 'string' ||
        path.length > 500 ||
        !path.startsWith(`${user.id}/`),
    )
  ) {
    return errorJson('INVALID_REQUEST', 400);
  }

  const paths = payload.paths as string[];
  let referencedPaths: string[] = [];
  let hasSubmittedKycApplication = false;
  if (payload.bucket === 'kyc-evidence') {
    const [applications, draft] = await Promise.all([
      supabase
        .from('kyc_applications')
        .select('document_object_paths')
        .eq('owner_id', user.id),
      supabase
        .from('kyc_drafts')
        .select('document_object_paths')
        .eq('owner_id', user.id),
    ]);
    if (applications.error || draft.error) return errorJson('SAVE_FAILED', 400);
    hasSubmittedKycApplication = (applications.data?.length ?? 0) > 0;
    referencedPaths = [
      ...(applications.data ?? []),
      ...(draft.data ?? []),
    ].flatMap((row) => jsonStringValues(row.document_object_paths));
  } else if (payload.bucket === 'loan-evidence') {
    const { data, error } = await supabase
      .from('loan_applications')
      .select('document_object_paths')
      .eq('owner_id', user.id);
    if (error) return errorJson('SAVE_FAILED', 400);
    referencedPaths = (data ?? []).flatMap((row) =>
      jsonStringValues(row.document_object_paths),
    );
  } else {
    const [transfers, loans] = await Promise.all([
      supabase
        .from('external_transfer_executions')
        .select('evidence_object_path')
        .in('evidence_object_path', paths),
      supabase
        .from('external_loan_fundings')
        .select('evidence_object_path')
        .in('evidence_object_path', paths),
    ]);
    if (transfers.error || loans.error) return errorJson('SAVE_FAILED', 400);
    referencedPaths = [
      ...(transfers.data ?? []),
      ...(loans.data ?? []),
    ].map((row) => row.evidence_object_path);
  }

  if (
    (payload.bucket === 'kyc-evidence' &&
      hasProtectedKycEvidencePath(
        paths,
        referencedPaths,
        hasSubmittedKycApplication,
      )) ||
    (payload.bucket !== 'kyc-evidence' &&
      hasReferencedEvidencePath(paths, referencedPaths))
  ) {
    return errorJson('PERMISSION_DENIED', 409);
  }

  const { error } = await supabase.storage
    .from(payload.bucket)
    .remove(paths);
  if (error) return errorJson('SAVE_FAILED', 400);
  return noStoreJson({ deleted: paths.length });
}
