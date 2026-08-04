import type { NextRequest } from 'next/server';
import { mapBrandSettings, normalizeBankName, type BrandSettingsRow } from '@/lib/branding';
import type { BrandSource } from '@/lib/server/brand-assets';
import { fetchBrandRow, readBrandAsset } from '@/lib/server/branding';
import {
  createPrivilegedClient,
  isSameOriginMutation,
  noStoreJson,
} from '@/lib/server/api';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import {
  isExpectedBrandingStagingPath,
  STAGING_BUCKET,
  stagingPathExtension,
  type BrandingUploadKind,
} from '@/lib/server/staged-upload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function privilegedClient() {
  return createPrivilegedClient(
    'SUPABASE_SECRET_KEY est requise pour publier la marque.',
  );
}

interface BrandingPayload {
  bankName?: unknown;
  expectedRevision?: unknown;
  primaryLogoPath?: unknown;
  reversedLogoPath?: unknown;
  faviconPath?: unknown;
}

type GenerateBrandRelease =
  typeof import('@/lib/server/brand-assets').generateBrandRelease;

function optionalStagingPath(value: unknown, key: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 500) {
    throw new Error(`Le fichier ${key} est invalide.`);
  }
  return value;
}

async function currentSource(
  worker: ReturnType<typeof privilegedClient>,
  path: string,
): Promise<BrandSource> {
  return {
    bytes: Buffer.from(await readBrandAsset(worker, path)),
    mimeType: path.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
    trusted: true,
  };
}

function brandingMimeType(path: string): BrandSource['mimeType'] {
  switch (stagingPathExtension(path)) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      throw new Error('Le format du fichier de marque est invalide.');
  }
}

function hasExpectedBrandingSignature(
  bytes: Buffer,
  mimeType: BrandSource['mimeType'],
) {
  if (mimeType === 'image/svg+xml') {
    return /<svg\b/i.test(bytes.subarray(0, 4_096).toString('utf8'));
  }
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (value, index) => bytes[index] === value,
      )
    );
  }
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

