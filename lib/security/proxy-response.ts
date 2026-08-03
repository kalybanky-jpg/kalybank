import type { CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export type SupabaseCookieMutation = Readonly<{
  name: string;
  value: string;
  options: CookieOptions;
}>;

export type SupabaseResponseMutations = Readonly<{
  cookies: readonly SupabaseCookieMutation[];
  headers: readonly (readonly [name: string, value: string])[];
}>;

export const EMPTY_SUPABASE_RESPONSE_MUTATIONS: SupabaseResponseMutations = {
  cookies: [],
  headers: [],
};

/**
 * Records the response mutations emitted by `@supabase/ssr` without changing
 * either input. Keeping this state independent from a specific NextResponse
 * lets the proxy replay it on a redirect selected after token refresh.
 */
export function recordSupabaseResponseMutations(
  current: SupabaseResponseMutations,
  cookies: readonly SupabaseCookieMutation[],
  headers: Readonly<Record<string, string>>,
): SupabaseResponseMutations {
  return {
    cookies: [
      ...current.cookies,
      ...cookies.map((cookie) => ({
        ...cookie,
        options: { ...cookie.options },
      })),
    ],
    headers: [...current.headers, ...Object.entries(headers)],
  };
}

export function applySupabaseResponseMutations(
  response: NextResponse,
  mutations: SupabaseResponseMutations,
) {
  mutations.cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  mutations.headers.forEach(([name, value]) => {
    response.headers.set(name, value);
  });
  return response;
}
