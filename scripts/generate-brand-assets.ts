import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// sharp 0.35 ships declarations but does not expose them through its package
// exports map yet; the runtime ESM entry is nevertheless the supported import.
// @ts-expect-error -- upstream package metadata omits the "types" export condition.
import sharp from 'sharp';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), '..');
export const BRAND_DIRECTORY = join(REPOSITORY_ROOT, 'public', 'brand', 'monalyz');

const AUBERGINE = '#190B21';
const LILAC = '#B574FC';
const PORCELAIN = '#FBFAF7';
const ALLOWED_COLORS = new Set([AUBERGINE, LILAC, PORCELAIN]);

type SvgSpec = {
  file: string;
  width: number;
  height: number;
  colors: readonly string[];
};

type PngSpec = {
  file: string;
  source: string;
  width: number;
  height: number;
  transparent: boolean;
};

export const SVG_SPECS: readonly SvgSpec[] = [
  {
    file: 'monalyz-wordmark-primary.svg',
    width: 1120,
    height: 320,
    colors: [AUBERGINE, LILAC],
  },
  {
    file: 'monalyz-wordmark-monochrome-dark.svg',
    width: 1120,
    height: 320,
    colors: [AUBERGINE],
  },
  {
    file: 'monalyz-wordmark-reversed-white.svg',
    width: 1120,
    height: 320,
    colors: [PORCELAIN],
  },
  {
    file: 'monalyz-mark-m-primary.svg',
    width: 320,
    height: 320,
    colors: [AUBERGINE, LILAC],
  },
  {
    file: 'monalyz-mark-m-monochrome-dark.svg',
    width: 320,
    height: 320,
    colors: [AUBERGINE],
  },
  {
    file: 'monalyz-mark-m-reversed-white.svg',
    width: 320,
    height: 320,
    colors: [PORCELAIN],
  },
  {
    file: 'monalyz-app-icon.svg',
    width: 1024,
    height: 1024,
    colors: [AUBERGINE, PORCELAIN, LILAC],
  },
] as const;

export const PNG_SPECS: readonly PngSpec[] = [
  {
    file: 'monalyz-app-icon-master.png',
    source: 'monalyz-app-icon.svg',
    width: 1254,
    height: 1254,
    transparent: false,
  },
  {
    file: 'monalyz-app-icon-1024.png',
    source: 'monalyz-app-icon.svg',
    width: 1024,
    height: 1024,
    transparent: false,
  },
  {
    file: 'monalyz-app-icon-512.png',
    source: 'monalyz-app-icon.svg',
    width: 512,
    height: 512,
    transparent: false,
  },
  {
    file: 'monalyz-app-icon-192.png',
    source: 'monalyz-app-icon.svg',
    width: 192,
    height: 192,
    transparent: false,
  },
  {
    file: 'monalyz-maskable-icon-512.png',
    source: 'monalyz-app-icon.svg',
    width: 512,
    height: 512,
    transparent: false,
  },
  {
    file: 'monalyz-apple-touch-icon-180.png',
    source: 'monalyz-app-icon.svg',
    width: 180,
    height: 180,
    transparent: false,
  },
  {
    file: 'monalyz-avatar-1024.png',
    source: 'monalyz-app-icon.svg',
    width: 1024,
    height: 1024,
    transparent: false,
  },
  {
    file: 'monalyz-favicon-16.png',
    source: 'monalyz-app-icon.svg',
    width: 16,
    height: 16,
    transparent: false,
  },
  {
    file: 'monalyz-favicon-32.png',
    source: 'monalyz-app-icon.svg',
    width: 32,
    height: 32,
    transparent: false,
  },
  {
    file: 'monalyz-favicon-48.png',
    source: 'monalyz-app-icon.svg',
    width: 48,
    height: 48,
    transparent: false,
  },
  {
    file: 'monalyz-mark-m-primary.png',
    source: 'monalyz-mark-m-primary.svg',
    width: 931,
    height: 860,
    transparent: true,
  },
  {
    file: 'monalyz-mark-m-monochrome-dark.png',
    source: 'monalyz-mark-m-monochrome-dark.svg',
    width: 917,
    height: 874,
    transparent: true,
  },
  {
    file: 'monalyz-mark-m-reversed-white.png',
    source: 'monalyz-mark-m-reversed-white.svg',
    width: 917,
    height: 874,
    transparent: true,
  },
  {
    file: 'monalyz-wordmark-primary.png',
    source: 'monalyz-wordmark-primary.svg',
    width: 1399,
    height: 362,
    transparent: true,
  },
  {
    file: 'monalyz-wordmark-monochrome-dark.png',
    source: 'monalyz-wordmark-monochrome-dark.svg',
    width: 1286,
    height: 333,
    transparent: true,
  },
  {
    file: 'monalyz-wordmark-reversed-white.png',
    source: 'monalyz-wordmark-reversed-white.svg',
    width: 1279,
    height: 327,
    transparent: true,
  },
  {
    file: 'monalyz-wordmark-web-720.png',
    source: 'monalyz-wordmark-primary.svg',
    width: 720,
    height: 186,
    transparent: true,
  },
  {
    file: 'monalyz-wordmark-email-360.png',
    source: 'monalyz-wordmark-primary.svg',
    width: 360,
    height: 93,
    transparent: true,
  },
] as const;

