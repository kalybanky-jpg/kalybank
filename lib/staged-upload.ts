'use client';

import { AppError } from './app-error';
import { createClient } from './supabase/client';
import type { AppErrorCode } from './types';

const STAGING_BUCKET = 'upload-staging';

export type StagedEvidenceBucket =
  | 'kyc-evidence'
  | 'loan-evidence'
  | 'external-execution-evidence';

export interface EvidenceStageMetadata {
  bucket: StagedEvidenceBucket;
  kind: string;
}

export interface BrandingStageMetadata {
  kind: 'primaryLogo' | 'reversedLogo' | 'favicon';
}

interface UploadIntentResponse {
  path?: string;
  token?: string;
  error?: { code?: AppErrorCode };
}

async function responsePayload(response: Response) {
  try {
    return (await response.json()) as UploadIntentResponse;
  } catch {
    return {} as UploadIntentResponse;
  }
}

export function stageUpload(
  file: File,
  purpose: 'evidence',
  metadata: EvidenceStageMetadata,
): Promise<{ path: string }>;
export function stageUpload(
  file: File,
  purpose: 'branding',
  metadata: BrandingStageMetadata,
): Promise<{ path: string }>;
/**
 * Uploads a file directly from the browser to the private `upload-staging`
 * bucket. The application route only creates the short-lived capability and
 * never receives the file bytes. The returned `{ path }` is the opaque staging
 * reference to pass in the subsequent JSON finalization request.
 */
export async function stageUpload(
  file: File,
  purpose: 'evidence' | 'branding',
  metadata: EvidenceStageMetadata | BrandingStageMetadata,
): Promise<{ path: string }> {
  let response: Response;
  try {
    response = await fetch('/api/upload-intents', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose,
        mimeType: file.type,
        size: file.size,
        metadata,
      }),
    });
  } catch {
    throw new AppError('NETWORK_ERROR');
  }

  const payload = await responsePayload(response);
  if (!response.ok || !payload.path || !payload.token) {
    throw new AppError(payload.error?.code ?? 'UPLOAD_FAILED');
  }

  try {
    const { error } = await createClient()
      .storage.from(STAGING_BUCKET)
      .uploadToSignedUrl(payload.path, payload.token, file, {
        cacheControl: '3600',
        contentType: file.type,
      });
    if (error) throw error;
  } catch {
    await discardStagedUploads([payload.path]);
    throw new AppError('UPLOAD_FAILED');
  }

  return { path: payload.path };
}

/** Best-effort cleanup for staged objects abandoned before finalization. */
export async function discardStagedUploads(paths: readonly string[]) {
  const uniquePaths = [...new Set(paths)].slice(0, 10);
  if (uniquePaths.length === 0) return;
  try {
    await fetch('/api/upload-intents', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: uniquePaths }),
    });
  } catch {
    // Cleanup is intentionally best effort; the original operation keeps its
    // own actionable error and server-side lifecycle cleanup remains possible.
  }
}
