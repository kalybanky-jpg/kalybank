import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicSupabaseConfig } from '../supabase/config';
import type { Database } from '../supabase/database.types';
import { safeHttpOrigin } from '../security/navigation';

export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

export function configuredMutationOrigins(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const candidates = [
    environment.APP_ORIGIN,
    environment.NEXT_PUBLIC_APP_ORIGIN,
    ...(environment.APP_ALLOWED_ORIGINS?.split(',') ?? []),
  ];
  return new Set(
    candidates
      .map((candidate) => safeHttpOrigin(candidate?.trim()))
      .filter((origin): origin is string => Boolean(origin)),
  );
}

export function isAllowedMutationOrigin(
  origin: string | null,
  requestOrigin: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const normalizedOrigin = safeHttpOrigin(origin);
  if (!normalizedOrigin) return false;

  const allowedOrigins = configuredMutationOrigins(environment);
  if (allowedOrigins.size === 0 && environment.NODE_ENV !== 'production') {
    const developmentOrigin = safeHttpOrigin(requestOrigin);
    return Boolean(developmentOrigin && normalizedOrigin === developmentOrigin);
  }

  return allowedOrigins.has(normalizedOrigin);
}

export function isSameOriginMutation(request: NextRequest) {
  return isAllowedMutationOrigin(
    request.headers.get('origin'),
    request.nextUrl.origin,
  );
}

export function createPrivilegedClient(configurationError: string) {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secretKey || /replace|changeme|your[-_]/i.test(secretKey)) {
    throw new Error(configurationError);
  }

  return createSupabaseClient<Database>(
    getPublicSupabaseConfig().url,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
