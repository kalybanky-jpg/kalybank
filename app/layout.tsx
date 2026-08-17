import './globals.css';
import { cookies, headers } from 'next/headers';
import type { Metadata, Viewport } from 'next';
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
import { getRequestBrandSettings } from '@/lib/server/branding';
import LegalFooter from '@/components/legal/LegalFooter';

const metadataOrigin =
  safeHttpOrigin(process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN) ??
  (process.env.NODE_ENV === 'production'
    ? 'https://monalyz.com'
    : 'http://127.0.0.1:3000');

const description =
  'Instructions, contrôles et traçabilité d’opérations financières exécutées hors application.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Keep the full application inside the device safe area. The floating chat
  // launcher still adds env(safe-area-inset-*) spacing where it is available.
  viewportFit: 'contain',
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getRequestBrandSettings();
  return {
    metadataBase: new URL(metadataOrigin),
    applicationName: brand.bankName,
    title: {
      default: brand.bankName,
      template: `%s | ${brand.bankName}`,
    },
    description,
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: brand.faviconIcoUrl, sizes: '16x16 32x32 48x48' },
        { url: brand.favicon16Url, type: 'image/png', sizes: '16x16' },
        { url: brand.favicon32Url, type: 'image/png', sizes: '32x32' },
        { url: brand.favicon48Url, type: 'image/png', sizes: '48x48' },
      ],
      apple: [
        { url: brand.appleTouchIconUrl, type: 'image/png', sizes: '180x180' },
      ],
    },
    openGraph: {
      type: 'website',
      siteName: brand.bankName,
      title: brand.bankName,
      description,
      images: [
        {
          url: brand.socialCardUrl,
          width: 1200,
          height: 630,
          alt: brand.bankName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: brand.bankName,
      description,
      images: [brand.socialCardUrl],
    },
  };
}

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
  const initialBrand = await getRequestBrandSettings();

  return (
    <html lang={initialLanguage.language}>
      <body suppressHydrationWarning>
        <Providers
          initialLanguage={initialLanguage.language}
          initialLanguageSource={initialLanguage.source}
          initialBrand={initialBrand}
        >
          {children}
          <LegalFooter bankName={initialBrand.bankName} />
        </Providers>
      </body>
    </html>
  );
}
