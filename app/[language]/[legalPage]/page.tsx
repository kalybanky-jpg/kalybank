import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalDocument from '@/components/legal/LegalDocument';
import { getLegalPage, interpolateLegalText } from '@/lib/legal-i18n';
import { isSupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/language';
import { getRequestBrandSettings } from '@/lib/server/branding';
import {
  absoluteUrl,
  LEGAL_PAGE_BY_SLUG,
  LEGAL_SLUGS,
  localizedLegalAlternates,
  localizedLegalPath,
} from '@/lib/seo';
import type { LegalPageKey } from '@/lib/legal-i18n';
import type { Language } from '@/lib/types';

interface LocalizedLegalPageProps {
  params: Promise<{ language: string; legalPage: string }>;
}

function formatBankBrand(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().startsWith('bank ') ? trimmed : `Bank ${trimmed}`;
}

function resolveParams(language: string, legalPage: string): {
  language: Language;
  page: LegalPageKey;
} {
  const page = LEGAL_PAGE_BY_SLUG[legalPage];
  if (!isSupportedLanguage(language) || !page) notFound();
  return { language, page };
}

export function generateStaticParams() {
  return SUPPORTED_LANGUAGES.flatMap((language) =>
    Object.values(LEGAL_SLUGS).map((legalPage) => ({ language, legalPage })),
  );
}

export async function generateMetadata({ params }: LocalizedLegalPageProps): Promise<Metadata> {
  const requested = await params;
  const { language, page } = resolveParams(requested.language, requested.legalPage);
  const copy = getLegalPage(language, page);
  const { bankName } = await getRequestBrandSettings();
  const brandTitle = formatBankBrand(bankName);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';
  const description = interpolateLegalText(copy.description, brandTitle, supportEmail);
  const canonicalUrl = absoluteUrl(localizedLegalPath(language, page));
  const pageTitle = `${copy.title} | ${brandTitle}`;

  return {
    title: copy.title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: localizedLegalAlternates(page),
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: pageTitle,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: brandTitle,
    },
    twitter: {
      card: 'summary',
      title: pageTitle,
      description,
    },
  };
}

export default async function LocalizedLegalPage({ params }: LocalizedLegalPageProps) {
  const requested = await params;
  const { language, page } = resolveParams(requested.language, requested.legalPage);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';
  const { bankName } = await getRequestBrandSettings();

  return (
    <LegalDocument
      language={language}
      copy={getLegalPage(language, page)}
      bankName={bankName}
      supportEmail={supportEmail}
    />
  );
}
