import type { NextRequest } from 'next/server';
import { createPrivilegedClient, noStoreJson } from '@/lib/server/api';
import { createClient } from '@/lib/supabase/server';
import {
  parseSupportConversationLimit,
  parseSupportConversations,
  SUPPORT_TRANSCRIPT_ADMIN_SELECT,
} from '@/lib/support/transcripts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return noStoreJson({ error: 'Authentification requise.' }, 401);
  }

  const { data: role, error: roleError } = await supabase.rpc(
    'current_app_role',
  );
  if (roleError || role !== 'admin') {
    return noStoreJson({ error: 'Habilitation administrateur requise.' }, 403);
  }

  let worker: ReturnType<typeof createPrivilegedClient>;
  try {
    worker = createPrivilegedClient(
      'SUPABASE_SECRET_KEY est requise pour consulter les conversations.',
    );
  } catch {
    return noStoreJson({ error: 'Le service de support est indisponible.' }, 503);
  }

  const limit = parseSupportConversationLimit(
    request.nextUrl.searchParams.get('limit'),
  );
  const { data, error } = await worker
    .from('support_transcripts')
    .select(SUPPORT_TRANSCRIPT_ADMIN_SELECT)
    .order('event_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(
      JSON.stringify({ event: 'admin_support_conversations_lookup_failed' }),
    );
    return noStoreJson({ error: 'Les conversations sont indisponibles.' }, 503);
  }

  return noStoreJson({ conversations: parseSupportConversations(data) });
}
