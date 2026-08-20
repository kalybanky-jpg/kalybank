import { redirect } from 'next/navigation';
import { getLegalLanguage } from '@/lib/legal-i18n';
import { localizedLegalPath } from '@/lib/seo';

export default async function PrivacyPage() {
  const language = await getLegalLanguage();
  redirect(localizedLegalPath(language, 'privacy'));
}
