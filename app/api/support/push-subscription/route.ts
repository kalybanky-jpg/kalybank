import type { NextRequest } from 'next/server';
import { isSameOriginMutation, noStoreJson } from '@/lib/server/api';
import { parsePushRegistrationPayload } from '@/lib/support/push-registration';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const MAX_BODY_LENGTH = 16_384;

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return noStoreJson({ error: 'forbidden' }, 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return noStoreJson({ error: 'unauthorized' }, 401);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return noStoreJson({ error: 'invalid_request' }, 400);
  }
  if (!rawBody || rawBody.length > MAX_BODY_LENGTH) {
    return noStoreJson({ error: 'invalid_request' }, 400);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return noStoreJson({ error: 'invalid_request' }, 400);
  }
  const subscription = parsePushRegistrationPayload(parsedBody);
  if (!subscription) {
    return noStoreJson({ error: 'invalid_request' }, 400);
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 512) || undefined;
  const { error } = await supabase.rpc('register_push_subscription', {
    p_expected_user_id: user.id,
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth_key: subscription.authKey,
    ...(subscription.expirationTime === null
      ? {}
      : { p_expiration_time: subscription.expirationTime }),
    ...(userAgent ? { p_user_agent: userAgent } : {}),
  });

  if (error) {
    return noStoreJson({ error: 'registration_failed' }, 409);
  }
  return noStoreJson({ registered: true });
}
