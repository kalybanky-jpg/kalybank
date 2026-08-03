import { NextResponse, type NextRequest } from 'next/server';
import {
  renderSupabaseAuthEmails,
  sendSupabaseAuthEmails,
  verifySupabaseAuthWebhook,
  type SupabaseAuthEmailPayload,
} from '@/lib/server/auth-email';
import { resolveBrandSettings } from '@/lib/server/branding';
import { getTransactionalEmailConfig } from '@/lib/server/transactional-email';
import { createPrivilegedClient } from '@/lib/server/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_HOOK_BYTES = 512 * 1024;

function hookError(status: number, message: string) {
  return NextResponse.json(
    { error: { http_code: status, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function requiredSecret(name: string) {
  const value = process.env[name]?.trim();
  if (!value || /replace|changeme|your[-_]/i.test(value)) {
    throw new Error(`Configuration Auth Hook manquante : ${name}.`);
  }
  return value;
}

function privilegedClient() {
  return createPrivilegedClient(
    'Configuration Auth Hook manquante : SUPABASE_SECRET_KEY.',
  );
}

function applicationOrigin(request: NextRequest) {
  const raw =
    process.env.APP_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() ||
    request.nextUrl.origin;
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Origine applicative invalide.');
  }
  return url.origin;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_HOOK_BYTES) {
    return hookError(413, 'Payload Auth Hook trop volumineux.');
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return hookError(400, 'Payload Auth Hook illisible.');
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_HOOK_BYTES) {
    return hookError(413, 'Payload Auth Hook trop volumineux.');
  }

  const webhookId = request.headers.get('webhook-id')?.trim() ?? '';
  const webhookTimestamp = request.headers.get('webhook-timestamp')?.trim() ?? '';
  const webhookSignature = request.headers.get('webhook-signature')?.trim() ?? '';
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return hookError(401, 'Signature Auth Hook absente.');
  }

  let payload: SupabaseAuthEmailPayload;
  try {
    payload = verifySupabaseAuthWebhook(rawBody, {
      'webhook-id': webhookId,
      'webhook-timestamp': webhookTimestamp,
      'webhook-signature': webhookSignature,
    }, requiredSecret('SEND_EMAIL_HOOK_SECRET'));
  } catch {
    return hookError(401, 'Signature Auth Hook invalide.');
  }

  try {
    const worker = privilegedClient();
    const [brand, languageResult] = await Promise.all([
      resolveBrandSettings(worker),
      typeof payload.user?.id === 'string'
        ? worker
            .from('profiles')
            .select('preferred_language')
            .eq('user_id', payload.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const config = getTransactionalEmailConfig();
    const messages = renderSupabaseAuthEmails(
      payload,
      brand,
      applicationOrigin(request),
      languageResult.data?.preferred_language,
    );
    await sendSupabaseAuthEmails(messages, config, brand, webhookId);
    return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return hookError(
      500,
      error instanceof Error
        ? error.message.slice(0, 500)
        : 'Échec de traitement Auth Hook.',
    );
  }
}
