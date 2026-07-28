'use client';

export type EvidenceBucket =
  | 'kyc-evidence'
  | 'loan-evidence'
  | 'external-execution-evidence';

export async function uploadEvidence(
  bucket: EvidenceBucket,
  kind: string,
  file: File,
) {
  const body = new FormData();
  body.set('bucket', bucket);
  body.set('kind', kind);
  body.set('file', file);

  const response = await fetch('/api/evidence', {
    method: 'POST',
    body,
    credentials: 'same-origin',
  });
  const result = (await response.json()) as { path?: string; error?: string };
  if (!response.ok || !result.path) {
    throw new Error(result.error ?? 'Téléversement du justificatif impossible.');
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
