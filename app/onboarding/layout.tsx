'use client';

import React from 'react';
import SupportButton from '@/components/support/SupportButton';
import { SupportProvider } from '@/components/support/SupportProvider';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupportProvider>
      {children}
      <SupportButton
        variant="icon"
        className="fixed right-4 top-4 z-40 border border-white/20 bg-white/95 shadow-lg backdrop-blur sm:right-6 sm:top-6"
      />
    </SupportProvider>
  );
}
