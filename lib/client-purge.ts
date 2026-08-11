export const CLIENT_PURGE_PAGE_SIZE = 20;
export const CLIENT_PURGE_MAX_BODY_LENGTH = 8_192;
export const CLIENT_PURGE_STORAGE_BUCKETS = [
  'upload-staging',
  'kyc-evidence',
  'loan-evidence',
  'external-execution-evidence',
  'official-documents',
] as const;

export const CLIENT_PURGE_PREFIX_STORAGE_BUCKETS = [
  'upload-staging',
  'kyc-evidence',
  'loan-evidence',
  'official-documents',
] as const satisfies readonly ClientPurgeStorageBucket[];

export type ClientPurgeStorageBucket =
  (typeof CLIENT_PURGE_STORAGE_BUCKETS)[number];

export type ClientPurgeImpact = {
  preservedAdmins: number;
  kycApplications: number;
  kycDrafts: number;
  accounts: number;
  ledgerEntries: number;
  loans: number;
  transfers: number;
  documents: number;
  notifications: number;
  emailOutbox: number;
  pushSubscriptions: number;
  supportIdentities: number;
  supportTranscripts: number;
  auditEvents: number;
  workflowEvents: number;
  externalExecutions: number;
  profileRecords: number;
  authRecords: number;
  storageReferences: number;
  unsafeStorageReferences: number;
  storageObjects: number;
};

export const CLIENT_PURGE_EXTERNAL_CHECKLIST = [
  'Supprimer les conversations et profils correspondants dans Tawk.to.',
  'Demander l’effacement chez les fournisseurs d’e-mail concernés.',
  'Appliquer la procédure d’effacement des journaux techniques exportés.',
  'Consigner le délai résiduel des sauvegardes selon la politique opérateur.',
] as const;

export class ClientPurgeValidationError extends Error {}
export class ClientPurgeOwnershipError extends Error {
  constructor() {
    super('STORAGE_OWNERSHIP_ANOMALY');
  }
}

export type ClientPurgeStorageOwnershipScope =
  | 'target_prefix'
  | 'relational';

export type ClientPurgeStorageReference = {
  bucket: string;
  objectPath: string;
  ownershipScope: string;
  ownershipValid: boolean;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ClientPurgeValidationError('Corps JSON invalide.');
  }
  return value as Record<string, unknown>;
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]) {
  const allowedKeys = new Set(allowed);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new ClientPurgeValidationError('Le corps contient un champ inattendu.');
  }
}

function uuid(value: unknown, label: string) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new ClientPurgeValidationError(`${label} est invalide.`);
  }
  return value.toLowerCase();
}

export function parseClientPurgeTarget(value: string) {
  return uuid(value, 'Le client');
}

function confirmation(body: Record<string, unknown>) {
  const exactEmail = typeof body.exactEmail === 'string' ? body.exactEmail : '';
  const currentPassword =
    typeof body.currentPassword === 'string' ? body.currentPassword : '';
  if (
    exactEmail !== exactEmail.trim() ||
    exactEmail.length < 3 ||
    exactEmail.length > 254
  ) {
    throw new ClientPurgeValidationError(
      'Saisissez exactement l’adresse e-mail du client.',
    );
  }
  if (currentPassword.length < 8 || currentPassword.length > 1_024) {
    throw new ClientPurgeValidationError('Le mot de passe actuel est requis.');
  }
  return { exactEmail, currentPassword };
}

export function parseClientPurgePreview(value: unknown) {
  const body = record(value);
  onlyKeys(body, ['idempotencyKey']);
  return {
    idempotencyKey: uuid(body.idempotencyKey, 'La clé de sécurité'),
  };
}

export function parseClientPurgeExecution(value: unknown) {
  const body = record(value);
  onlyKeys(body, [
    'challengeId',
    'idempotencyKey',
    'challengeToken',
    'exactEmail',
    'currentPassword',
  ]);
  const challengeToken =
    typeof body.challengeToken === 'string' ? body.challengeToken : '';
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(challengeToken)) {
    throw new ClientPurgeValidationError('Le défi de sécurité est invalide.');
  }
  const credentials = confirmation(body);

  return {
    challengeId: uuid(body.challengeId, 'Le défi de sécurité'),
    idempotencyKey: uuid(body.idempotencyKey, 'La clé de sécurité'),
    challengeToken,
    ...credentials,
  };
}

export function parseClientPurgeResume(value: unknown) {
  const body = record(value);
  onlyKeys(body, ['resume', 'exactEmail', 'currentPassword']);
  if (body.resume !== true) {
    throw new ClientPurgeValidationError('La reprise demandée est invalide.');
  }
  return { resume: true as const, ...confirmation(body) };
}

export function storageChunks(paths: Iterable<string>, size = 1_000) {
  if (!Number.isInteger(size) || size < 1 || size > 1_000) {
    throw new RangeError('Storage removal batches must contain 1..1000 paths.');
  }
  const exactPaths = [
    ...new Set(
      [...paths].map((path) => {
        const segments = path.split('/');
        if (
          path.length < 1 ||
          path.length > 500 ||
          path.includes('\0') ||
          path.startsWith('/') ||
          segments.some((segment) => segment === '.' || segment === '..')
        ) {
          throw new RangeError('Unsafe Storage object path.');
        }
        return path;
      }),
    ),
  ];
  const chunks: string[][] = [];
  for (let index = 0; index < exactPaths.length; index += size) {
    chunks.push(exactPaths.slice(index, index + size));
  }
  return chunks;
}

export function manifestChunks<Value>(values: readonly Value[], size = 1_000) {
  if (!Number.isInteger(size) || size < 1 || size > 1_000) {
    throw new RangeError('Manifest batches must contain 1..1000 entries.');
  }
  const chunks: Value[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function isClientOwnedStoragePath(
  targetUserId: string,
  objectPath: string,
) {
  try {
    storageChunks([objectPath]);
  } catch {
    return false;
  }
  return objectPath.startsWith(`${targetUserId}/`);
}

export function validateClientPurgeStorageReference(
  targetUserId: string,
  reference: ClientPurgeStorageReference,
): asserts reference is ClientPurgeStorageReference & {
  bucket: ClientPurgeStorageBucket;
  ownershipScope: ClientPurgeStorageOwnershipScope;
  ownershipValid: true;
} {
  if (
    !CLIENT_PURGE_STORAGE_BUCKETS.includes(
      reference.bucket as ClientPurgeStorageBucket,
    ) ||
    reference.ownershipValid !== true
  ) {
    throw new ClientPurgeOwnershipError();
  }

  if (reference.ownershipScope === 'target_prefix') {
    if (
      !CLIENT_PURGE_PREFIX_STORAGE_BUCKETS.includes(
        reference.bucket as (typeof CLIENT_PURGE_PREFIX_STORAGE_BUCKETS)[number],
      ) ||
      !isClientOwnedStoragePath(targetUserId, reference.objectPath)
    ) {
      throw new ClientPurgeOwnershipError();
    }
    return;
  }

  if (
    reference.ownershipScope !== 'relational' ||
    reference.bucket !== 'external-execution-evidence'
  ) {
    throw new ClientPurgeOwnershipError();
  }
  try {
    storageChunks([reference.objectPath]);
  } catch {
    throw new ClientPurgeOwnershipError();
  }
}
