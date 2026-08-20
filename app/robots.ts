import type { MetadataRoute } from 'next';
import { absoluteUrl, CANONICAL_ORIGIN } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/admin-login',
        '/auth/',
        '/myaccount',
        '/onboarding',
        '/reset-pin',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: CANONICAL_ORIGIN,
  };
}
