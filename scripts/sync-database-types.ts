import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'lib/supabase/database.types.ts');
const supabaseCli = resolve(
  projectRoot,
  'node_modules/supabase/dist/supabase.js',
);
const databaseTarget = process.argv.includes('--linked') ? '--linked' : '--local';
const checkOnly = process.argv.includes('--check');

const result = spawnSync(
  process.execPath,
  [
    supabaseCli,
    'gen',
    'types',
    'typescript',
    databaseTarget,
    '--schema',
    'public,private',
  ],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const generatedTypes = result.stdout
  .replace(/\r\n/g, '\n')
  .replace(
    /(?:  \/\/[^\n]*\n)*  __InternalSupabase: \{\n(?:    [^\n]*\n)*?  \}\n/,
    '',
  )
  .trimEnd()
  .concat('\n');

if (checkOnly) {
  const committedTypes = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
  if (committedTypes !== generatedTypes) {
    process.stderr.write(
      'Les types Supabase versionnés ne correspondent pas au schéma généré.\n',
    );
    process.exit(1);
  }
  process.stdout.write('Les types Supabase sont synchronisés.\n');
} else {
  writeFileSync(outputPath, generatedTypes, 'utf8');
  process.stdout.write(`Types Supabase générés depuis ${databaseTarget}.\n`);
}
