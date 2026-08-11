import type { NextRequest } from 'next/server';
import { parseClientPurgeTarget } from '@/lib/client-purge';
import { isSameOriginMutation, noStoreJson } from '@/lib/server/api';
import {
  createClientPurgeRequestSignal,
  recoverPurgePreview,
  requireActiveAdmin,
} from '@/lib/server/client-purge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return noStoreJson({ error: 'Origine refusée.' }, 403);
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return noStoreJson({ error: 'Type de contenu refusé.' }, 415);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: 'Corps de requête invalide.' }, 400);
  }
  if (
    typeof body !== 'object' || body === null || Array.isArray(body)
    || Object.keys(body).length !== 1
    || (body as Record<string, unknown>).continue !== true
  ) {
    return noStoreJson({ error: 'Reprise d’aperçu invalide.' }, 400);
  }
  const access = await requireActiveAdmin(
    createClientPurgeRequestSignal(request.signal),
  );
  if (access.response) return access.response;
  try {
    const targetUserId = parseClientPurgeTarget((await context.params).userId);
    const preview = await recoverPurgePreview(access.admin, targetUserId);
    return noStoreJson(preview, preview.pending ? 202 : 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code.includes('NOT_FOUND') || code.includes('EXPIRED')) {
      return noStoreJson({ error: 'Aperçu introuvable ou expiré.' }, 404);
    }
    if (code.includes('EMAIL_CHANGED')) {
      return noStoreJson(
        { error: 'L’e-mail Auth a changé. Recréez un aperçu avant toute suppression.' },
        409,
      );
    }
    return noStoreJson({ error: 'Reprise de l’aperçu indisponible.' }, 503);
  }
}
