import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const scannedRoots = ['app', 'components', 'lib'];
const allowedLines: Record<string, readonly RegExp[]> = {
  'components/AdminSettingsView.tsx': [
    /referencePrefix: 'Monalyz-'/,
    /placeholder="Monalyz-"/,
  ],
  'lib/branding.ts': [
    /bank_name: 'Monalyz'/,
    /replaceAll\('MONALYZ'/,
    /replaceAll\('Monalyz'/,
  ],
  'lib/server/official-document-pdf.ts': [
    /bankName \|\| 'Monalyz'/,
  ],
  'lib/server/transactional-email.ts': [
    /TRANSACTIONAL_EMAIL_FROM_NAME.*\|\| 'Monalyz'/,
    /bankName\?\.trim\(\) \|\| 'Monalyz'/,
  ],
  'lib/types.ts': [/Balance maintained by bank staff in Monalyz/],
};

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true,
  });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(relative);
      return /\.tsx?$/.test(entry.name) ? [relative] : [];
    }),
  );
  return nested.flat();
}

test('aucune nouvelle occurrence visible de Monalyz ne peut être codée en dur', async () => {
  const violations: string[] = [];
  for (const directory of scannedRoots) {
    for (const relativePath of await sourceFiles(directory)) {
      const normalizedPath = relativePath.replaceAll('\\', '/');
      const content = await readFile(path.join(root, relativePath), 'utf8');
      content.split(/\r?\n/).forEach((line, index) => {
        if (!/Monalyz|MONALYZ/.test(line)) return;
        const allowed = allowedLines[normalizedPath] ?? [];
        if (!allowed.some((pattern) => pattern.test(line))) {
          violations.push(`${normalizedPath}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Remplacez les marques visibles par {bankName}.\n${violations.join('\n')}`,
  );
});
