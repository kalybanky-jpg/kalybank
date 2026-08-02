'use client';

import React from 'react';
import { AppProvider } from '@/lib/store';
import type { LanguageSource } from '@/lib/language';
import type { Language } from '@/lib/types';
import type { BrandSettings } from '@/lib/types';
import { BrandProvider } from '@/components/brand/BrandProvider';

interface ProvidersProps {
  children: React.ReactNode;
  initialLanguage: Language;
  initialLanguageSource: LanguageSource;
  initialBrand: BrandSettings;
}

export default function Providers({
  children,
  initialLanguage,
  initialLanguageSource,
  initialBrand,
}: ProvidersProps) {
  return (
    <BrandProvider initialBrand={initialBrand}>
      <AppProvider
        initialLanguage={initialLanguage}
        initialLanguageSource={initialLanguageSource}
      >
        {children}
      </AppProvider>
    </BrandProvider>
  );
}
