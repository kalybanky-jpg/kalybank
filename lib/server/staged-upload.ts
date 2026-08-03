export const STAGING_BUCKET = 'upload-staging';

export const MAX_EVIDENCE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_BRANDING_UPLOAD_BYTES = 5 * 1024 * 1024;

export const EVIDENCE_BUCKETS = [
  'kyc-evidence',
  'loan-evidence',
  'external-execution-evidence',
] as const;

export type EvidenceBucket = (typeof EVIDENCE_BUCKETS)[number];
export type BrandingUploadKind =
  | 'primaryLogo'
  | 'reversedLogo'
  | 'favicon';

export interface EvidenceUploadIntent {
  purpose: 'evidence';
  mimeType: EvidenceMimeType;
  size: number;
  metadata: {
    bucket: EvidenceBucket;
    kind: string;
  };
}

export interface BrandingUploadIntent {
  purpose: 'branding';
  mimeType: BrandingMimeType;
  size: number;
  metadata: {
    kind: BrandingUploadKind;
  };
}

export type UploadIntent = EvidenceUploadIntent | BrandingUploadIntent;

export type UploadIntentValidation =
  | { ok: true; intent: UploadIntent }
  | { ok: false; status: 400 | 413 | 415 };

const EVIDENCE_MIME_EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const;

const BRANDING_MIME_EXTENSIONS = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type EvidenceMimeType = keyof typeof EVIDENCE_MIME_EXTENSIONS;
export type BrandingMimeType = keyof typeof BRANDING_MIME_EXTENSIONS;

const EVIDENCE_BUCKET_SET = new Set<string>(EVIDENCE_BUCKETS);
const KYC_EVIDENCE_KINDS = new Set([
  'id_front',
  'id_back',
  'selfie',
  'proof_of_address',
]);
const BRANDING_KINDS = new Set<string>([
  'primaryLogo',
  'reversedLogo',
  'favicon',
]);
const SAFE_EVIDENCE_KIND = /^[a-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isSafeSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validateUploadIntent(value: unknown): UploadIntentValidation {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['purpose', 'mimeType', 'size', 'metadata']) ||
    !isSafeSize(value.size) ||
    typeof value.mimeType !== 'string' ||
    !isRecord(value.metadata)
  ) {
    return { ok: false, status: 400 };
  }

  if (value.purpose === 'evidence') {
    if (
      !hasOnlyKeys(value.metadata, ['bucket', 'kind']) ||
      typeof value.metadata.bucket !== 'string' ||
      !EVIDENCE_BUCKET_SET.has(value.metadata.bucket) ||
      typeof value.metadata.kind !== 'string' ||
      !SAFE_EVIDENCE_KIND.test(value.metadata.kind)
    ) {
      return { ok: false, status: 400 };
    }
    if (!(value.mimeType in EVIDENCE_MIME_EXTENSIONS)) {
      return { ok: false, status: 415 };
    }
    if (
      value.metadata.bucket === 'kyc-evidence' &&
      !KYC_EVIDENCE_KINDS.has(value.metadata.kind)
    ) {
      return { ok: false, status: 400 };
    }
    if (value.size > MAX_EVIDENCE_UPLOAD_BYTES) {
      return { ok: false, status: 413 };
    }
    if (
      value.metadata.bucket === 'kyc-evidence' &&
      value.metadata.kind === 'selfie' &&
      value.mimeType !== 'image/jpeg'
    ) {
      return { ok: false, status: 415 };
    }
    return {
      ok: true,
      intent: {
        purpose: 'evidence',
        mimeType: value.mimeType as EvidenceMimeType,
        size: value.size,
        metadata: {
          bucket: value.metadata.bucket as EvidenceBucket,
          kind: value.metadata.kind,
        },
      },
    };
  }

  if (value.purpose === 'branding') {
    if (
      !hasOnlyKeys(value.metadata, ['kind']) ||
      typeof value.metadata.kind !== 'string' ||
      !BRANDING_KINDS.has(value.metadata.kind)
    ) {
      return { ok: false, status: 400 };
    }
    if (!(value.mimeType in BRANDING_MIME_EXTENSIONS)) {
      return { ok: false, status: 415 };
    }
    if (value.size > MAX_BRANDING_UPLOAD_BYTES) {
      return { ok: false, status: 413 };
    }
    return {
      ok: true,
      intent: {
        purpose: 'branding',
        mimeType: value.mimeType as BrandingMimeType,
        size: value.size,
        metadata: {
          kind: value.metadata.kind as BrandingUploadKind,
        },
      },
    };
  }

  return { ok: false, status: 400 };
}

