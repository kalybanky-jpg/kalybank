// sharp 0.35 publishes declarations but omits the `types` export condition.
// @ts-expect-error Upstream package export-map issue; runtime import is valid.
import sharp from 'sharp';
import { normalizeBankName } from '@/lib/branding';

export const BRAND_FILE_LIMIT_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const MAX_DIMENSION = 4096;
const LOGO_MIN_LONG_EDGE = 256;
const LOGO_MIN_SHORT_EDGE = 32;
const ACCEPTED_TYPES = new Set(['image/svg+xml', 'image/png', 'image/webp']);

export interface BrandSource {
  bytes: Buffer;
  mimeType: string;
  trusted?: boolean;
}

export interface GeneratedBrandAsset {
  path: string;
  bytes: Buffer;
  contentType: 'image/png' | 'image/x-icon';
}

export interface GeneratedBrandRelease {
  assets: GeneratedBrandAsset[];
  paths: {
    primaryLogo: string;
    reversedLogo: string;
    emailLogo: string;
    pdfLogo: string;
    faviconIco: string;
    favicon16: string;
    favicon32: string;
    favicon48: string;
    appleTouchIcon: string;
    appIcon192: string;
    appIcon512: string;
    maskableIcon: string;
    socialCard: string;
  };
  primaryDimensions: { width: number; height: number };
  reversedDimensions: { width: number; height: number };
}

function sanitizeSvg(bytes: Buffer) {
  const svg = bytes.toString('utf8');
  if (
    !/<svg\b/i.test(svg) ||
    /<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b|<image\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:)|url\s*\(\s*["']?\s*(?:https?:|\/\/|data:)/i.test(
      svg,
    )
  ) {
    throw new Error('Le fichier SVG contient un élément actif ou externe interdit.');
  }
}

async function decodeSource(
  source: BrandSource,
  kind: 'logo' | 'favicon',
): Promise<{ png: Buffer; width: number; height: number }> {
  if (!source.trusted) {
    if (!ACCEPTED_TYPES.has(source.mimeType)) {
      throw new Error('Formats acceptés : SVG, PNG ou WebP.');
    }
    if (source.bytes.length === 0 || source.bytes.length > BRAND_FILE_LIMIT_BYTES) {
      throw new Error('Chaque image doit peser au maximum 5 Mo.');
    }
    if (source.mimeType === 'image/svg+xml') sanitizeSvg(source.bytes);
  }

  try {
    const decoder = sharp(source.bytes, {
      animated: false,
      density: source.mimeType === 'image/svg+xml' ? 192 : undefined,
      limitInputPixels: MAX_PIXELS,
      failOn: 'warning',
    });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Dimensions introuvables.');
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new Error('Les images animées ne sont pas acceptées.');
    }
    if (
      metadata.width > MAX_DIMENSION ||
      metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_PIXELS
    ) {
      throw new Error('Les dimensions de l’image dépassent la limite autorisée.');
    }
    if (kind === 'favicon' && metadata.width !== metadata.height) {
      throw new Error('Le favicon doit être parfaitement carré.');
    }
    if (
      kind === 'logo' &&
      (Math.max(metadata.width, metadata.height) < LOGO_MIN_LONG_EDGE ||
        Math.min(metadata.width, metadata.height) < LOGO_MIN_SHORT_EDGE)
    ) {
      throw new Error('Le logo est trop petit pour un rendu de qualité.');
    }

    const normalized = await decoder
      .rotate()
      .ensureAlpha()
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer({ resolveWithObject: true });
    return {
      png: normalized.data,
      width: normalized.info.width,
      height: normalized.info.height,
    };
  } catch (error) {
    if (error instanceof Error && /favicon|logo|dimensions|animées|limite/i.test(error.message)) {
      throw error;
    }
    throw new Error('Le fichier image ne peut pas être décodé en toute sécurité.');
  }
}

async function fitPng(
  bytes: Buffer,
  width: number,
  height?: number,
  withoutEnlargement = true,
) {
  return sharp(bytes, { limitInputPixels: MAX_PIXELS })
    .resize({
      width,
      height,
      fit: 'inside',
      withoutEnlargement,
    })
    .ensureAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
}

