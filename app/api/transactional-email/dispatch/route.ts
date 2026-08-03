import type { NextRequest } from 'next/server';
import {
  getTransactionalEmailConfig,
} from '@/lib/server/transactional-email';
import {
  createTransactionalEmailPrivilegedClient,
  dispatchTransactionalEmailBatch,
  TRANSACTIONAL_EMAIL_BROWSER_BATCH_SIZE,
} from '@/lib/server/transactional-email-dispatch';
import {
  isSameOriginMutation,
  noStoreJson,
} from '@/lib/server/api';
import { createClient } from '@/lib/supabase/server';

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
    worker = createTransactionalEmailPrivilegedClient();
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

  try {
    const result = await dispatchTransactionalEmailBatch({
      client: worker,
      config,
      limit: TRANSACTIONAL_EMAIL_BROWSER_BATCH_SIZE,
      recipientId: role === 'admin' ? undefined : user.id,
    });
    return noStoreJson({
      claimed: result.claimed,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Dispatch des e-mails impossible.',
      },
      400,
    );
  }
}
