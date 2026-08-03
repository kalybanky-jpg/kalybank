'use client';

import { AppError } from './app-error';
import { discardStagedUploads, stageUpload } from './staged-upload';
import type { AppErrorCode } from './types';
import {
  MAX_COMPRESSIBLE_IMAGE_SOURCE_BYTES,
  isCompressibleRasterType,
  prepareUploadFile,
} from './upload-preparation';

export type EvidenceBucket =
  | 'kyc-evidence'
  | 'loan-evidence'
  | 'external-execution-evidence';

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export async function uploadEvidence(
  bucket: EvidenceBucket,
  kind: string,
  file: File,
) {
  if (
    (isCompressibleRasterType(file.type) &&
      file.size > MAX_COMPRESSIBLE_IMAGE_SOURCE_BYTES) ||
    (!isCompressibleRasterType(file.type) && file.size > MAX_EVIDENCE_BYTES)
  ) {
    throw new AppError('INVALID_REQUEST');
  }
  const preparedFile = await prepareUploadFile(file);
  if (preparedFile.size > MAX_EVIDENCE_BYTES) {
    throw new AppError('INVALID_REQUEST');
  }
  const { path: stagingPath } = await stageUpload(
    preparedFile,
    'evidence',
    { bucket, kind },
  );

  let response: Response;
  try {
    response = await fetch('/api/evidence', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, kind, stagingPath }),
    });
  } catch {
    await discardStagedUploads([stagingPath]);
    throw new AppError('NETWORK_ERROR');
  }
  let result: { path?: string; error?: { code?: AppErrorCode } } = {};
  try {
    result = (await response.json()) as typeof result;
  } catch {
    // A non-JSON infrastructure response is reported as an upload failure.
  }
  if (!response.ok || !result.path) {
    await discardStagedUploads([stagingPath]);
    throw new AppError(result.error?.code ?? 'UPLOAD_FAILED');
  }
  return result.path;
}

export async function deleteEvidence(bucket: EvidenceBucket, paths: string[]) {
  if (!paths.length) return;
  await fetch('/api/evidence', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, paths }),
  });
}
