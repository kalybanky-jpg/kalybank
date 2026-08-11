import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('the client dashboard can shrink to narrow mobile viewports', () => {
  const dashboard = source('components/UserDashboard.tsx');

  assert.match(
    dashboard,
    /xl:grid-cols-\[minmax\(0,1\.28fr\)_minmax\(0,1fr\)\]/,
  );
  assert.match(dashboard, /grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4/);
  assert.match(
    dashboard,
    /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.doesNotMatch(dashboard, /grid-cols-\[125px_1fr\]/);
});

test('mobile navigation remains usable on short and notched screens', () => {
  const header = source('components/Header.tsx');
  const sidebar = source('components/Sidebar.tsx');
  const shell = source('components/MainAppLayout.tsx');

  assert.match(header, /safe-area-inset-left/);
  assert.match(header, /safe-area-inset-top/);
  assert.match(header, /className="md:hidden \[&_select\]/);
  assert.match(header, /mt-3 min-w-0 sm:hidden/);

  assert.match(sidebar, /h-\[100dvh\]/);
  assert.match(sidebar, /max-w-\[calc\(100vw-1\.5rem\)\]/);
  assert.match(sidebar, /overflow-y-auto overscroll-contain/);
  assert.match(sidebar, /safe-area-inset-bottom/);

  assert.match(shell, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(shell, /<main className="min-w-0 flex-1">/);
});
