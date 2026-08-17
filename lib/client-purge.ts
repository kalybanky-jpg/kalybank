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

export function parseClientPurgePreview(value: unknown) {
  const body = record(value);
  onlyKeys(body, ['idempotencyKey']);
  return {
    idempotencyKey: uuid(body.idempotencyKey, 'La clé de sécurité'),
  };
}

export function parseClientPurgeExecution(value: unknown) {
  const body = record(value);
  onlyKeys(body, ['challengeId', 'idempotencyKey', 'challengeToken']);
  const challengeToken =
    typeof body.challengeToken === 'string' ? body.challengeToken : '';
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(challengeToken)) {
    throw new ClientPurgeValidationError('Le défi de sécurité est invalide.');
  }
  return {
    challengeId: uuid(body.challengeId, 'Le défi de sécurité'),
    idempotencyKey: uuid(body.idempotencyKey, 'La clé de sécurité'),
    challengeToken,
  };
}

export function parseClientPurgeResume(value: unknown) {
  const body = record(value);
  onlyKeys(body, ['resume']);
  if (body.resume !== true) {
    throw new ClientPurgeValidationError('La reprise demandée est invalide.');
  }
  return { resume: true as const };
}

type AutomaticPurgePreview = {
  challengeId: string;
  pending?: boolean;
};

type AutomaticPurgeOutcome = {
  deleted?: boolean;
  authDeleted?: boolean;
  status: string;
  canResume?: boolean;
  workKind?: string;
};

export function createClientPurgeChallengeGuard() {
  const challengesInFlight = new Set<string>();

  return async function runOnceForChallenge<Result>(
    challengeId: string,
    action: () => Promise<Result>,
  ) {
    if (challengesInFlight.has(challengeId)) {
      throw new Error('Ce défi de suppression est déjà en cours.');
    }
    challengesInFlight.add(challengeId);
    try {
      return await action();
    } finally {
      challengesInFlight.delete(challengeId);
    }
  };
}

export async function continueClientPurgeAutomatically<
  Outcome extends AutomaticPurgeOutcome,
>(
  initial: Outcome,
  callbacks: {
    resume: () => Promise<Outcome>;
    wait: () => Promise<void>;
    onOutcome?: (outcome: Outcome) => void;
  },
) {
  let outcome = initial;
  callbacks.onOutcome?.(outcome);

  while (
    !outcome.deleted &&
    !outcome.authDeleted &&
    outcome.status !== 'waiting_sweep'
  ) {
    if (outcome.workKind === 'wait') return outcome;
    if (outcome.status !== 'processing' && !outcome.canResume) {
      throw new Error('La suppression ne peut pas être reprise immédiatement.');
    }
    await callbacks.wait();
    outcome = await callbacks.resume();
    callbacks.onOutcome?.(outcome);
  }

  return outcome;
}

export async function runClientPurgeAutomaticFlow<
  Preview extends AutomaticPurgePreview,
  Outcome extends AutomaticPurgeOutcome,
>(callbacks: {
  startPreview: () => Promise<Preview>;
  continuePreview: () => Promise<Preview>;
  commit: (preview: Preview) => Promise<Outcome>;
  resume: () => Promise<Outcome>;
  wait: (phase: 'preview' | 'resume') => Promise<void>;
  runChallenge: <Result>(
    challengeId: string,
    action: () => Promise<Result>,
  ) => Promise<Result>;
  onPreview?: (preview: Preview) => void;
  onOutcome?: (outcome: Outcome) => void;
}) {
  let preview = await callbacks.startPreview();
  callbacks.onPreview?.(preview);

  while (preview.pending) {
    await callbacks.wait('preview');
    preview = await callbacks.continuePreview();
    callbacks.onPreview?.(preview);
  }

  return callbacks.runChallenge(preview.challengeId, async () => {
    const initial = await callbacks.commit(preview);
    return continueClientPurgeAutomatically(initial, {
      resume: callbacks.resume,
      wait: () => callbacks.wait('resume'),
      onOutcome: callbacks.onOutcome,
    });
  });
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
