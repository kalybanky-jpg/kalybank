import type { BrandSettings } from './types';

export interface BrandSettingsRow {
  bank_name: string;
  primary_logo_path: string;
  primary_logo_width: number;
  primary_logo_height: number;
  reversed_logo_path: string;
  reversed_logo_width: number;
  reversed_logo_height: number;
  email_logo_path: string;
  pdf_logo_path: string;
  favicon_ico_path: string;
  favicon_16_path: string;
  favicon_32_path: string;
  favicon_48_path: string;
  apple_touch_icon_path: string;
  app_icon_192_path: string;
  app_icon_512_path: string;
  maskable_icon_path: string;
  social_card_path: string;
  revision: number;
  updated_at: string;
}

export const DEFAULT_BRAND_ROW: BrandSettingsRow = {
  bank_name: 'Monalyz',
  primary_logo_path: '/brand/monalyz/monalyz-wordmark-primary.png',
  primary_logo_width: 1120,
  primary_logo_height: 320,
  reversed_logo_path: '/brand/monalyz/monalyz-wordmark-reversed-white.png',
  reversed_logo_width: 1120,
  reversed_logo_height: 320,
  email_logo_path: '/brand/monalyz/monalyz-wordmark-email-360.png',
  pdf_logo_path: '/brand/monalyz/monalyz-wordmark-reversed-white.png',
  favicon_ico_path: '/brand/monalyz/monalyz-favicon.ico',
  favicon_16_path: '/brand/monalyz/monalyz-favicon-16.png',
  favicon_32_path: '/brand/monalyz/monalyz-favicon-32.png',
  favicon_48_path: '/brand/monalyz/monalyz-favicon-48.png',
  apple_touch_icon_path: '/brand/monalyz/monalyz-apple-touch-icon-180.png',
  app_icon_192_path: '/brand/monalyz/monalyz-app-icon-192.png',
  app_icon_512_path: '/brand/monalyz/monalyz-app-icon-512.png',
  maskable_icon_path: '/brand/monalyz/monalyz-maskable-icon-512.png',
  social_card_path: '/brand/monalyz/monalyz-opengraph-1200x630.png',
  revision: 1,
  updated_at: '2026-07-28T00:00:00.000Z',
};

export function normalizeBankName(value: string): string {
  const source = value.normalize('NFC');
  const normalized = source.trim().replace(/\s+/g, ' ');
  if (
    normalized.length < 2 ||
    normalized.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(source)
  ) {
    throw new Error('Le nom de la banque doit contenir entre 2 et 80 caractères.');
  }
  return normalized;
}

export function brandAssetUrl(path: string, supabaseUrl?: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return path;
  if (!supabaseUrl) return DEFAULT_BRAND_ROW.primary_logo_path;
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/brand-assets/${encodedPath}`;
}

export function mapBrandSettings(
  row: BrandSettingsRow = DEFAULT_BRAND_ROW,
  supabaseUrl?: string,
): BrandSettings {
  return {
    bankName: row.bank_name,
    primaryLogoUrl: brandAssetUrl(row.primary_logo_path, supabaseUrl),
    primaryLogoWidth: row.primary_logo_width,
    primaryLogoHeight: row.primary_logo_height,
    reversedLogoUrl: brandAssetUrl(row.reversed_logo_path, supabaseUrl),
    reversedLogoWidth: row.reversed_logo_width,
    reversedLogoHeight: row.reversed_logo_height,
    emailLogoUrl: brandAssetUrl(row.email_logo_path, supabaseUrl),
    pdfLogoUrl: brandAssetUrl(row.pdf_logo_path, supabaseUrl),
    faviconIcoUrl: brandAssetUrl(row.favicon_ico_path, supabaseUrl),
    favicon16Url: brandAssetUrl(row.favicon_16_path, supabaseUrl),
    favicon32Url: brandAssetUrl(row.favicon_32_path, supabaseUrl),
    favicon48Url: brandAssetUrl(row.favicon_48_path, supabaseUrl),
    appleTouchIconUrl: brandAssetUrl(row.apple_touch_icon_path, supabaseUrl),
    appIcon192Url: brandAssetUrl(row.app_icon_192_path, supabaseUrl),
    appIcon512Url: brandAssetUrl(row.app_icon_512_path, supabaseUrl),
    maskableIconUrl: brandAssetUrl(row.maskable_icon_path, supabaseUrl),
    socialCardUrl: brandAssetUrl(row.social_card_path, supabaseUrl),
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

export const DEFAULT_BRAND_SETTINGS = mapBrandSettings();

export function withBankName(
  message: string,
  bankName: string,
): string {
  return message.replaceAll('{bankName}', bankName);
}

export function applyBrand<T>(value: T, bankName: string): T {
  if (typeof value === 'string') {
    return value
      .replaceAll('{bankName}', bankName)
      .replaceAll('MONALYZ', bankName.toLocaleUpperCase())
      .replaceAll('Monalyz', bankName) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => applyBrand(entry, bankName)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, applyBrand(entry, bankName)]),
    ) as T;
  }
  return value;
}
