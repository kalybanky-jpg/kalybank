import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicSupabaseConfig } from './config';
import type { Database } from './database.types';

type ServerClientOptions = {
  fetch?: typeof fetch;
};

export async function createClient(options: ServerClientOptions = {}) {
  const cookieStore = await cookies();
  const { url, publishableKey } = getPublicSupabaseConfig();

  return createServerClient<Database>(url, publishableKey, {
    ...(options.fetch ? { global: { fetch: options.fetch } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies. Middleware refreshes
          // sessions before protected pages are rendered.
        }
      },
    },
  });
}
