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
import { safeHttpOrigin } from '@/lib/security/navigation';

const metadataOrigin =
  safeHttpOrigin(process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN) ??
  (process.env.NODE_ENV === 'production'
    ? 'https://monalyz.com'
    : 'http://127.0.0.1:3000');

export const metadata: Metadata = {
  metadataBase: new URL(metadataOrigin),
  applicationName: 'Monalyz',
  title: {
    default: 'Monalyz',
    template: '%s | Monalyz',
  },
  description:
    'Instructions, contrôles et traçabilité d’opérations financières exécutées hors application.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: '/brand/monalyz/monalyz-favicon.ico',
        sizes: '16x16 32x32 48x48',
      },
      {
        url: '/brand/monalyz/monalyz-favicon-32.png',
        type: 'image/png',
        sizes: '32x32',
      },
    ],
    apple: [
      {
        url: '/brand/monalyz/monalyz-apple-touch-icon-180.png',
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'Monalyz',
    title: 'Monalyz',
    description:
      'Instructions, contrôles et traçabilité d’opérations financières exécutées hors application.',
    images: [
      {
        url: '/brand/monalyz/monalyz-opengraph-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'Monalyz',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monalyz',
    description:
      'Instructions, contrôles et traçabilité d’opérations financières exécutées hors application.',
    images: ['/brand/monalyz/monalyz-twitter-1200x630.png'],
  },
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
