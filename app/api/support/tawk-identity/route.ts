import type { NextRequest } from 'next/server';
import { noStoreJson } from '@/lib/server/api';
import {
  createTawkIdentityPayload,
  getTawkServerConfig,
  selectTawkLocale,
} from '@/lib/support/tawk-server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authenticationError,
    } = await supabase.auth.getUser();

    if (authenticationError || !user) {
      return noStoreJson({ error: 'unauthorized' }, 401);
    }
    if (!user.email?.trim()) {
      return noStoreJson({ error: 'identity_incomplete' }, 422);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name,preferred_language')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      return noStoreJson({ error: 'support_unavailable' }, 503);
    }

    const requestedLanguage = request.nextUrl.searchParams.get('language');
    const locale = selectTawkLocale(
      requestedLanguage,
      profile?.preferred_language,
    );
    const identity = createTawkIdentityPayload(
      {
        userId: user.id,
        email: user.email,
        name: profile?.display_name,
        locale,
      },
      getTawkServerConfig(),
    );

    return noStoreJson(identity);
  } catch {
    return noStoreJson({ error: 'support_unavailable' }, 503);
  }
}
