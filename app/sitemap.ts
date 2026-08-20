import type { MetadataRoute } from 'next';
import { SUPPORTED_LANGUAGES } from '@/lib/language';
import {
  absoluteUrl,
  LEGAL_SLUGS,
  localizedLegalAlternates,
  localizedLegalPath,
} from '@/lib/seo';
import type { LegalPageKey } from '@/lib/legal-i18n';

const LAST_PUBLIC_UPDATE = new Date('2026-08-20T00:00:00.000Z');

export default function sitemap(): MetadataRoute.Sitemap {
  const publicEntryPoints: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/login'),
      lastModified: LAST_PUBLIC_UPDATE,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: absoluteUrl('/register'),
      lastModified: LAST_PUBLIC_UPDATE,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
  const legalPages = Object.keys(LEGAL_SLUGS) as LegalPageKey[];
  const localizedLegalPages: MetadataRoute.Sitemap = legalPages.flatMap((page) =>
    SUPPORTED_LANGUAGES.map((language) => ({
      url: absoluteUrl(localizedLegalPath(language, page)),
      lastModified: LAST_PUBLIC_UPDATE,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
      alternates: { languages: localizedLegalAlternates(page) },
    })),
  );

  return [...publicEntryPoints, ...localizedLegalPages];
}
