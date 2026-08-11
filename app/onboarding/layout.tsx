'use client';

import React from 'react';
import SupportButton from '@/components/support/SupportButton';
import { SupportProvider } from '@/components/support/SupportProvider';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupportProvider>
      {children}
      <SupportButton variant="floating" />
    </SupportProvider>
  );
}
