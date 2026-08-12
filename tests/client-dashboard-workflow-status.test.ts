import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('the client dashboard renders settled loans and transfers as terminal', () => {
  const dashboard = source('components/UserDashboard.tsx');

  assert.match(dashboard, /const isDisbursed = activeLoan\.status === 'decaisse'/);
  assert.match(dashboard, /isDisbursed[\s\S]*?stepNumber <= normalizedStep/);
  assert.match(dashboard, /activeLoan\.status === 'decaisse'[\s\S]*?t\.completed/);
  assert.match(dashboard, /const activeTransfers = pendingTransfers\.filter/);
  assert.match(dashboard, /banking\.transfers\.statuses\[transfer\.workflowStatus/);
  assert.doesNotMatch(dashboard, /<ChevronRight/);
});

test('security and compliance appears before recent transactions', () => {
  const dashboard = source('components/UserDashboard.tsx');
  const compliance = dashboard.indexOf('{t.securityCompliance}');
  const transactions = dashboard.indexOf('{t.recentTransactions}');

  assert.ok(compliance >= 0);
  assert.ok(transactions >= 0);
  assert.ok(compliance < transactions);
});

test('transfer approval notes are optional while rejection reasons remain required', () => {
  const admin = source('components/AdminTransfersView.tsx');
  const store = source('lib/store.tsx');
  const migration = source(
    'supabase/migrations/20260812144154_optional_transfer_validation_notes_and_progress_emails.sql',
  );

  assert.match(admin, /disabled=\{isSubmitting \|\| !enabled\}/);
  assert.match(admin, /motif de refus \(obligatoire\)/);
  assert.match(store, /p_note: note\?\.trim\(\) \|\| undefined/);
  assert.match(store, /Le motif de refus est obligatoire/);
  assert.match(migration, /p_note text default null/g);
  assert.match(migration, /recipient_email,[\s\S]*?'transfer_check_validated'/);
  assert.match(migration, /new\.check_kind <> 'final_authorization'/);
});
