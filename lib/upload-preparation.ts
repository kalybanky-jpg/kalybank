'use client';

export const DEFAULT_IMAGE_UPLOAD_TARGET_BYTES = 3_500_000;
export const MAX_COMPRESSIBLE_IMAGE_SOURCE_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_DIMENSION = 3200;
const MIN_IMAGE_DIMENSION = 640;

const COMPRESSIBLE_RASTER_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export interface UploadFileDescriptor {
  size: number;
  type: string;
}

export interface ImageCompressionAttempt {
  width: number;
  height: number;
  quality: number | undefined;
}

export function isCompressibleRasterType(type: string) {
  return COMPRESSIBLE_RASTER_TYPES.has(type.toLowerCase());
}

export function shouldCompressUpload(
  file: UploadFileDescriptor,
  targetBytes = DEFAULT_IMAGE_UPLOAD_TARGET_BYTES,
) {
  return (
    Number.isFinite(file.size) &&
    file.size > targetBytes &&
    isCompressibleRasterType(file.type)
  );
}

export function imageCompressionAttempts(
  width: number,
  height: number,
  mimeType: string,
): ImageCompressionAttempt[] {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return [];
  }

  const longestSide = Math.max(width, height);
  const initialScale = Math.min(1, DEFAULT_MAX_IMAGE_DIMENSION / longestSide);
  const minimumScale = Math.min(1, MIN_IMAGE_DIMENSION / longestSide);
  const qualitySteps =
    mimeType === 'image/png'
      ? [
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        ]
      : [0.88, 0.8, 0.72, 0.64, 0.56, 0.48, 0.42, 0.36];

  return qualitySteps.map((quality, index) => {
    const progressiveScale = Math.max(
      minimumScale,
      initialScale * 0.82 ** index,
    );
    const scaledWidth = Math.max(1, Math.round(width * progressiveScale));
    const scaledHeight = Math.max(1, Math.round(height * progressiveScale));
    return {
      width: Math.min(width, scaledWidth),
      height: Math.min(height, scaledHeight),
      quality,
    };
  });
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

async function decodeImage(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Older browsers may not support imageOrientation. The image fallback
      // below still follows the browser's safe decoding behavior.
    }
  }

  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image decoding failed.'));
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) return null;
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number | undefined,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

/**
 * Compresses large JPEG, PNG and WebP uploads in the browser before a direct
 * Supabase upload. PDFs and every unsupported file type are returned unchanged,
 * so their bytes are never rewritten. If browser image APIs are unavailable or
 * decoding fails, the original file is returned safely.
 */
export async function prepareUploadFile(
  file: File,
  targetBytes = DEFAULT_IMAGE_UPLOAD_TARGET_BYTES,
): Promise<File> {
  if (!shouldCompressUpload(file, targetBytes)) return file;
  if (typeof document === 'undefined' || typeof File === 'undefined') return file;

  const decoded = await decodeImage(file);
  if (!decoded) return file;

  let best: File = file;
  try {
    for (const attempt of imageCompressionAttempts(
      decoded.width,
      decoded.height,
      file.type,
    )) {
      const canvas = document.createElement('canvas');
      canvas.width = attempt.width;
      canvas.height = attempt.height;
      const context = canvas.getContext('2d', { alpha: file.type !== 'image/jpeg' });
      if (!context) return best;
      context.drawImage(decoded.source, 0, 0, attempt.width, attempt.height);

      const blob = await canvasBlob(canvas, file.type, attempt.quality);
      canvas.width = 0;
      canvas.height = 0;
      if (!blob || blob.size <= 0 || blob.type !== file.type) continue;

      const candidate = new File([blob], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
      if (candidate.size < best.size) best = candidate;
      if (candidate.size <= targetBytes) return candidate;
    }
    return best;
  } catch {
    return best;
  } finally {
    decoded.close?.();
  }
}
