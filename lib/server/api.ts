import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicSupabaseConfig } from '../supabase/config';
import type { Database } from '../supabase/database.types';

export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

export function isSameOriginMutation(request: NextRequest) {
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
