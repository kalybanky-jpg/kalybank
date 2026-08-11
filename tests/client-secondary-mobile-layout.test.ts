import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const viewPaths = [
  'components/UserAccountsView.tsx',
  'components/UserTransfersView.tsx',
  'components/UserLoansView.tsx',
  'components/UserDocumentsView.tsx',
  'components/UserKycStatusView.tsx',
  'components/UserSettingsView.tsx',
] as const;

test('secondary client views reserve narrow-screen width and support-button space', () => {
  for (const path of viewPaths) {
    const source = readSource(path);

    assert.match(source, /\bmin-w-0\b/, path);
    assert.match(source, /\bp-4\b/, path);
    assert.match(source, /\bsm:p-6\b/, path);
    assert.match(
      source,
      /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/,
      path,
    );
  }
});

test('account and transfer rows stack and allow identifiers to wrap on mobile', () => {
  const accounts = readSource('components/UserAccountsView.tsx');
  const transfers = readSource('components/UserTransfersView.tsx');

  assert.match(accounts, /flex min-w-0 flex-col items-stretch/);
  assert.match(
    accounts,
    /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/,
  );
  assert.match(accounts, /break-all font-mono/);

  assert.match(transfers, /flex min-w-0 flex-col gap-3 sm:flex-row/);
  assert.match(transfers, /break-all font-mono/);
  assert.match(transfers, /w-full shrink-0[^"\n]*sm:w-auto/);
});

test('loan, document, KYC and settings layouts start with one mobile column', () => {
  const loans = readSource('components/UserLoansView.tsx');
  const documents = readSource('components/UserDocumentsView.tsx');
  const kyc = readSource('components/UserKycStatusView.tsx');
  const settings = readSource('components/UserSettingsView.tsx');

  assert.match(loans, /grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2/);
  assert.match(loans, /grid grid-cols-1 gap-3 sm:grid-cols-2/);
  assert.match(loans, /break-all font-mono/);
  assert.match(loans, /md:col-span-2/);

  assert.match(documents, /flex min-w-0 flex-col gap-4 py-4 sm:flex-row/);
  assert.match(documents, /\[overflow-wrap:anywhere\]/);
  assert.match(documents, /w-full shrink-0[^"\n]*sm:w-auto/);

  assert.match(kyc, /inline-flex w-full min-w-0[^"\n]*sm:w-auto/);
  assert.match(kyc, /grid gap-4 sm:grid-cols-2/);

  assert.match(settings, /grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2/);
  assert.match(settings, /flex min-w-0 flex-col items-start[^"\n]*sm:flex-row/);
  assert.match(settings, /flex w-full items-center justify-center[^"\n]*sm:w-auto/);
});
