import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('the store keeps immutable base currency separate from display currency', async () => {
  const store = await source('lib/store.tsx');

  assert.match(store, /baseCurrency:\s*Currency/);
  assert.match(
    store,
    /const \[baseCurrency, setBaseCurrency\] = useState<Currency>\('EUR'\)/,
  );
  assert.match(
    store,
    /select\('user_id,email,display_name,preferred_language,base_currency,preferred_currency'\)/,
  );
  assert.match(store, /setBaseCurrency\(ownProfile\.base_currency\)/);
  assert.match(store, /setCurrency\(ownProfile\.preferred_currency\)/);
});

test('user totals convert every source amount before aggregation', async () => {
  const dashboard = await source('components/UserDashboard.tsx');

  assert.match(dashboard, /const totalBalance = sumConvertedAmounts\(/);
  assert.match(dashboard, /const monthlyCredits = sumConvertedAmounts\(/);
  assert.match(
    dashboard,
    /convertAnyAmount\(amount, sourceCurrency, currency, rates\)/,
  );
  assert.doesNotMatch(
    dashboard,
    /reduce\(\(sum, account\) => sum \+ account\.balance/,
  );
  assert.doesNotMatch(
    dashboard,
    /reduce\(\(sum, transaction\) => sum \+ Math\.abs\(transaction\.amount\)/,
  );
});

test('all user read views render through the display conversion', async () => {
  const paths = [
    'components/UserAccountsView.tsx',
    'components/UserTransfersView.tsx',
    'components/UserLoansView.tsx',
  ];

  for (const path of paths) {
    const view = await source(path);
    assert.match(view, /convertAnyAmount\(amount, sourceCurrency, currency, rates\)/, path);
    assert.match(view, /formatDirectCurrency\(/, path);
  }
});

test('loan products and submissions use base currency, never display currency', async () => {
  const modal = await source('components/LoanApplicationModal.tsx');

  assert.match(modal, /settings\.currency === baseCurrency/);
  assert.match(modal, /currency:\s*baseCurrency/);
  assert.doesNotMatch(modal, /settings\.currency === currency/);
});
