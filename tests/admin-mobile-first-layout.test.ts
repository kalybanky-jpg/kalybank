import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const tabularViews = [
  'components/AdminDashboard.tsx',
  'components/AdminLoansView.tsx',
  'components/AdminTransfersView.tsx',
  'components/AdminKycManagement.tsx',
  'components/AdminClientsView.tsx',
  'components/AdminAccountsView.tsx',
] as const;

const dialogViews = [
  'components/AdminLoansView.tsx',
  'components/AdminTransfersView.tsx',
  'components/AdminKycManagement.tsx',
  'components/AdminAccountsView.tsx',
  'components/AdminDocumentsView.tsx',
] as const;

test('admin data tables use mobile cards below md and desktop tables from md', () => {
  for (const path of tabularViews) {
    const source = readSource(path);

    assert.match(source, /grid min-w-0 gap-3 md:hidden/, path);
    assert.match(source, /hidden overflow-x-auto md:block/, path);
    assert.match(source, /<table/, path);
  }
});

test('admin overlays are accessible, viewport-bounded bottom sheets', () => {
  for (const path of dialogViews) {
    const source = readSource(path);

    assert.match(source, /Dialog, DialogBackdrop, DialogPanel/, path);
    assert.match(source, /ariaLabelledBy=/, path);
    assert.match(source, /DialogBackdrop className="fixed inset-0[^\n]*items-end/, path);
    assert.match(source, /max-h-dvh/, path);
    assert.match(source, /rounded-t-3xl/, path);
    assert.match(source, /overflow-y-auto overscroll-contain/, path);
    assert.match(source, /safe-area-inset-top/, path);
    assert.match(source, /safe-area-inset-bottom/, path);
    assert.match(source, /min-h-11 min-w-11/, path);
  }
});

test('narrow admin layouts wrap identifiers and keep primary actions touch-sized', () => {
  const loans = readSource('components/AdminLoansView.tsx');
  const transfers = readSource('components/AdminTransfersView.tsx');
  const kyc = readSource('components/AdminKycManagement.tsx');
  const accounts = readSource('components/AdminAccountsView.tsx');
  const clients = readSource('components/AdminClientsView.tsx');
  const documents = readSource('components/AdminDocumentsView.tsx');
  const balance = readSource('components/AdminBalanceAdjustmentView.tsx');
  const settings = readSource('components/AdminSettingsView.tsx');

  for (const source of [loans, transfers, kyc, accounts, clients, documents]) {
    assert.match(source, /break-all/, 'identifiers must wrap rather than widen the viewport');
    assert.match(source, /min-h-11 w-full/, 'mobile actions must expose a 44px target');
  }

  assert.match(kyc, /grid-cols-1[^"\n]*sm:grid-cols-\[minmax\(0,1fr\)_170px\]/);
  assert.match(balance, /grid-cols-1[^"\n]*min-\[360px\]:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(settings, /grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2/);
});

test('the mobile navigation uses the common focus-trapped drawer', () => {
  const sidebar = readSource('components/Sidebar.tsx');
  const header = readSource('components/Header.tsx');
  const passwordField = readSource('components/auth/PasswordField.tsx');

  assert.match(sidebar, /<Drawer/);
  assert.match(sidebar, /ariaLabelledBy="mobile-navigation-title"/);
  assert.match(sidebar, /<DialogBackdrop/);
  assert.match(sidebar, /<DialogPanel/);
  assert.match(sidebar, /h-\[100dvh\]/);
  assert.match(sidebar, /min-h-11 w-full/);
  assert.match(header, /min-h-11 min-w-11/);
  assert.match(header, /min-h-11 w-full/);
  assert.match(passwordField, /h-11 w-11/);
});
