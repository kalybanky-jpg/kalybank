import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('the root viewport stays inside mobile device safe areas', () => {
  const source = readSource('app/layout.tsx');

  assert.match(source, /export const viewport:\s*Viewport\s*=\s*\{/);
  assert.match(source, /width:\s*['"]device-width['"]/);
  assert.match(source, /initialScale:\s*1/);
  assert.match(source, /viewportFit:\s*['"]contain['"]/);
  assert.doesNotMatch(source, /viewportFit:\s*['"]cover['"]/);
});

test('the application shell uses dynamic viewport height with a legacy fallback', () => {
  const styles = readSource('app/globals.css');
  const shell = readSource('components/MainAppLayout.tsx');

  assert.match(
    styles,
    /\.min-h-app-screen\s*\{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/,
  );
  assert.doesNotMatch(shell, /\bmin-h-screen\b/);
  assert.equal(shell.match(/\bmin-h-app-screen\b/g)?.length, 4);
});

test('the root document and application shell prevent horizontal viewport overflow', () => {
  const styles = readSource('app/globals.css');
  const shell = readSource('components/MainAppLayout.tsx');

  assert.match(styles, /html,\s*\n\s*body\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*clip;/);
  assert.match(styles, /@supports not \(overflow:\s*clip\)/);
  assert.match(shell, /max-w-full overflow-x-clip/);
});
