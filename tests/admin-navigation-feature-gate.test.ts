import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ADMIN_FEATURES, resolveAdminTab } from '../lib/admin-features';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Audit & Registres is disabled centrally and cannot be opened directly', () => {
  assert.equal(ADMIN_FEATURES.auditAndRegistry, false);
  assert.equal(resolveAdminTab('documents'), 'dashboard');
  assert.equal(resolveAdminTab('unknown-admin-tab'), 'dashboard');
  assert.equal(resolveAdminTab('clients'), 'clients');
});

test('the disabled audit feature is removed from navigation and dashboard CTAs', () => {
  const sidebar = source('components/Sidebar.tsx');
  const dashboard = source('components/AdminDashboard.tsx');

  assert.match(sidebar, /item\.id !== 'documents' \|\| ADMIN_FEATURES\.auditAndRegistry/);
  assert.match(dashboard, /const resolvedActiveTab = resolveAdminTab\(activeTab\)/);
  assert.match(dashboard, /ADMIN_FEATURES\.auditAndRegistry && \(/);
  assert.match(dashboard, /url\.searchParams\.delete\('tab'\)/);
});
