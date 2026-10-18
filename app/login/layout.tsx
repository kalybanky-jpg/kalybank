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
  const description = `Accédez à votre espace bancaire en ligne ${brandTitle} : gestion des comptes, virements, services de prêts, financement et investissement en toute sécurité.`;

  return {
    title: `Connexion Espace Client | ${brandTitle}`,
    description,
    alternates: { canonical: absoluteUrl('/') },
    robots: { index: true, follow: true },
    openGraph: {
      title: `Connexion Espace Client | ${brandTitle}`,
      description,
      url: absoluteUrl('/'),
      siteName: brandTitle,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `Connexion Espace Client | ${brandTitle}`,
      description,
    },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
