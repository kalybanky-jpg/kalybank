import { permanentRedirect } from 'next/navigation';
import { getLegalLanguage } from '@/lib/legal-i18n';
import { localizedLegalPath } from '@/lib/seo';

export default async function TermsPage() {
  const language = await getLegalLanguage();
  permanentRedirect(localizedLegalPath(language, 'terms'));
}
