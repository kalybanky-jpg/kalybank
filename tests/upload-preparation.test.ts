import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_IMAGE_UPLOAD_TARGET_BYTES,
  MAX_COMPRESSIBLE_IMAGE_SOURCE_BYTES,
  imageCompressionAttempts,
  isCompressibleRasterType,
  prepareUploadFile,
  shouldCompressUpload,
} from '../lib/upload-preparation';

test('only oversized raster images are selected for browser compression', () => {
  assert.equal(MAX_COMPRESSIBLE_IMAGE_SOURCE_BYTES, 25 * 1024 * 1024);
  assert.equal(isCompressibleRasterType('image/jpeg'), true);
  assert.equal(isCompressibleRasterType('image/png'), true);
  assert.equal(isCompressibleRasterType('image/webp'), true);
  assert.equal(isCompressibleRasterType('application/pdf'), false);
  assert.equal(isCompressibleRasterType('image/svg+xml'), false);

  assert.equal(
    shouldCompressUpload({
      type: 'image/jpeg',
      size: DEFAULT_IMAGE_UPLOAD_TARGET_BYTES + 1,
    }),
    true,
  );
  assert.equal(
    shouldCompressUpload({
      type: 'image/jpeg',
      size: DEFAULT_IMAGE_UPLOAD_TARGET_BYTES,
    }),
    false,
  );
  assert.equal(
    shouldCompressUpload({
      type: 'application/pdf',
      size: 20 * 1024 * 1024,
    }),
    false,
  );
});

test('compression attempts progressively reduce dimensions without upscaling', () => {
  const jpegAttempts = imageCompressionAttempts(6000, 4000, 'image/jpeg');
  assert.equal(jpegAttempts.length, 8);
  assert.ok(jpegAttempts[0].width <= 3200);
  assert.ok(jpegAttempts[0].height < 4000);
  for (let index = 1; index < jpegAttempts.length; index += 1) {
    assert.ok(jpegAttempts[index].width <= jpegAttempts[index - 1].width);
    assert.ok(jpegAttempts[index].height <= jpegAttempts[index - 1].height);
    assert.ok((jpegAttempts[index].quality ?? 1) < (jpegAttempts[index - 1].quality ?? 1));
  }
  assert.ok(
    jpegAttempts.every(
      (attempt) =>
        Math.abs(attempt.width / attempt.height - 6000 / 4000) < 0.002,
    ),
  );

  const portraitAttempts = imageCompressionAttempts(1000, 10000, 'image/webp');
  assert.ok(
    portraitAttempts.every(
      (attempt) =>
        Math.abs(attempt.width / attempt.height - 1000 / 10000) < 0.002,
    ),
  );

  const pngAttempts = imageCompressionAttempts(500, 300, 'image/png');
  assert.ok(pngAttempts.every((attempt) => attempt.width <= 500));
  assert.ok(pngAttempts.every((attempt) => attempt.height <= 300));
  assert.ok(pngAttempts.every((attempt) => attempt.quality === undefined));
});

test('PDF preparation is byte-preserving and returns the original object', async () => {
  const pdf = {
    name: 'statement.pdf',
    type: 'application/pdf',
    size: 8 * 1024 * 1024,
    lastModified: 1,
  } as File;

  assert.equal(await prepareUploadFile(pdf), pdf);
});
