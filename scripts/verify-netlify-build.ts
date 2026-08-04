import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brandingManifestPath = resolve(
  repositoryRoot,
  '.next/server/app/api/admin/branding/route.js.nft.json',
);
const requiredLinuxPackages = [
  '@img/sharp-linux-x64',
  '@img/sharp-libvips-linux-x64',
] as const;

type NftManifest = {
  files?: unknown;
};

async function verifyNetlifyBuild() {
  let manifest: NftManifest;
  try {
    manifest = JSON.parse(
      await readFile(brandingManifestPath, 'utf8'),
    ) as NftManifest;
  } catch (error) {
    throw new Error(
      `Artefact Netlify introuvable ou invalide : ${brandingManifestPath}`,
      { cause: error },
    );
  }

  if (
    !Array.isArray(manifest.files) ||
    !manifest.files.every((entry): entry is string => typeof entry === 'string')
  ) {
    throw new Error('Le manifeste NFT de la route de marque est invalide.');
  }

  const tracedFiles = manifest.files.map((entry) =>
    entry.replaceAll('\\', '/'),
  );
  const hasSharpAddon = tracedFiles.some((entry) =>
    /\/node_modules\/@img\/sharp-linux-x64\/lib\/[^/]+\.node$/.test(entry),
  );
  const hasLibvips = tracedFiles.some((entry) =>
    /\/node_modules\/@img\/sharp-libvips-linux-x64\/lib\/libvips-cpp\.so(?:\..+)?$/.test(
      entry,
    ),
  );

  if (!hasSharpAddon || !hasLibvips) {
    const missingPackages: string[] = [];
    if (!hasSharpAddon) missingPackages.push(requiredLinuxPackages[0]);
    if (!hasLibvips) missingPackages.push(requiredLinuxPackages[1]);
    throw new Error(
      `Build Netlify incomplet : binaires Linux absents (${missingPackages.join(', ')}).`,
    );
  }

  process.stdout.write(
    `Build Netlify vérifié : ${requiredLinuxPackages.join(', ')}.\n`,
  );
}

verifyNetlifyBuild().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Build Netlify invalide.'}\n`,
  );
  process.exitCode = 1;
});
