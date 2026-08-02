import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { mapBrandSettings, normalizeBankName, type BrandSettingsRow } from '@/lib/branding';
import {
  generateBrandRelease,
  sourceFromFile,
  type BrandSource,
} from '@/lib/server/brand-assets';
import { fetchBrandRow, readBrandAsset } from '@/lib/server/branding';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  const canonicalOrigin =
    process.env.APP_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    (process.env.NODE_ENV === 'development' ? request.nextUrl.origin : null);
  if (!origin || !canonicalOrigin) return false;
  try {
    return new URL(origin).origin === new URL(canonicalOrigin).origin;
  } catch {
    return false;
  }
}

function privilegedClient() {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secretKey || /replace|changeme|your[-_]/i.test(secretKey)) {
    throw new Error('SUPABASE_SECRET_KEY est requise pour publier la marque.');
  }
  const { url } = getPublicSupabaseConfig();
  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function optionalFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === null || value === '') return null;
  if (!(value instanceof File) || value.size === 0) {
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

export async function PUT(request: NextRequest) {
  if (!originAllowed(request)) return noStoreJson({ error: 'Origine refusée.' }, 403);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return noStoreJson({ error: 'La publication dépasse la taille maximale autorisée.' }, 413);
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return noStoreJson({ error: 'Formulaire multipart invalide.' }, 400);
  }

  let bankName: string;
  let expectedRevision: number;
  let primaryFile: File | null;
  let reversedFile: File | null;
  let faviconFile: File | null;
  try {
    bankName = normalizeBankName(String(formData.get('bankName') ?? ''));
    expectedRevision = Number(formData.get('expectedRevision'));
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      throw new Error('Révision de marque invalide.');
    }
    primaryFile = optionalFile(formData, 'primaryLogo');
    reversedFile = optionalFile(formData, 'reversedLogo');
    faviconFile = optionalFile(formData, 'favicon');
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : 'Paramètres invalides.' },
      400,
    );
  }

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
    return noStoreJson({ error: 'Configuration de marque introuvable.' }, 503);
  }
  if (current.revision !== expectedRevision) {
    return noStoreJson(
      { error: 'La marque a été modifiée dans une autre session. Rechargez la page.' },
      409,
    );
  }

  const releaseId = crypto.randomUUID();
  let uploadedPaths: string[] = [];
  try {
    const [primary, reversed, favicon] = await Promise.all([
      primaryFile
        ? sourceFromFile(primaryFile)
        : currentSource(worker, current.primary_logo_path),
      reversedFile
        ? sourceFromFile(reversedFile)
        : currentSource(worker, current.reversed_logo_path),
      faviconFile
        ? sourceFromFile(faviconFile)
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
  }
}
