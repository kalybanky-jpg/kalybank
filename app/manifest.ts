import type { MetadataRoute } from 'next';
import { getRequestBrandSettings } from '@/lib/server/branding';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getRequestBrandSettings();
  return {
    name: brand.bankName,
    short_name: brand.bankName.slice(0, 30),
    description:
      'Instructions, contrôles et traçabilité d’opérations financières exécutées hors application.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBFAF7',
    theme_color: '#190B21',
    icons: [
      {
        src: brand.appIcon192Url,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: brand.appIcon512Url,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: brand.maskableIconUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
