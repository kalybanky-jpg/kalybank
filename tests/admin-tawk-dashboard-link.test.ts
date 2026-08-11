import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('the admin menu distinguishes support archives from the live Tawk dashboard', () => {
  const sidebar = source('components/Sidebar.tsx');
  const archivesIndex = sidebar.indexOf("label: 'Archives support'");
  const liveIndex = sidebar.indexOf("label: 'Messages en direct · Tawk.to'");

  assert.ok(archivesIndex >= 0);
  assert.ok(liveIndex > archivesIndex);
  assert.match(sidebar, /href: 'https:\/\/dashboard\.tawk\.to\/'/);
  assert.match(sidebar, /target="_blank"/);
  assert.match(sidebar, /rel="noopener noreferrer"/);
  assert.match(sidebar, /onClick=\{onCloseMobile\}/);
});

test('the external menu link contains no Tawk widget configuration', () => {
  const sidebar = source('components/Sidebar.tsx');

  assert.doesNotMatch(
    sidebar,
    /TAWK_WIDGET|propertyId|widgetId|embed\.tawk\.to|6a781ad559ec5c1d4962a404/,
  );
});

test('the internal transcript view is consistently named Archives support', () => {
  const sidebar = source('components/Sidebar.tsx');
  const view = source('components/AdminSupportMessagesView.tsx');

  assert.match(sidebar, />Archives support</);
  assert.match(sidebar, /Ouvrir les archives/);
  assert.match(view, />Archives support</);
  assert.doesNotMatch(view, />Messagerie support</);
});
