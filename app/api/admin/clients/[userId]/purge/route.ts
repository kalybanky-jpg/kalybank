import type { NextRequest } from 'next/server';
import {
  CLIENT_PURGE_MAX_BODY_LENGTH,
  ClientPurgeValidationError,
  parseClientPurgeExecution,
  parseClientPurgeResume,
  parseClientPurgeTarget,
} from '@/lib/client-purge';
import { isSameOriginMutation, noStoreJson } from '@/lib/server/api';
import {
  authoritativeClient,
  authorizePurgeResume,
  createClientPurgeRequestSignal,
  digest,
  executePurge,
  purgeStatus,
  requireActiveAdmin,
} from '@/lib/server/client-purge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ userId: string }> };

const INTERACTIVE_PURGE_BATCH_LIMIT = 25;
const INTERACTIVE_PURGE_BUDGET_MS = 12_000;

async function continueWithinInteractiveBudget(
  initial: Awaited<ReturnType<typeof executePurge>>,
  input: {
    admin: Parameters<typeof executePurge>[0]['admin'];
    targetUserId: string;
    challengeId: string;
  },
) {
  let outcome = initial;
  const deadline = Date.now() + INTERACTIVE_PURGE_BUDGET_MS;
  let batches = 1;
  while (
    !outcome.deleted &&
    outcome.status !== 'waiting_sweep' &&
    outcome.workKind !== 'wait' &&
    batches < INTERACTIVE_PURGE_BATCH_LIMIT &&
    Date.now() < deadline
  ) {
    outcome = await executePurge({
      ...input,
      startState: {
        status: 'running',
        stage: outcome.stage,
        sweepNotBefore: null,
      },
      leaseAlreadyAcquired: true,
    });
    batches += 1;
  }
  return outcome;
}

function purgeErrorResponse(error: unknown) {
  if (
    error instanceof ClientPurgeValidationError ||
    error instanceof SyntaxError
  ) {
    return noStoreJson({ error: error.message }, 400);
  }
  const code = error instanceof Error ? error.message : '';
  if (
    code.includes('CHALLENGE') ||
    code.includes('PURGE_TARGET_EMAIL_CHANGED') ||
    code.includes('PURGE_RESUME_INVALID') ||
    code.includes('PURGE_OPERATION_IN_PROGRESS')
  ) {
    return noStoreJson(
      { error: 'Cette demande a expiré, est en cours ou ne peut pas être reprise.' },
      409,
    );
  }
  if (code.includes('PURGE_PREVIEW_STALE')) {
    return noStoreJson(
      {
        error:
          'Les données du client ont changé depuis l’aperçu. Fermez puis rouvrez la suppression pour confirmer le nouveau périmètre.',
      },
      409,
    );
  }
  if (code === 'SELF_PURGE_FORBIDDEN' || code === 'STAFF_PURGE_FORBIDDEN') {
    return noStoreJson({ error: 'Ce compte ne peut pas être supprimé.' }, 403);
  }
  if (code === 'CLIENT_NOT_FOUND' || code === 'PURGE_OPERATION_NOT_FOUND') {
    return noStoreJson({ error: 'Client ou suppression introuvable.' }, 404);
  }
  if (code === 'STORAGE_OWNERSHIP_ANOMALY') {
    return noStoreJson(
      {
        error:
          'Une référence de fichier étrangère au client a été détectée. Aucun fichier n’a été supprimé.',
      },
      409,
    );
  }
  return noStoreJson(
    {
      error:
        'Suppression interrompue en sécurité. Le compte reste gelé et la reprise est disponible.',
    },
    503,
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireActiveAdmin(
    createClientPurgeRequestSignal(request.signal),
  );
  if (access.response) return access.response;
  try {
    const targetUserId = parseClientPurgeTarget((await context.params).userId);
    const state = await purgeStatus(access.admin, targetUserId);
    if (!state) {
      return noStoreJson({ error: 'Suppression introuvable.' }, 404);
    }
    return noStoreJson(state, 200);
  } catch (error) {
    return purgeErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return noStoreJson({ error: 'Origine refusée.' }, 403);
  }
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    return noStoreJson({ error: 'Type de contenu refusé.' }, 415);
  }
  const requestSignal = createClientPurgeRequestSignal(request.signal);
  const access = await requireActiveAdmin(requestSignal);
  if (access.response) return access.response;

  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return noStoreJson({ error: 'Corps de requête illisible.' }, 400);
  }
  if (rawBody.length > CLIENT_PURGE_MAX_BODY_LENGTH) {
    return noStoreJson({ error: 'Corps de requête trop volumineux.' }, 413);
  }

  try {
    const targetUserId = parseClientPurgeTarget((await context.params).userId);
    const body = JSON.parse(rawBody) as unknown;
    const resume =
      typeof body === 'object' &&
      body !== null &&
      !Array.isArray(body) &&
      (body as Record<string, unknown>).resume === true;

    if (resume) {
      parseClientPurgeResume(body);
      const state = await authorizePurgeResume(
        access.admin,
        targetUserId,
      );
      if (!state.challengeId) throw new Error('PURGE_OPERATION_NOT_FOUND');
      const firstResult = await executePurge({
        admin: access.admin,
        targetUserId,
        challengeId: state.challengeId!,
        startState: state,
        leaseAlreadyAcquired: state.status !== 'waiting_sweep',
      });
      const result = await continueWithinInteractiveBudget(firstResult, {
        admin: access.admin,
        targetUserId,
        challengeId: state.challengeId,
      });
      return noStoreJson(result, result.deleted ? 200 : 202);
    }

    const input = parseClientPurgeExecution(body);
    const target = await authoritativeClient(access.admin, targetUserId);
    const firstResult = await executePurge({
      admin: access.admin,
      targetUserId,
      challengeId: input.challengeId,
      challengeDigest: digest(input.challengeToken),
      emailDigest: digest(target.email!),
      idempotencyKey: input.idempotencyKey,
    });
    const result = await continueWithinInteractiveBudget(firstResult, {
      admin: access.admin,
      targetUserId,
      challengeId: input.challengeId,
    });
    return noStoreJson(result, result.deleted ? 200 : 202);
  } catch (error) {
    return purgeErrorResponse(error);
  }
}