function createIco(images: readonly { size: number; bytes: Buffer }[]) {
  const headerSize = 6;
  const directorySize = images.length * 16;
  let dataOffset = headerSize + directorySize;
  const header = Buffer.alloc(dataOffset);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  images.forEach(({ size, bytes }, index) => {
    const offset = headerSize + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, offset);
    header.writeUInt8(size === 256 ? 0 : size, offset + 1);
    header.writeUInt16LE(0, offset + 2);
    header.writeUInt16LE(1, offset + 4);
    header.writeUInt16LE(32, offset + 6);
    header.writeUInt32LE(bytes.length, offset + 8);
    header.writeUInt32LE(dataOffset, offset + 12);
    dataOffset += bytes.length;
  });
  return Buffer.concat([header, ...images.map(({ bytes }) => bytes)]);
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function renderSocialCard(reversedLogo: Buffer, bankName: string) {
  const fittedLogo = await fitPng(reversedLogo, 620, 180, false);
  const logoMetadata = await sharp(fittedLogo).metadata();
  const logoWidth = logoMetadata.width ?? 620;
  const logoHeight = logoMetadata.height ?? 180;
  const safeName = escapeXml(bankName);
  const text = Buffer.from(
    `<svg width="1100" height="90" xmlns="http://www.w3.org/2000/svg"><text x="550" y="62" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="48" font-weight="700">${safeName}</text></svg>`,
  );
  return sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: '#190B21',
    },
  })
    .composite([
      {
        input: fittedLogo,
        left: Math.round((1200 - logoWidth) / 2),
        top: Math.round(220 - logoHeight / 2),
      },
      { input: text, left: 50, top: 350 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
}

export async function sourceFromFile(file: File): Promise<BrandSource> {
  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type.toLowerCase(),
  };
}

export async function generateBrandRelease(input: {
  releaseId: string;
  bankName: string;
  primary: BrandSource;
  reversed: BrandSource;
  favicon: BrandSource;
}): Promise<GeneratedBrandRelease> {
  const bankName = normalizeBankName(input.bankName);
  if (!/^[0-9a-f-]{36}$/i.test(input.releaseId)) {
    throw new Error('Identifiant de publication invalide.');
  }
  const [primary, reversed, favicon] = await Promise.all([
    decodeSource(input.primary, 'logo'),
    decodeSource(input.reversed, 'logo'),
    decodeSource(input.favicon, 'favicon'),
  ]);
  const prefix = `releases/${input.releaseId}`;
  const paths = {
    primaryLogo: `${prefix}/logo-primary.png`,
    reversedLogo: `${prefix}/logo-reversed.png`,
    emailLogo: `${prefix}/logo-email-360.png`,
    pdfLogo: `${prefix}/logo-pdf-720.png`,
    faviconIco: `${prefix}/favicon.ico`,
    favicon16: `${prefix}/favicon-16.png`,
    favicon32: `${prefix}/favicon-32.png`,
    favicon48: `${prefix}/favicon-48.png`,
    appleTouchIcon: `${prefix}/apple-touch-icon-180.png`,
    appIcon192: `${prefix}/app-icon-192.png`,
    appIcon512: `${prefix}/app-icon-512.png`,
    maskableIcon: `${prefix}/maskable-icon-512.png`,
    socialCard: `${prefix}/social-card-1200x630.png`,
  };

  const [primaryWeb, reversedWeb, emailLogo, pdfLogo, favicon16, favicon32, favicon48, appleTouchIcon, appIcon192, appIcon512] =
    await Promise.all([
      fitPng(primary.png, 1600, 700),
      fitPng(reversed.png, 1600, 700),
      fitPng(primary.png, 360, 160),
      fitPng(reversed.png, 720, 280),
      fitPng(favicon.png, 16, 16, false),
      fitPng(favicon.png, 32, 32, false),
      fitPng(favicon.png, 48, 48, false),
      fitPng(favicon.png, 180, 180, false),
      fitPng(favicon.png, 192, 192, false),
      fitPng(favicon.png, 512, 512, false),
    ]);
  const [primaryMetadata, reversedMetadata] = await Promise.all([
    sharp(primaryWeb).metadata(),
    sharp(reversedWeb).metadata(),
  ]);
  const faviconIco = createIco([
    { size: 16, bytes: favicon16 },
    { size: 32, bytes: favicon32 },
    { size: 48, bytes: favicon48 },
  ]);
  const maskableIcon = await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#FBFAF7' },
  })
    .composite([{ input: await fitPng(favicon.png, 360, 360, false), gravity: 'centre' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
  const socialCard = await renderSocialCard(reversed.png, bankName);

  const png = (path: string, bytes: Buffer): GeneratedBrandAsset => ({
    path,
    bytes,
    contentType: 'image/png',
  });
  return {
    paths,
    primaryDimensions: {
      width: primaryMetadata.width ?? primary.width,
      height: primaryMetadata.height ?? primary.height,
    },
    reversedDimensions: {
      width: reversedMetadata.width ?? reversed.width,
      height: reversedMetadata.height ?? reversed.height,
    },
    assets: [
      png(paths.primaryLogo, primaryWeb),
      png(paths.reversedLogo, reversedWeb),
      png(paths.emailLogo, emailLogo),
      png(paths.pdfLogo, pdfLogo),
      { path: paths.faviconIco, bytes: faviconIco, contentType: 'image/x-icon' },
      png(paths.favicon16, favicon16),
      png(paths.favicon32, favicon32),
      png(paths.favicon48, favicon48),
      png(paths.appleTouchIcon, appleTouchIcon),
      png(paths.appIcon192, appIcon192),
      png(paths.appIcon512, appIcon512),
      png(paths.maskableIcon, maskableIcon),
      png(paths.socialCard, socialCard),
    ],
  };
}
