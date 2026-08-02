'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { BrandSettings } from '@/lib/types';
import { applyBrand } from '@/lib/branding';

interface BrandContextValue {
  brand: BrandSettings;
  setBrand: React.Dispatch<React.SetStateAction<BrandSettings>>;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({
  initialBrand,
  children,
}: {
  initialBrand: BrandSettings;
  children?: React.ReactNode;
}) {
  const [brand, setBrand] = useState(initialBrand);
  const value = useMemo(() => ({ brand, setBrand }), [brand]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) throw new Error('useBrand doit être utilisé dans BrandProvider.');
  return context;
}

export function useBranded<T>(value: T): T {
  const { brand } = useBrand();
  return useMemo(() => applyBrand(value, brand.bankName), [brand.bankName, value]);
}
