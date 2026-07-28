import './globals.css';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: {
    default: 'Monalyz',
    template: '%s | Monalyz',
  },
  description:
    'Instructions, contrôles et traçabilité d’opérations financières exécutées hors application.',
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  // Nonce-based CSP requires every HTML response to be rendered with the
  // per-request nonce injected by proxy.ts.
  await headers();

  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
