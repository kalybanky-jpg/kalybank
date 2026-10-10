import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { getRequestBrandSettings } from '@/lib/server/branding';

function formatBankBrand(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().startsWith('bank ') ? trimmed : `Bank ${trimmed}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const { bankName } = await getRequestBrandSettings();
  const brandTitle = formatBankBrand(bankName);
  const description = `Créez votre accès personnel sécurisé sur ${brandTitle} : ouverture de compte bancaire en ligne et gestion financière.`;

  return {
    title: `Ouvrir un compte | ${brandTitle}`,
    description,
    alternates: { canonical: absoluteUrl('/register') },
    robots: { index: true, follow: true },
    openGraph: {
      title: `Ouvrir un compte | ${brandTitle}`,
      description,
      url: absoluteUrl('/register'),
    },
  };
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
