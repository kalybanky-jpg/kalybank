import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Monalyz',
    short_name: 'Monalyz',
    description:
      'Instructions, contrôles et traçabilité d’opérations financières exécutées hors application.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBFAF7',
    theme_color: '#190B21',
    icons: [
      {
        src: '/brand/monalyz/monalyz-app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/monalyz/monalyz-app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/monalyz/monalyz-maskable-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
