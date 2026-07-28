import type { EmailOtpType } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import {
  configuredServerAppOrigin,
  safeInternalPath,
} from '@/lib/security/navigation';
import { noStoreRedirect } from '@/lib/security/server-redirect';
import { createClient } from '@/lib/supabase/server';

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'email_change',
  'invite',
  'magiclink',
  'recovery',
  'signup',
]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const rawType = request.nextUrl.searchParams.get('type');
  const type =
    rawType && EMAIL_OTP_TYPES.has(rawType as EmailOtpType)
      ? (rawType as EmailOtpType)
      : null;
  const defaultNext = type === 'recovery' ? '/reset-pin?mode=update' : '/onboarding';
  const next = safeInternalPath(request.nextUrl.searchParams.get('next'), defaultNext);
  const redirectOrigin = configuredServerAppOrigin(request.nextUrl.origin);

  if (!redirectOrigin) {
    return new Response('APP_ORIGIN is required in production.', { status: 500 });
  }

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) return noStoreRedirect(new URL(next, redirectOrigin));
  }

  const errorPath =
    type === 'recovery'
      ? '/reset-pin?error=recovery_session'
      : '/login?error=auth_confirmation';
  return noStoreRedirect(new URL(errorPath, redirectOrigin));
}
