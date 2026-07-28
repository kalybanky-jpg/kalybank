import './globals.css';
import { cookies, headers } from 'next/headers';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import {
  LANGUAGE_COOKIE,
  LANGUAGE_SOURCE_COOKIE,
  parseAcceptLanguage,
  resolveInitialLanguage,
} from '@/lib/language';
import { isPublicSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: {
    default: 'Monalyz',
    template: '%s | Monalyz',
  },
  description:
    'Instructions, contrôles et traçabilité d’opérations financières exécutées hors application.',
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  // Nonce-based CSP requires every HTML response to be rendered with the
  // per-request nonce injected by proxy.ts.
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  let profileLanguage: string | null = null;

  if (isPublicSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!error) profileLanguage = profile?.preferred_language ?? null;
      }
    } catch {
      // A transient profile read must not prevent public pages from rendering.
      // The client will retry profile hydration through its normal data refresh.
    }
  }

  const initialLanguage = resolveInitialLanguage({
    profileLanguage,
    cookieLanguage: cookieStore.get(LANGUAGE_COOKIE)?.value,
    cookieSource: cookieStore.get(LANGUAGE_SOURCE_COOKIE)?.value,
    acceptedLanguages: parseAcceptLanguage(requestHeaders.get('accept-language')),
  });

  return (
    <html lang={initialLanguage.language}>
      <body>
        <Providers
          initialLanguage={initialLanguage.language}
          initialLanguageSource={initialLanguage.source}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
