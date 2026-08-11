import type { NextRequest } from 'next/server';
import {
  CLIENT_PURGE_MAX_BODY_LENGTH,
  ClientPurgeValidationError,
  parseClientPurgePreview,
  parseClientPurgeTarget,
} from '@/lib/client-purge';
import { isSameOriginMutation, noStoreJson } from '@/lib/server/api';
import {
  createClientPurgeRequestSignal,
  preparePurge,
  requireActiveAdmin,
} from '@/lib/server/client-purge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ userId: string }> };

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
    const input = parseClientPurgePreview(JSON.parse(rawBody) as unknown);
    const preview = await preparePurge(
      access.admin,
      targetUserId,
      input.idempotencyKey,
    );
    return noStoreJson(preview, preview.pending ? 202 : 200);
  } catch (error) {
    if (
      error instanceof ClientPurgeValidationError ||
      error instanceof SyntaxError
    ) {
      return noStoreJson({ error: error.message }, 400);
    }
    const code = error instanceof Error ? error.message : '';
    if (code === 'SELF_PURGE_FORBIDDEN' || code === 'STAFF_PURGE_FORBIDDEN') {
      return noStoreJson({ error: 'Ce compte ne peut pas être supprimé.' }, 403);
    }
    if (code === 'CLIENT_NOT_FOUND') {
      return noStoreJson({ error: 'Client introuvable.' }, 404);
    }
    if (code.includes('PURGE_ALREADY_STARTED')) {
      return noStoreJson(
        { error: 'Une suppression existe déjà pour ce client.' },
        409,
      );
    }
    return noStoreJson({ error: 'Aperçu de suppression indisponible.' }, 503);
  }
}
