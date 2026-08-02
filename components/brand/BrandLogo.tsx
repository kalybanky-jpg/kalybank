'use client';

import { useBrand } from './BrandProvider';

export type BrandLogoKind = 'wordmark' | 'mark';
export type BrandLogoTone = 'primary' | 'monochrome-dark' | 'reversed-white';

export interface BrandLogoProps {
  kind?: BrandLogoKind;
  tone?: BrandLogoTone;
  decorative?: boolean;
  priority?: boolean;
  className?: string;
}

const dimensions: Record<BrandLogoKind, { width: number; height: number }> = {
  wordmark: { width: 1120, height: 320 },
  mark: { width: 320, height: 320 },
};

export default function BrandLogo({
  kind = 'wordmark',
  tone = 'primary',
  decorative = false,
  priority = false,
  className,
}: BrandLogoProps) {
  const { brand } = useBrand();
  const isReversed = tone === 'reversed-white';
  const dynamicDimensions = isReversed
    ? { width: brand.reversedLogoWidth, height: brand.reversedLogoHeight }
    : { width: brand.primaryLogoWidth, height: brand.primaryLogoHeight };
  const { width, height } = kind === 'mark' ? dimensions.mark : dynamicDimensions;
  const src = kind === 'mark'
    ? brand.appIcon512Url
    : isReversed
      ? brand.reversedLogoUrl
      : brand.primaryLogoUrl;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={width}
      height={height}
      alt={decorative ? '' : brand.bankName}
      aria-hidden={decorative || undefined}
      fetchPriority={priority ? 'high' : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
    />
  );
}
