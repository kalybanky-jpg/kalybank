import type { MetadataRoute } from 'next';
import { absoluteUrl, CANONICAL_ORIGIN } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const privateDisallow = [
    '/api/',
    '/admin',
    '/admin-login',
    '/auth/',
    '/myaccount',
    '/onboarding',
    '/reset-pin',
  ];

  const publicAllow = [
    '/',
    '/login',
    '/register',
    '/llms.txt',
    '/llms-full.txt',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: publicAllow,
        disallow: privateDisallow,
      },
      {
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'PerplexityBot',
          'ClaudeBot',
          'Google-Extended',
          'Applebot',
          'Bingbot',
        ],
        allow: publicAllow,
        disallow: privateDisallow,
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: CANONICAL_ORIGIN,
  };
}
