import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  BRAND_DIRECTORY,
  checkBrandAssets,
  parseIcoDirectory,
  PNG_SPECS,
  SVG_SPECS,
  validateBrandSvgSources,
} from '../scripts/generate-brand-assets';

const rasterFiles = [
  ...PNG_SPECS.map(({ file }) => file),
  'monalyz-favicon.ico',
  'monalyz-opengraph-1200x630.png',
  'monalyz-twitter-1200x630.png',
];

async function snapshot(file: string) {
  const filePath = join(BRAND_DIRECTORY, file);
  const [bytes, metadata] = await Promise.all([readFile(filePath), stat(filePath)]);
  return {
    file,
    hash: createHash('sha256').update(bytes).digest('hex'),
    modifiedAt: metadata.mtimeMs,
  };
}

test('brand masters are flat, path-only SVGs with the approved palette', async () => {
  assert.equal(SVG_SPECS.length, 7, 'six signatures plus one app icon');
  await validateBrandSvgSources();

  for (const spec of SVG_SPECS) {
    const svg = await readFile(join(BRAND_DIRECTORY, spec.file), 'utf8');
    assert.doesNotMatch(
      svg,
      /<(?:text|image|filter|linearGradient|radialGradient|pattern|style|use)\b/i,
    );
    assert.match(svg, /<path\b/);
    assert.match(svg, new RegExp(`viewBox="0 0 ${spec.width} ${spec.height}"`));
  }
});

test('brand check is reproducible and does not mutate generated assets', async () => {
  assert.equal(PNG_SPECS.length + 1, 19, 'the historical PNG/ICO contract');
  assert.equal(rasterFiles.length, 21, 'historical exports plus two social cards');

  const before = await Promise.all(rasterFiles.map(snapshot));
  const generated = await checkBrandAssets();
  const after = await Promise.all(rasterFiles.map(snapshot));

  assert.equal(generated.length, 21);
  assert.deepEqual(after, before);
});

test('social cards and the favicon expose their public dimensions', async () => {
  for (const file of [
    'monalyz-opengraph-1200x630.png',
    'monalyz-twitter-1200x630.png',
  ]) {
    const png = await readFile(join(BRAND_DIRECTORY, file));
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert.equal(png.readUInt8(25), 2, 'RGB PNG without an alpha channel');
  }

  const favicon = await readFile(join(BRAND_DIRECTORY, 'monalyz-favicon.ico'));
  assert.deepEqual(
    parseIcoDirectory(favicon).map(({ width, height, bitsPerPixel }) => ({
      width,
      height,
      bitsPerPixel,
    })),
    [
      { width: 16, height: 16, bitsPerPixel: 32 },
      { width: 32, height: 32, bitsPerPixel: 32 },
      { width: 48, height: 48, bitsPerPixel: 32 },
    ],
  );
});