export function createStagingPath(
  ownerId: string,
  intent: UploadIntent,
  objectId: string,
) {
  if (!UUID.test(objectId) || ownerId.includes('/')) {
    throw new Error('Invalid staging object identity.');
  }

  if (intent.purpose === 'evidence') {
    const extension = EVIDENCE_MIME_EXTENSIONS[intent.mimeType];
    return `${ownerId}/evidence/${intent.metadata.bucket}/${intent.metadata.kind}/${objectId}.${extension}`;
  }

  const extension = BRANDING_MIME_EXTENSIONS[intent.mimeType];
  return `${ownerId}/branding/${intent.metadata.kind}/${objectId}.${extension}`;
}

export function isExpectedEvidenceStagingPath(
  path: string,
  ownerId: string,
  bucket: EvidenceBucket,
  kind: string,
) {
  if (!SAFE_EVIDENCE_KIND.test(kind)) return false;
  const segments = path.split('/');
  if (
    segments.length !== 5 ||
    segments[0] !== ownerId ||
    segments[1] !== 'evidence' ||
    segments[2] !== bucket ||
    segments[3] !== kind
  ) {
    return false;
  }

  const match = /^([0-9a-f-]+)\.(pdf|jpg|png)$/i.exec(segments[4]);
  return Boolean(match && UUID.test(match[1]));
}

export function isExpectedBrandingStagingPath(
  path: string,
  ownerId: string,
  kind: BrandingUploadKind,
) {
  const segments = path.split('/');
  if (
    segments.length !== 4 ||
    segments[0] !== ownerId ||
    segments[1] !== 'branding' ||
    segments[2] !== kind
  ) {
    return false;
  }

  const match = /^([0-9a-f-]+)\.(svg|png|webp)$/i.exec(segments[3]);
  return Boolean(match && UUID.test(match[1]));
}

export function isOwnedStagingPath(path: string, ownerId: string) {
  const segments = path.split('/');
  if (segments[0] !== ownerId) return false;

  if (segments[1] === 'evidence' && segments.length === 5) {
    const bucket = segments[2];
    const kind = segments[3];
    return (
      EVIDENCE_BUCKET_SET.has(bucket) &&
      isExpectedEvidenceStagingPath(
        path,
        ownerId,
        bucket as EvidenceBucket,
        kind,
      )
    );
  }

  if (segments[1] === 'branding' && segments.length === 4) {
    const kind = segments[2];
    return (
      BRANDING_KINDS.has(kind) &&
      isExpectedBrandingStagingPath(
        path,
        ownerId,
        kind as BrandingUploadKind,
      )
    );
  }

  return false;
}

export function canStageEvidenceForRole(
  bucket: EvidenceBucket,
  role: unknown,
) {
  return (
    bucket !== 'external-execution-evidence' ||
    role === 'operator' ||
    role === 'supervisor' ||
    role === 'admin'
  );
}

export interface DetectedEvidenceType {
  mimeType: EvidenceMimeType;
  extension: 'pdf' | 'jpg' | 'png';
}

export function detectEvidenceType(
  bytes: Uint8Array,
): DetectedEvidenceType | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  return null;
}

export function stagingPathExtension(path: string) {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match?.[1]?.toLowerCase() ?? null;
}

export function hasExpectedPartialContentHeaders(
  status: number,
  headers: Pick<Headers, 'get'>,
  expectedBytes: number,
  totalBytes: number,
) {
  const contentRange = /^bytes 0-(\d+)\/(\d+)$/.exec(
    headers.get('content-range') ?? '',
  );
  const advertisedLength = headers.get('content-length');
  return (
    status === 206 &&
    Boolean(contentRange) &&
    Number(contentRange?.[1]) + 1 === expectedBytes &&
    Number(contentRange?.[2]) === totalBytes &&
    (advertisedLength === null || Number(advertisedLength) === expectedBytes)
  );
}
