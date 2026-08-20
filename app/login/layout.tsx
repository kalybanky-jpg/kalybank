import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { getRequestBrandSettings } from '@/lib/server/branding';

export async function generateMetadata(): Promise<Metadata> {
  const { bankName } = await getRequestBrandSettings();
  return {
    title: 'Connexion',
    description: `Accédez à votre espace ${bankName} sécurisé ou créez un compte.`,
    alternates: { canonical: absoluteUrl('/login') },
    robots: { index: true, follow: true },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