async function stagedSource(
  worker: ReturnType<typeof privilegedClient>,
  path: string,
): Promise<BrandSource> {
  const { data, error } = await worker.storage
    .from(STAGING_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error('Le fichier temporaire de marque est introuvable.');
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  const mimeType = brandingMimeType(path);
  if (!hasExpectedBrandingSignature(bytes, mimeType)) {
    throw new Error('La signature du fichier de marque est invalide.');
  }
  return {
    bytes,
    mimeType,
  };
}

async function removeStagedSources(
  worker: ReturnType<typeof privilegedClient>,
  paths: readonly string[],
) {
  if (paths.length === 0) return;
  try {
    const { error } = await worker.storage
      .from(STAGING_BUCKET)
      .remove([...paths]);
    if (error) {
      console.warn(JSON.stringify({ event: 'staging_brand_cleanup_failed' }));
    }
  } catch {
    console.warn(JSON.stringify({ event: 'staging_brand_cleanup_failed' }));
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return noStoreJson({ error: 'Origine refusée.' }, 403);
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return noStoreJson({ error: 'Authentification requise.' }, 401);
  const { data: role, error: roleError } = await supabase.rpc('current_app_role');
  if (roleError || role !== 'admin') {
    return noStoreJson({ error: 'Habilitation administrateur requise.' }, 403);
  }

  let payload: BrandingPayload;
  try {
    payload = (await request.json()) as BrandingPayload;
  } catch {
    return noStoreJson({ error: 'Corps JSON invalide.' }, 400);
  }

  let bankName: string;
  let expectedRevision: number;
  let primaryLogoPath: string | null;
  let reversedLogoPath: string | null;
  let faviconPath: string | null;
  try {
    bankName = normalizeBankName(String(payload.bankName ?? ''));
    expectedRevision = Number(payload.expectedRevision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      throw new Error('Révision de marque invalide.');
    }
    primaryLogoPath = optionalStagingPath(
      payload.primaryLogoPath,
      'primaryLogo',
    );
    reversedLogoPath = optionalStagingPath(
      payload.reversedLogoPath,
      'reversedLogo',
    );
    faviconPath = optionalStagingPath(payload.faviconPath, 'favicon');
    const stagedByKind: readonly [BrandingUploadKind, string | null][] = [
      ['primaryLogo', primaryLogoPath],
      ['reversedLogo', reversedLogoPath],
      ['favicon', faviconPath],
    ];
    for (const [kind, path] of stagedByKind) {
      if (path && !isExpectedBrandingStagingPath(path, user.id, kind)) {
        throw new Error(`Le fichier ${kind} est invalide.`);
      }
    }
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : 'Paramètres invalides.' },
      400,
    );
  }

  const stagedPaths = [
    primaryLogoPath,
    reversedLogoPath,
    faviconPath,
  ].filter((path): path is string => Boolean(path));

  let worker: ReturnType<typeof privilegedClient>;
  try {
    worker = privilegedClient();
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : 'Backend indisponible.' },
      503,
    );
  }

  let current: BrandSettingsRow;
  try {
    current = await fetchBrandRow(worker);
  } catch {
    await removeStagedSources(worker, stagedPaths);
    return noStoreJson({ error: 'Configuration de marque introuvable.' }, 503);
  }
  if (current.revision !== expectedRevision) {
    await removeStagedSources(worker, stagedPaths);
    return noStoreJson(
      { error: 'La marque a été modifiée dans une autre session. Rechargez la page.' },
      409,
    );
  }

  let generateBrandRelease: GenerateBrandRelease;
  try {
    // Keep the native image pipeline out of unauthenticated requests and
    // method probes. Netlify loads it only after origin, auth and role checks.
    ({ generateBrandRelease } = await import('@/lib/server/brand-assets'));
  } catch {
    console.error(JSON.stringify({ event: 'brand_asset_pipeline_unavailable' }));
    await removeStagedSources(worker, stagedPaths);
    return noStoreJson(
      { error: 'Le traitement des images est temporairement indisponible.' },
      503,
    );
  }

  const releaseId = crypto.randomUUID();
  let uploadedPaths: string[] = [];
  try {
    const [primary, reversed, favicon] = await Promise.all([
      primaryLogoPath
        ? stagedSource(worker, primaryLogoPath)
        : currentSource(worker, current.primary_logo_path),
      reversedLogoPath
        ? stagedSource(worker, reversedLogoPath)
        : currentSource(worker, current.reversed_logo_path),
      faviconPath
        ? stagedSource(worker, faviconPath)
        : currentSource(worker, current.app_icon_512_path),
    ]);
    const release = await generateBrandRelease({
      releaseId,
      bankName,
      primary,
      reversed,
      favicon,
    });

    for (const asset of release.assets) {
      const { error } = await worker.storage
        .from('brand-assets')
        .upload(asset.path, asset.bytes, {
          contentType: asset.contentType,
          cacheControl: '31536000, immutable',
          upsert: false,
        });
      if (error) throw error;
      uploadedPaths.push(asset.path);
    }

    const { data, error: publishError } = await supabase.rpc('publish_brand_settings', {
      p_expected_revision: expectedRevision,
      p_bank_name: bankName,
      p_primary_logo_path: release.paths.primaryLogo,
      p_primary_logo_width: release.primaryDimensions.width,
      p_primary_logo_height: release.primaryDimensions.height,
      p_reversed_logo_path: release.paths.reversedLogo,
      p_reversed_logo_width: release.reversedDimensions.width,
      p_reversed_logo_height: release.reversedDimensions.height,
      p_email_logo_path: release.paths.emailLogo,
      p_pdf_logo_path: release.paths.pdfLogo,
      p_favicon_ico_path: release.paths.faviconIco,
      p_favicon_16_path: release.paths.favicon16,
      p_favicon_32_path: release.paths.favicon32,
      p_favicon_48_path: release.paths.favicon48,
      p_apple_touch_icon_path: release.paths.appleTouchIcon,
      p_app_icon_192_path: release.paths.appIcon192,
      p_app_icon_512_path: release.paths.appIcon512,
      p_maskable_icon_path: release.paths.maskableIcon,
      p_social_card_path: release.paths.socialCard,
    });
    if (publishError) {
      if (publishError.code === '40001' || publishError.message.includes('BRAND_REVISION_CONFLICT')) {
        throw Object.assign(new Error('BRAND_REVISION_CONFLICT'), { status: 409 });
      }
      throw publishError;
    }
    const row = (Array.isArray(data) ? data[0] : data) as BrandSettingsRow | null;
    if (!row) throw new Error('La marque publiée est introuvable.');
    return noStoreJson(
      { brand: mapBrandSettings(row, getPublicSupabaseConfig().url) },
      200,
    );
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await worker.storage.from('brand-assets').remove(uploadedPaths);
      uploadedPaths = [];
    }
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number(error.status)
        : 400;
    return noStoreJson(
      {
        error:
          error instanceof Error && error.message !== 'BRAND_REVISION_CONFLICT'
            ? error.message
            : 'La marque a été modifiée dans une autre session. Rechargez la page.',
      },
      Number.isInteger(status) && status >= 400 && status <= 599 ? status : 400,
    );
  } finally {
    await removeStagedSources(worker, stagedPaths);
  }
}
