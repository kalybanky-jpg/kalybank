import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import {
  AdminCredentialValidationError,
  parseAdminCredentialChange,
} from '@/lib/admin-credentials';
import {
  createPrivilegedClient,
  isSameOriginMutation,
  noStoreJson,
} from '@/lib/server/api';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_REQUEST_BODY_LENGTH = 4_096;

async function currentAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: noStoreJson({ error: 'Authentification requise.' }, 401) };
  }

  const { data: role, error: roleError } = await supabase.rpc('current_app_role');
  if (roleError || role !== 'admin') {
    return {
      response: noStoreJson(
        { error: 'Habilitation administrateur requise.' },
        403,
      ),
    };
  }

  if (!user.email) {
    return {
      response: noStoreJson(
        { error: 'Aucune adresse e-mail n’est associée à ce compte.' },
        409,
      ),
    };
  }

  return { supabase, user, email: user.email, response: null };
}

export async function GET() {
  const admin = await currentAdmin();
  if (admin.response) return admin.response;
  return noStoreJson({ email: admin.email }, 200);
}

export async function PUT(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return noStoreJson({ error: 'Origine refusée.' }, 403);
  }

  const admin = await currentAdmin();
  if (admin.response) return admin.response;

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return noStoreJson({ error: 'Type de contenu refusé.' }, 415);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return noStoreJson({ error: 'Corps de requête illisible.' }, 400);
  }
  if (rawBody.length > MAX_REQUEST_BODY_LENGTH) {
    return noStoreJson({ error: 'Corps de requête trop volumineux.' }, 413);
  }

  let change;
  try {
    change = parseAdminCredentialChange(
      JSON.parse(rawBody) as unknown,
      admin.email,
    );
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof AdminCredentialValidationError
            ? error.message
            : 'Corps JSON invalide.',
      },
      400,
    );
  }

  const { url, publishableKey } = getPublicSupabaseConfig();
  const verifier = createSupabaseClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data: verified, error: verificationError } =
    await verifier.auth.signInWithPassword({
      email: admin.email,
      password: change.currentPassword,
    });
  const verifiedCurrentAdmin =
    !verificationError && verified.user?.id === admin.user.id;
  if (verified.session) {
    await verifier.auth.signOut({ scope: 'local' });
  }
  if (!verifiedCurrentAdmin) {
    return noStoreJson({ error: 'Le mot de passe actuel est incorrect.' }, 400);
  }

  let worker;
  try {
    worker = createPrivilegedClient(
      'SUPABASE_SECRET_KEY est requise pour modifier les identifiants.',
    );
  } catch {
    return noStoreJson(
      { error: 'Le service d’authentification est indisponible.' },
      503,
    );
  }

  const attributes =
    change.kind === 'email'
      ? { email: change.email, email_confirm: true }
      : { password: change.newPassword };
  const { error: updateError } = await worker.auth.admin.updateUserById(
    admin.user.id,
    attributes,
  );
  if (updateError) {
    const duplicateEmail =
      updateError.code === 'email_exists' ||
      updateError.code === 'user_already_exists';
    console.error(
      JSON.stringify({
        event: 'admin_credentials_update_failed',
        code: updateError.code ?? 'auth_update_failed',
        status: updateError.status,
      }),
    );
    return noStoreJson(
      {
        error: duplicateEmail
          ? 'Cette adresse e-mail est déjà utilisée.'
          : 'La modification des identifiants a échoué.',
      },
      duplicateEmail ? 409 : 400,
    );
  }

  const { error: auditError } = await worker.rpc(
    'record_admin_credentials_update',
    {
      p_actor_id: admin.user.id,
      p_email_changed: change.kind === 'email',
      p_password_changed: change.kind === 'password',
    },
  );
  if (auditError) {
    console.warn(JSON.stringify({ event: 'admin_credentials_audit_failed' }));
  }

  await admin.supabase.auth.signOut({ scope: 'global' });
  return noStoreJson({ updated: true, change: change.kind }, 200);
}
