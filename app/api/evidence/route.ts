import { NextResponse, type NextRequest } from 'next/server';
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

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function errorJson(code: AppErrorCode, status: number) {
  return noStoreJson({ error: { code } }, status);
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  const canonicalOrigin =
    process.env.APP_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    (process.env.NODE_ENV === 'development' ? request.nextUrl.origin : null);
  if (!origin || !canonicalOrigin) return false;
  try {
    return new URL(origin).origin === new URL(canonicalOrigin).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return errorJson('PERMISSION_DENIED', 403);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return errorJson('AUTH_REQUIRED', 401);

  const formData = await request.formData();
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

  const path =
    bucket === 'kyc-evidence'
      ? `${user.id}/current/${kind}.${detected.extension}`
      : `${user.id}/${kind}/${crypto.randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: detected.mime,
    cacheControl: '3600',
    upsert: bucket === 'kyc-evidence',
  });
  if (uploadError) return errorJson('UPLOAD_FAILED', 400);

  if (bucket === 'kyc-evidence') {
    const stalePaths = ['pdf', 'png', 'jpg']
      .filter((extension) => extension !== detected.extension)
      .map((extension) => `${user.id}/current/${kind}.${extension}`);
    await supabase.storage.from(bucket).remove(stalePaths);
  }

  return noStoreJson({ path }, 201);
}

export async function DELETE(request: NextRequest) {
  if (!originAllowed(request)) return errorJson('PERMISSION_DENIED', 403);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return errorJson('AUTH_REQUIRED', 401);

  const payload = (await request.json()) as { bucket?: unknown; paths?: unknown };
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

  const { error } = await supabase.storage
    .from(payload.bucket)
    .remove(payload.paths as string[]);
  if (error) return errorJson('SAVE_FAILED', 400);
  return noStoreJson({ deleted: payload.paths.length });
}