export type GeneratedBrandAsset = {
  file: string;
  bytes: Buffer;
  width?: number;
  height?: number;
  transparent?: boolean;
};

function pathFor(file: string) {
  return join(BRAND_DIRECTORY, file);
}

async function validateSvg(spec: SvgSpec) {
  const svg = await readFile(pathFor(spec.file), 'utf8');
  const openingTags = [...svg.matchAll(/<\s*\/?\s*([a-z][\w:-]*)/gi)].map(
    (match) => match[1].toLowerCase(),
  );
  const unexpectedTags = openingTags.filter(
    (tag) => tag !== 'svg' && tag !== 'path',
  );
  assert.deepEqual(
    unexpectedTags,
    [],
    `${spec.file}: seuls les éléments <svg> et <path> sont autorisés`,
  );
  assert.doesNotMatch(
    svg,
    /<(?:text|image|filter|linearGradient|radialGradient|pattern|style|use|foreignObject)\b/i,
    `${spec.file}: élément SVG interdit`,
  );
  assert.doesNotMatch(
    svg,
    /\b(?:href|stroke|style)=/i,
    `${spec.file}: référence, contour ou style interdit`,
  );

  const root = svg.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  assert.match(root, new RegExp(`\\bwidth="${spec.width}"`), `${spec.file}: largeur`);
  assert.match(root, new RegExp(`\\bheight="${spec.height}"`), `${spec.file}: hauteur`);
  assert.match(
    root,
    new RegExp(`\\bviewBox="0 0 ${spec.width} ${spec.height}"`),
    `${spec.file}: viewBox`,
  );

  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/gi)];
  assert.ok(paths.length >= 1, `${spec.file}: au moins un tracé est requis`);

  const colors = [...svg.matchAll(/\bfill="(#[0-9a-f]{6})"/gi)].map(
    (match) => match[1].toUpperCase(),
  );
  assert.ok(colors.length >= paths.length, `${spec.file}: chaque tracé doit avoir un aplat`);
  for (const color of colors) {
    assert.ok(ALLOWED_COLORS.has(color), `${spec.file}: couleur non autorisée ${color}`);
  }
  assert.deepEqual(
    [...new Set(colors)].sort(),
    [...spec.colors].sort(),
    `${spec.file}: palette inattendue`,
  );

  const metadata = await sharp(Buffer.from(svg)).metadata();
  assert.equal(metadata.width, spec.width, `${spec.file}: largeur rendue`);
  assert.equal(metadata.height, spec.height, `${spec.file}: hauteur rendue`);
}

export async function validateBrandSvgSources() {
  await Promise.all(SVG_SPECS.map(validateSvg));
}

async function renderPng(spec: PngSpec) {
  const source = await readFile(pathFor(spec.source));
  let pipeline = sharp(source, { density: 288 }).resize(spec.width, spec.height, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3,
  });

  pipeline = spec.transparent
    ? pipeline.ensureAlpha()
    : pipeline.flatten({ background: AUBERGINE }).removeAlpha();

  return pipeline
    .png({
      compressionLevel: 9,
      adaptiveFiltering: false,
      palette: false,
    })
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
    header.writeUInt8(0, offset + 2);
    header.writeUInt8(0, offset + 3);
    header.writeUInt16LE(1, offset + 4);
    header.writeUInt16LE(32, offset + 6);
    header.writeUInt32LE(bytes.length, offset + 8);
    header.writeUInt32LE(dataOffset, offset + 12);
    dataOffset += bytes.length;
  });

  return Buffer.concat([header, ...images.map(({ bytes }) => bytes)]);
}

export function parseIcoDirectory(bytes: Buffer) {
  assert.equal(bytes.readUInt16LE(0), 0, 'ICO réservé');
  assert.equal(bytes.readUInt16LE(2), 1, 'ICO type');
  const count = bytes.readUInt16LE(4);
  const entries = Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16;
    const widthByte = bytes.readUInt8(offset);
    const heightByte = bytes.readUInt8(offset + 1);
    return {
      width: widthByte === 0 ? 256 : widthByte,
      height: heightByte === 0 ? 256 : heightByte,
      bitsPerPixel: bytes.readUInt16LE(offset + 6),
      byteLength: bytes.readUInt32LE(offset + 8),
      dataOffset: bytes.readUInt32LE(offset + 12),
    };
  });

  for (const entry of entries) {
    assert.ok(entry.dataOffset + entry.byteLength <= bytes.length, 'entrée ICO tronquée');
    assert.equal(
      bytes.subarray(entry.dataOffset, entry.dataOffset + 8).toString('hex'),
      '89504e470d0a1a0a',
      'chaque entrée ICO doit contenir un PNG',
    );
  }
  return entries;
}

