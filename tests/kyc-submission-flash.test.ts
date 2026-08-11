import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { consumeKycSubmissionFlash } from '../lib/kyc-submission-flash';

test('KYC submission flashes are allowlisted and consumed without losing URL state', () => {
  assert.deepEqual(
    consumeKycSubmissionFlash('https://bank.example/myaccount?flash=kyc_submitted&source=kyc#top'),
    {
      flash: 'kyc_submitted',
      nextPath: '/myaccount?source=kyc#top',
    },
  );
  assert.deepEqual(
    consumeKycSubmissionFlash('https://bank.example/myaccount?tab=dashboard&flash=kyc_resubmitted'),
    {
      flash: 'kyc_resubmitted',
      nextPath: '/myaccount?tab=dashboard',
    },
  );
});

test('unknown or missing flashes are neither displayed nor consumed', () => {
  assert.equal(
    consumeKycSubmissionFlash('https://bank.example/myaccount?flash=loan_submitted'),
    null,
  );
  assert.equal(consumeKycSubmissionFlash('https://bank.example/myaccount?tab=kyc'), null);
  assert.equal(
    consumeKycSubmissionFlash('https://bank.example/myaccount?flash=KYC_SUBMITTED'),
    null,
  );
  assert.equal(
    consumeKycSubmissionFlash('https://bank.example/myaccount?flash=%20kyc_submitted%20'),
    null,
  );
  assert.equal(
    consumeKycSubmissionFlash('https://bank.example/myaccount?flash=kyc_submitted&flash=kyc_resubmitted'),
    null,
  );
});

test('KYC submit and resubmit return to the dashboard while the existing guard stays on KYC', async () => {
  const source = await readFile(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8');

  assert.match(source, /window\.location\.replace\('\/myaccount\?tab=kyc'\)/);
  assert.match(
    source,
    /window\.location\.replace\(`\/myaccount\?flash=\$\{correctionMode \? 'kyc_resubmitted' : 'kyc_submitted'\}`\)/,
  );
  assert.equal((source.match(/\/myaccount\?tab=kyc/g) ?? []).length, 1);
});

test('the dashboard flash is temporary, pausable, accessible and independent from persistent notifications', async () => {
  const source = await readFile(new URL('../components/UserDashboard.tsx', import.meta.url), 'utf8');

  assert.match(source, /const KYC_FLASH_DURATION_MS = 10_000/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /onMouseEnter=\{\(\) => pauseFor\('hover'\)\}/);
  assert.match(source, /onMouseLeave=\{\(\) => resumeAfter\('hover'\)\}/);
  assert.match(source, /onFocusCapture=\{\(\) => pauseFor\('focus'\)\}/);
  assert.match(source, /onBlurCapture=/);
  assert.match(source, /href="\/myaccount\?tab=kyc"/);
  assert.doesNotMatch(source, /event\.preventDefault\(\)/);
  assert.doesNotMatch(source, /window\.history\.pushState/);
  assert.match(source, /notificationCopy\(language, kycSubmissionFlash\)/);
  assert.match(source, /window\.history\.replaceState\(window\.history\.state, '', consumed\.nextPath\)/);
  assert.doesNotMatch(source, /markNotificationAsRead/);
});
