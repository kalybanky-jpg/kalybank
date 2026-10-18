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
import { getRequestBrandSettings } from '@/lib/server/branding';
import LegalFooter from '@/components/legal/LegalFooter';
import { CANONICAL_ORIGIN } from '@/lib/seo';

function formatBankBrand(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().startsWith('bank ') ? trimmed : `Bank ${trimmed}`;
}

const description =
  'Banque en ligne et services financiers sécurisés. Solutions de prêts, financement, investissement, gestion de comptes et virements.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Keep the full application inside the device safe area. The floating chat
  // launcher still adds env(safe-area-inset-*) spacing where it is available.
  viewportFit: 'contain',
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getRequestBrandSettings();
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const brandName = brand.bankName;
  const brandTitle = formatBankBrand(brandName);
  const metaDescription = `Banque en ligne et services financiers sécurisés ${brandTitle}. Solutions de prêts, financement, investissement, gestion de comptes et virements.`;

  return {
    metadataBase: new URL(CANONICAL_ORIGIN),
    applicationName: brandTitle,
    title: {
      default: `${brandTitle} — Banque en Ligne & Services Financiers`,
      template: `%s | ${brandTitle}`,
    },
    description: metaDescription,
    keywords: [
      brandTitle,
      brandName,
      `${brandName} Bank`,
      'banque en ligne',
      'services financiers',
      'prêts en ligne',
      'financement',
      'investissement',
      'plateforme bancaire',
      'espace client bancaire',
      'gestion financière',
      'fintech',
      '2 C FINANCE',
    ],
    manifest: '/manifest.webmanifest',
    category: 'finance',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    verification: googleVerification ? { google: googleVerification } : undefined,
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
    alternates: {
      canonical: CANONICAL_ORIGIN,
    },
    openGraph: {
      type: 'website',
      siteName: brandTitle,
      locale: 'fr_FR',
      url: CANONICAL_ORIGIN,
      title: `${brandTitle} — Banque en Ligne & Services Financiers`,
      description: metaDescription,
      images: [
        {
          url: brand.socialCardUrl,
          width: 1200,
          height: 630,
          alt: brandTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${brandTitle} — Banque en Ligne & Services Financiers`,
      description: metaDescription,
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

  const hasAuthToken = cookieStore.getAll().some((c) => c.name.startsWith('sb-'));

  if (hasAuthToken && isPublicSupabaseConfigured()) {
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
  const initialBrandName = initialBrand.bankName;
  const initialBrandTitle = formatBankBrand(initialBrandName);
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        additionalType: [
          'https://schema.org/FinancialService',
          'https://schema.org/BankOrCreditUnion',
        ],
        '@id': `${CANONICAL_ORIGIN}/#organization`,
        name: initialBrandTitle,
        legalName: '2 C FINANCE',
        alternateName: [
          initialBrandTitle,
          `${initialBrandName} Bank`,
          initialBrandName,
          initialBrandName.toUpperCase(),
        ],
        url: CANONICAL_ORIGIN,
        logo: new URL(initialBrand.primaryLogoUrl, CANONICAL_ORIGIN).toString(),
        description:
          'Banque en ligne et plateforme financière sécurisée proposant des services de prêts, de financement, d’investissement et de gestion bancaire.',
        email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com',
        identifier: [
          { '@type': 'PropertyValue', propertyID: 'SIREN', value: '979 247 145' },
          { '@type': 'PropertyValue', propertyID: 'SIRET', value: '979 247 145 00019' },
        ],
        address: {
          '@type': 'PostalAddress',
          streetAddress: '20 BOULEVARD MONTMARTRE',
          postalCode: '75009',
          addressLocality: 'PARIS',
          addressCountry: 'FR',
        },
        knowsAbout: [
          'Banque en ligne',
          'Services financiers',
          'Prêts et financements',
          'Investissement financier',
          'Gestion de comptes',
          'Virements bancaires',
          'Sécurité financière',
          'Fintech',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${CANONICAL_ORIGIN}/#website`,
        url: CANONICAL_ORIGIN,
        name: initialBrandTitle,
        alternateName: [initialBrandName, `${initialBrandName} Bank`],
        description:
          `Portail web officiel de ${initialBrandTitle}, banque en ligne et services financiers sécurisés.`,
        publisher: { '@id': `${CANONICAL_ORIGIN}/#organization` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${CANONICAL_ORIGIN}/#app`,
        name: initialBrandTitle,
        url: CANONICAL_ORIGIN,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
        },
      },
    ],
  };

  return (
    <html lang={initialLanguage.language}>
      <body suppressHydrationWarning>
        <script
          nonce={requestHeaders.get('x-nonce') ?? undefined}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replaceAll('<', '\\u003c'),
          }}
        />
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