async function renderSocialCard() {
  const source = await readFile(pathFor('monalyz-wordmark-primary.svg'));
  const logo = await sharp(source, { density: 288 })
    .resize(760, 218, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();

  return sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: PORCELAIN,
    },
  })
    .composite([{ input: logo, left: 220, top: 206 }])
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
}

export async function generateBrandAssets(): Promise<GeneratedBrandAsset[]> {
  const pngEntries = await Promise.all(
    PNG_SPECS.map(async (spec) => ({
      file: spec.file,
      bytes: await renderPng(spec),
      width: spec.width,
      height: spec.height,
      transparent: spec.transparent,
    })),
  );
  const pngByName = new Map(pngEntries.map((entry) => [entry.file, entry.bytes]));
  const faviconSizes = [16, 32, 48] as const;
  const favicon = createIco(
    faviconSizes.map((size) => ({
      size,
      bytes: pngByName.get(`monalyz-favicon-${size}.png`)!,
    })),
  );
  const socialCard = await renderSocialCard();

  return [
    ...pngEntries,
    { file: 'monalyz-favicon.ico', bytes: favicon },
    {
      file: 'monalyz-opengraph-1200x630.png',
      bytes: socialCard,
      width: 1200,
      height: 630,
      transparent: false,
    },
    {
      file: 'monalyz-twitter-1200x630.png',
      bytes: socialCard,
      width: 1200,
      height: 630,
      transparent: false,
    },
  ];
}

async function validateSafeZone(bytes: Buffer, label: string) {
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const background = [25, 11, 33];
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixel = (y * info.width + x) * info.channels;
      const difference =
        Math.abs(data[pixel] - background[0]) +
        Math.abs(data[pixel + 1] - background[1]) +
        Math.abs(data[pixel + 2] - background[2]);
      if (difference > 24) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  assert.ok(maxX >= 0, `${label}: symbole absent`);
  assert.ok(minX >= info.width * 0.17, `${label}: zone sûre gauche`);
  assert.ok(maxX <= info.width * 0.83, `${label}: zone sûre droite`);
  assert.ok(minY >= info.height * 0.17, `${label}: zone sûre haute`);
  assert.ok(maxY <= info.height * 0.83, `${label}: zone sûre basse`);
}

async function validateGeneratedAssets(assets: readonly GeneratedBrandAsset[]) {
  for (const asset of assets) {
    if (asset.file.endsWith('.ico')) {
      const entries = parseIcoDirectory(asset.bytes);
      assert.deepEqual(
        entries.map(({ width, height, bitsPerPixel }) => ({
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
      continue;
    }

    const metadata = await sharp(asset.bytes).metadata();
    assert.equal(metadata.format, 'png', `${asset.file}: format`);
    assert.equal(metadata.width, asset.width, `${asset.file}: largeur`);
    assert.equal(metadata.height, asset.height, `${asset.file}: hauteur`);
    assert.equal(metadata.hasAlpha, asset.transparent, `${asset.file}: transparence`);
  }

  const icon = assets.find(({ file }) => file === 'monalyz-app-icon-1024.png');
  const maskable = assets.find(({ file }) => file === 'monalyz-maskable-icon-512.png');
  assert.ok(icon, 'icône 1024 absente');
  assert.ok(maskable, 'icône maskable absente');
  await validateSafeZone(icon.bytes, icon.file);
  await validateSafeZone(maskable.bytes, maskable.file);
}

export async function buildBrandAssets() {
  await validateBrandSvgSources();
  const assets = await generateBrandAssets();
  await validateGeneratedAssets(assets);
  await Promise.all(assets.map((asset) => writeFile(pathFor(asset.file), asset.bytes)));
  return assets;
}

export async function checkBrandAssets() {
  await validateBrandSvgSources();
  const expectedAssets = await generateBrandAssets();
  await validateGeneratedAssets(expectedAssets);

  for (const expected of expectedAssets) {
    const actual = await readFile(pathFor(expected.file));
    assert.ok(
      actual.equals(expected.bytes),
      `${expected.file}: fichier absent, obsolète ou non reproductible; lancer npm run brand:build`,
    );
  }
  return expectedAssets;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
  assert.deepEqual(unknownArguments, [], `arguments inconnus: ${unknownArguments.join(', ')}`);
  const assets = checkOnly ? await checkBrandAssets() : await buildBrandAssets();
  const verb = checkOnly ? 'validés sans modification' : 'générés';
  process.stdout.write(
    `Assets Monalyz ${verb}: ${assets.length} rasters, ${SVG_SPECS.length} SVG.\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
