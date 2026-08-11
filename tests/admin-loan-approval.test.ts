import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('admin loan approval is one explicit action with a separate disbursement', () => {
  const view = source('components/AdminLoansView.tsx');

  assert.match(view, /approveLoan\(selected\.id, note\.trim\(\)\)/);
  assert.match(view, /Approuver le prêt/);
  assert.match(view, /disburseLoan\(/);
  assert.match(view, /le crédit du compte reste une action séparée/);
  assert.doesNotMatch(view, /maker\s*\/\s*checker|checklist|contrôles requis|Valider le prêt/i);
});

test('the dashboard presents loan decisions without manual-check progress indicators', () => {
  const dashboard = source('components/AdminDashboard.tsx');

  assert.match(dashboard, /label: 'Prêts à approuver'/);
  assert.match(dashboard, /label: 'Prêts à décaisser'/);
  assert.match(dashboard, /L’approbation des prêts reste[\s\S]*une décision unique/);
  assert.doesNotMatch(dashboard, /maker\s*\/\s*checker|loan\.currentStep|loan\.complianceProgress/);
});

test('the existing privileged approval and disbursement RPCs stay distinct', () => {
  const store = source('lib/store.tsx');

  assert.match(store, /rpc\('branch_manager_approve_loan'/);
  assert.match(store, /rpc\('branch_manager_disburse_loan'/);
  assert.equal((store.match(/branch_manager_approve_loan/g) ?? []).length, 1);
  assert.equal((store.match(/branch_manager_disburse_loan/g) ?? []).length, 1);
});
