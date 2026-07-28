'use client';

import React from 'react';
import { AppProvider } from '@/lib/store';
import type { LanguageSource } from '@/lib/language';
import type { Language } from '@/lib/types';

interface ProvidersProps {
  children: React.ReactNode;
  initialLanguage: Language;
  initialLanguageSource: LanguageSource;
}

export default function Providers({
  children,
  initialLanguage,
  initialLanguageSource,
}: ProvidersProps) {
  return (
    <AppProvider
      initialLanguage={initialLanguage}
      initialLanguageSource={initialLanguageSource}
    >
      {children}
    </AppProvider>
  );
}
