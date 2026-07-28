import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  getTransactionalEmailConfig,
  sendTransactionalEmail,
  type TransactionalEmailJob,
} from '@/lib/server/transactional-email';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  const canonicalOrigin =
    process.env.APP_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    (process.env.NODE_ENV === 'development' ? request.nextUrl.origin : null);
  if (!origin || !canonicalOrigin) return false;
  try {
    return new URL(origin).origin === new URL(canonicalOrigin).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return noStoreJson({ error: 'Origine refusée.' }, 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return noStoreJson({ error: 'Authentification requise.' }, 401);
  }

  let config;
  let worker;
  try {
    config = getTransactionalEmailConfig();
    const serviceRoleKey =
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (
      !serviceRoleKey ||
      /replace|changeme|your[-_]/i.test(serviceRoleKey)
    ) {
      throw new Error(
        'Configuration e-mail manquante : SUPABASE_SECRET_KEY.',
      );
    }
    const { url } = getPublicSupabaseConfig();
    worker = createSupabaseClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Fournisseur e-mail non configuré.',
      },
      503,
    );
  }

  const { data, error: claimError } = await worker.rpc(
    'claim_transactional_emails',
    { p_limit: 10 },
  );
  if (claimError) return noStoreJson({ error: claimError.message }, 400);

  const jobs = (data ?? []) as TransactionalEmailJob[];
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const providerMessageId = await sendTransactionalEmail(job, config);
      const { error } = await worker.rpc('complete_transactional_email', {
        p_email_id: job.id,
        p_claim_token: job.claim_token,
        p_succeeded: true,
        p_provider_message_id: providerMessageId,
        p_error: null,
      });
      if (error) throw error;
      sent += 1;
    } catch (error) {
      failed += 1;
      await worker.rpc('complete_transactional_email', {
        p_email_id: job.id,
        p_claim_token: job.claim_token,
        p_succeeded: false,
        p_provider_message_id: null,
        p_error:
          error instanceof Error ? error.message : 'Échec d’envoi non détaillé.',
      });
    }
  }

  return noStoreJson({ claimed: jobs.length, sent, failed });
}
