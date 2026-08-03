import type { NextRequest } from 'next/server';
import {
  evidenceObjectPath,
  hasProtectedKycEvidencePath,
  hasReferencedEvidencePath,
} from '@/lib/domain/evidence';
import { isSameOriginMutation, noStoreJson } from '@/lib/server/api';
import { jsonStringValues } from '@/lib/supabase/json';
import { createClient } from '@/lib/supabase/server';
import type { AppErrorCode } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;
const BUCKETS = new Set([
  'kyc-evidence',
  'loan-evidence',
  'external-execution-evidence',
]);

const SIGNATURES = [
  {
    mime: 'application/pdf',
    extension: 'pdf',
    matches: (bytes: Uint8Array) =>
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d,
  },
  {
    mime: 'image/png',
    extension: 'png',
    matches: (bytes: Uint8Array) =>
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (value, index) => bytes[index] === value,
      ),
  },
  {
    mime: 'image/jpeg',
    extension: 'jpg',
    matches: (bytes: Uint8Array) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
];

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson('INVALID_REQUEST', 400);
  }
  const bucket = formData.get('bucket');
  const kind = formData.get('kind');
  const file = formData.get('file');

  if (
    typeof bucket !== 'string' ||
    !BUCKETS.has(bucket) ||
    typeof kind !== 'string' ||
    !/^[a-z0-9_-]{1,64}$/.test(kind) ||
    !(file instanceof File)
  ) {
    return errorJson('INVALID_REQUEST', 400);
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return errorJson('INVALID_REQUEST', 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = SIGNATURES.find((signature) => signature.matches(bytes));
  if (!detected || detected.mime !== file.type) {
    return errorJson('INVALID_REQUEST', 415);
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
    if (kind === 'selfie' && detected.mime !== 'image/jpeg') {
      return errorJson('INVALID_REQUEST', 415);
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

  const path = evidenceObjectPath(
    user.id,
    kind,
    detected.extension,
    crypto.randomUUID(),
  );
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: detected.mime,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) return errorJson('UPLOAD_FAILED', 400);

  return noStoreJson({ path }, 201);
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
