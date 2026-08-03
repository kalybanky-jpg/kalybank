export function evidenceObjectPath(
  ownerId: string,
  kind: string,
  extension: string,
  objectId: string,
) {
  return `${ownerId}/${kind}/${objectId}.${extension}`;
}

export function hasReferencedEvidencePath(
  requestedPaths: readonly string[],
  referencedPaths: readonly string[],
) {
  const referenced = new Set(referencedPaths);
  return requestedPaths.some((path) => referenced.has(path));
}

export function hasProtectedKycEvidencePath(
  requestedPaths: readonly string[],
  referencedPaths: readonly string[],
  hasSubmittedApplication: boolean,
) {
  return (
    hasSubmittedApplication ||
    hasReferencedEvidencePath(requestedPaths, referencedPaths)
  );
}
