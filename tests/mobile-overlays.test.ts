import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const modalFiles = [
  'components/WireTransferModal.tsx',
  'components/LoanApplicationModal.tsx',
  'components/AccountStatementsModal.tsx',
];

test('client modals are viewport-bounded bottom sheets with safe-area-aware scrolling', () => {
  for (const file of modalFiles) {
    const source = readSource(file);

    assert.match(source, /items-end[^"]*sm:items-center/);
    assert.match(source, /max-h-dvh/);
    assert.match(source, /rounded-t-3xl[^"]*sm:rounded-3xl/);
    assert.match(source, /overflow-y-auto/);
    assert.match(source, /safe-area-inset-top/);
    assert.match(source, /safe-area-inset-bottom/);
    assert.match(source, /\bp-4\b[^"]*\bsm:p-6\b/);
  }
});

test('multi-step client modals keep responsive trackers and stacked full-width actions', () => {
  const wire = readSource('components/WireTransferModal.tsx');
  const loan = readSource('components/LoanApplicationModal.tsx');

  for (const source of [wire, loan]) {
    assert.match(source, /flex-col-reverse[^"]*sm:flex-row/);
    assert.match(source, /\bw-full\b[^"]*\bsm:w-auto\b/);
    assert.match(source, /whitespace-normal text-center leading-tight/);
  }

  assert.match(wire, /grid-cols-3[^"]*sm:flex/);
  assert.match(wire, /grid-cols-1[^"]*min-\[360px\]:grid-cols-2[^"]*sm:grid-cols-3/);
  assert.match(loan, /grid-cols-2[^"]*sm:flex/);
  assert.match(loan, /hidden[^"]*sm:block/);
});

test('statement and notification rows wrap long values on narrow screens', () => {
  const statements = readSource('components/AccountStatementsModal.tsx');
  const notifications = readSource('components/NotificationsDrawer.tsx');

  assert.match(statements, /flex-col[^"]*sm:flex-row/);
  assert.match(statements, /break-all/);
  assert.match(statements, /\bw-full\b[^"]*\bsm:w-auto\b/);

  assert.match(notifications, /h-dvh max-h-dvh/);
  assert.match(notifications, /flex-col[^"]*sm:flex-row/);
  assert.match(notifications, /safe-area-inset-top/);
  assert.match(notifications, /safe-area-inset-bottom/);
  assert.match(notifications, /break-words/);
});
