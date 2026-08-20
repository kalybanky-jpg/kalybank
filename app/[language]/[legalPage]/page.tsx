import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalDocument from '@/components/legal/LegalDocument';
import { getLegalPage } from '@/lib/legal-i18n';
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
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: absoluteUrl(localizedLegalPath(language, page)),
      languages: localizedLegalAlternates(page),
    },
    robots: { index: true, follow: true },
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
