import type { NextRequest } from 'next/server';
import {
  createPrivilegedClient,
  isSameOriginMutation,
  noStoreJson,
} from '@/lib/server/api';
import {
  STAGING_BUCKET,
  canStageEvidenceForRole,
  createStagingPath,
  isOwnedStagingPath,
  validateUploadIntent,
} from '@/lib/server/staged-upload';
import { createClient } from '@/lib/supabase/server';
import type { AppErrorCode } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorJson(code: AppErrorCode, status: number) {
  return noStoreJson({ error: { code } }, status);
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return errorJson('PERMISSION_DENIED', 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return errorJson('AUTH_REQUIRED', 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson('INVALID_REQUEST', 400);
  }

  const validation = validateUploadIntent(body);
  if (!validation.ok) {
    return errorJson('INVALID_REQUEST', validation.status);
  }

  const { intent } = validation;
  if (
    intent.purpose === 'branding' ||
    (intent.purpose === 'evidence' &&
      intent.metadata.bucket === 'external-execution-evidence')
  ) {
    const { data: role, error: roleError } = await supabase.rpc(
      'current_app_role',
    );
    if (roleError) return errorJson('PERMISSION_DENIED', 403);
    if (
      (intent.purpose === 'branding' && role !== 'admin') ||
      (intent.purpose === 'evidence' &&
        !canStageEvidenceForRole(intent.metadata.bucket, role))
    ) {
      return errorJson('PERMISSION_DENIED', 403);
    }
  }

  let worker: ReturnType<typeof createPrivilegedClient>;
  try {
    worker = createPrivilegedClient(
      'SUPABASE_SECRET_KEY est requise pour préparer un téléversement.',
    );
  } catch {
    return errorJson('CONFIGURATION_UNAVAILABLE', 503);
  }

  const path = createStagingPath(user.id, intent, crypto.randomUUID());
  const { data, error } = await worker.storage
    .from(STAGING_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data?.token || data.path !== path) {
    return errorJson('UPLOAD_FAILED', 503);
  }

  return noStoreJson({ path, token: data.token }, 201);
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return errorJson('PERMISSION_DENIED', 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return errorJson('AUTH_REQUIRED', 401);

  let body: { paths?: unknown };
  try {
    body = (await request.json()) as { paths?: unknown };
  } catch {
    return errorJson('INVALID_REQUEST', 400);
  }

  if (
    !Array.isArray(body.paths) ||
    body.paths.length < 1 ||
    body.paths.length > 10 ||
    body.paths.some(
      (path) =>
        typeof path !== 'string' ||
        path.length > 500 ||
        !isOwnedStagingPath(path, user.id),
    )
  ) {
    return errorJson('INVALID_REQUEST', 400);
  }
  const paths = [...new Set(body.paths as string[])];

  let worker: ReturnType<typeof createPrivilegedClient>;
  try {
    worker = createPrivilegedClient(
      'SUPABASE_SECRET_KEY est requise pour supprimer un téléversement temporaire.',
    );
  } catch {
    return errorJson('CONFIGURATION_UNAVAILABLE', 503);
  }

  const { error } = await worker.storage.from(STAGING_BUCKET).remove(paths);
  if (error) return errorJson('SAVE_FAILED', 400);
  return noStoreJson({ deleted: paths.length });
}
