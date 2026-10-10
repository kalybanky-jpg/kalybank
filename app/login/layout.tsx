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
  const description = `Accédez à votre espace bancaire sécurisé ${brandTitle} : consultation des comptes, virements et opérations financières en ligne.`;

  return {
    title: `Connexion Espace Client | ${brandTitle}`,
    description,
    alternates: { canonical: absoluteUrl('/login') },
    robots: { index: true, follow: true },
    openGraph: {
      title: `Connexion Espace Client | ${brandTitle}`,
      description,
      url: absoluteUrl('/login'),
    },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
