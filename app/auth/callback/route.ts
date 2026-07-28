import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  configuredServerAppOrigin,
  safeInternalPath,
} from '@/lib/security/navigation';
import { noStoreRedirect } from '@/lib/security/server-redirect';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeInternalPath(requestUrl.searchParams.get('next'), '/myaccount');
  const redirectOrigin = configuredServerAppOrigin(request.nextUrl.origin);
  if (!redirectOrigin) {
    return new Response('APP_ORIGIN is required in production.', { status: 500 });
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return noStoreRedirect(new URL(next, redirectOrigin));
  }

  return noStoreRedirect(new URL('/login?error=auth_callback', redirectOrigin));
}
