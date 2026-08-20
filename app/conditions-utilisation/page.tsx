import type { Metadata } from 'next';
import LegalDocument from '@/components/legal/LegalDocument';
import { getLegalLanguage, getLegalPage } from '@/lib/legal-i18n';
import { getRequestBrandSettings } from '@/lib/server/branding';

export async function generateMetadata(): Promise<Metadata> {
  const language = await getLegalLanguage();
  const copy = getLegalPage(language, 'terms');
  return { title: copy.title, description: copy.description };
}

export default async function TermsPage() {
  const language = await getLegalLanguage();
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';
  const { bankName } = await getRequestBrandSettings();

  return (
    <LegalDocument
      language={language}
      copy={getLegalPage(language, 'terms')}
      bankName={bankName}
      supportEmail={supportEmail}
    />
  );
}
