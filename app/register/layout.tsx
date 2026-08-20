import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { getRequestBrandSettings } from '@/lib/server/branding';

export async function generateMetadata(): Promise<Metadata> {
  const { bankName } = await getRequestBrandSettings();
  return {
    title: 'Créer un compte',
    description: `Créez votre accès personnel sécurisé à ${bankName}.`,
    alternates: { canonical: absoluteUrl('/register') },
    robots: { index: true, follow: true },
  };
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
