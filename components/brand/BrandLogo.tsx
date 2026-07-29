import Image from 'next/image';

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
  const { width, height } = dimensions[kind];
  const assetName = kind === 'wordmark' ? 'wordmark' : 'mark-m';

  return (
    <Image
      src={`/brand/monalyz/monalyz-${assetName}-${tone}.svg`}
      width={width}
      height={height}
      alt={decorative ? '' : 'Monalyz'}
      aria-hidden={decorative || undefined}
      priority={priority}
      className={className}
    />
  );
}
