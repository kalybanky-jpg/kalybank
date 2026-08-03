import type { NextRequest } from 'next/server';
import {
  getTransactionalEmailConfig,
  parseTransactionalEmailJob,
  resolveTransactionalEmailLanguage,
  sendTransactionalEmail,
} from '@/lib/server/transactional-email';
import {
  createPrivilegedClient,
  isSameOriginMutation,
  noStoreJson,
} from '@/lib/server/api';
import { createClient } from '@/lib/supabase/server';
import { resolveBrandSettings } from '@/lib/server/branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
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
    worker = createPrivilegedClient(
      'Configuration e-mail manquante : SUPABASE_SECRET_KEY.',
    );
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

  const { data: role, error: roleError } = await supabase.rpc('current_app_role');
  if (roleError) {
    return noStoreJson({ error: 'Rôle applicatif indisponible.' }, 403);
  }

  const { data, error: claimError } =
    role === 'admin'
      ? await worker.rpc('claim_transactional_emails', { p_limit: 10 })
      : await worker.rpc('claim_transactional_emails_for_recipient', {
          p_recipient_id: user.id,
          p_limit: 10,
        });
  if (claimError) return noStoreJson({ error: claimError.message }, 400);

  const jobs = (data ?? []).map(parseTransactionalEmailJob);
  const brand = await resolveBrandSettings(worker);
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const language = await resolveTransactionalEmailLanguage(() =>
        worker
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', job.recipient_id)
          .maybeSingle(),
      );
      const providerMessageId = await sendTransactionalEmail(
        job,
        config,
        language,
        fetch,
        {
          bankName: brand.bankName,
          wordmarkUrl: brand.emailLogoUrl,
        },
      );
      const { error } = await worker.rpc('complete_transactional_email', {
        p_email_id: job.id,
        p_claim_token: job.claim_token,
        p_succeeded: true,
        p_provider_message_id: providerMessageId,
        p_error: undefined,
      });
      if (error) throw error;
      sent += 1;
    } catch (error) {
      failed += 1;
      await worker.rpc('complete_transactional_email', {
        p_email_id: job.id,
        p_claim_token: job.claim_token,
        p_succeeded: false,
        p_provider_message_id: undefined,
        p_error:
          error instanceof Error ? error.message : 'Échec d’envoi non détaillé.',
      });
    }
  }

  return noStoreJson({ claimed: jobs.length, sent, failed });
}
