import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readFileUtf8 = (relPath: string) =>
  readFile(new URL(relPath, import.meta.url), 'utf8');

test('LoanApplicationModal enforces KYC approval gate', async () => {
  const source = await readFileUtf8('../components/LoanApplicationModal.tsx');

  // Verify KYC approval check logic
  assert.match(source, /const activeKyc = kycApplications\[0\];/);
  assert.match(source, /const isKycApproved = activeKyc\?\.workflowStatus === 'approved';/);
  // Verify blocked view render when not approved
  assert.match(source, /\{!isKycApproved \?/);
  assert.match(source, /copy\.loanModal\.kycRequiredTitle/);
  assert.match(source, /ShieldAlert/);
  assert.match(source, /\/onboarding/);
});

test('lib/store.tsx addLoanApplication guards against unapproved KYC', async () => {
  const source = await readFileUtf8('../lib/store.tsx');

  assert.match(source, /const activeKyc = kycApplications\[0\];/);
  assert.match(source, /if \(!activeKyc \|\| activeKyc\.workflowStatus !== 'approved'\)/);
  assert.match(source, /throw new Error\(message\);/);
  assert.match(source, /'APPROVED_KYC_REQUIRED'/);
});

test('supabase/schema.sql and migration enforce approved KYC in submit_loan_application', async () => {
  const migration = await readFileUtf8('../supabase/migrations/20260914230000_require_approved_kyc_for_loans.sql');
  const schema = await readFileUtf8('../supabase/schema.sql');

  const checkPattern = /from\s+public\.kyc_applications\s+where\s+owner_id\s*=\s*caller_id\s+and\s+status\s*=\s*'approved'/;
  const raisePattern = /raise\s+exception\s+'APPROVED_KYC_REQUIRED'\s+using\s+errcode\s*=\s*'23514';/;

  assert.match(migration, checkPattern);
  assert.match(migration, raisePattern);
  assert.match(schema, checkPattern);
  assert.match(schema, raisePattern);
});

test('translations cover APPROVED_KYC_REQUIRED and KYC notices across i18n files', async () => {
  const userI18n = await readFileUtf8('../lib/user-i18n.ts');
  const bankingI18n = await readFileUtf8('../lib/banking-i18n.ts');

  assert.match(userI18n, /APPROVED_KYC_REQUIRED/);
  assert.match(userI18n, /kycRequiredTitle/);
  assert.match(userI18n, /kycRequiredNoFile/);
  assert.match(bankingI18n, /kycRequiredNotice/);
  assert.match(bankingI18n, /completeKyc/);
});
