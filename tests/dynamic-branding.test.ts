import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Webhook } from 'standardwebhooks';
// sharp 0.35 publishes declarations but omits the `types` export condition.
// @ts-expect-error Upstream package export-map issue; runtime import is valid.
import sharp from 'sharp';
import BrandLogo from '../components/brand/BrandLogo';
import { BrandProvider } from '../components/brand/BrandProvider';
import {
  DEFAULT_BRAND_SETTINGS,
  applyBrand,
  mapBrandSettings,
  normalizeBankName,
} from '../lib/branding';
import {
  renderSupabaseAuthEmails,
  verifySupabaseAuthWebhook,
  type SupabaseAuthEmailPayload,
} from '../lib/server/auth-email';
import { generateBrandRelease } from '../lib/server/brand-assets';
import { bankingMessages } from '../lib/banking-i18n';
import { publicMessages } from '../lib/public-i18n';

const customBrand = {
  ...DEFAULT_BRAND_SETTINGS,
  bankName: 'Banque Horizon',
  primaryLogoUrl: 'https://cdn.example.test/releases/42/primary.png',
  reversedLogoUrl: 'https://cdn.example.test/releases/42/reversed.png',
  emailLogoUrl: 'https://cdn.example.test/releases/42/email.png',
  appIcon512Url: 'https://cdn.example.test/releases/42/icon-512.png',
  primaryLogoWidth: 900,
  primaryLogoHeight: 240,
  reversedLogoWidth: 880,
  reversedLogoHeight: 230,
  revision: 42,
};

test('BrandLogo utilise les URLs, dimensions et texte alternatif publiés', () => {
  const primary = renderToStaticMarkup(
    React.createElement(
      BrandProvider,
      { initialBrand: customBrand },
      React.createElement(BrandLogo, { priority: true }),
    ),
  );
  assert.match(primary, /src="https:\/\/cdn\.example\.test\/releases\/42\/primary\.png"/);
  assert.match(primary, /width="900"/);
  assert.match(primary, /height="240"/);
  assert.match(primary, /alt="Banque Horizon"/);

  const reversed = renderToStaticMarkup(
    React.createElement(
      BrandProvider,
      { initialBrand: customBrand },
      React.createElement(BrandLogo, {
        tone: 'reversed-white',
        decorative: true,
      }),
    ),
  );
  assert.match(reversed, /reversed\.png/);
  assert.match(reversed, /alt=""/);
  assert.match(reversed, /aria-hidden="true"/);
});

test('les quatre langues interpolent la banque sans ancienne marque visible', () => {
  for (const language of ['fr', 'en', 'de', 'es'] as const) {
    const copy = JSON.stringify(
      applyBrand(
        {
          public: publicMessages[language],
          banking: bankingMessages[language],
        },
        customBrand.bankName,
      ),
    );
    assert.match(copy, /Banque Horizon/);
    assert.doesNotMatch(copy, /\{bankName\}|Monalyz/);
  }
});

test('la normalisation du nom et les URLs Storage sont déterministes', () => {
  assert.equal(normalizeBankName('  Banque   Élégance  '), 'Banque Élégance');
  assert.throws(() => normalizeBankName('A'), /2 et 80/);
  assert.throws(() => normalizeBankName('Banque\nActive'), /2 et 80/);
  const brand = mapBrandSettings(
    {
      bank_name: 'Banque Horizon',
      primary_logo_path: 'releases/42/logo principal.png',
      primary_logo_width: 900,
      primary_logo_height: 240,
      reversed_logo_path: 'releases/42/reversed.png',
      reversed_logo_width: 880,
      reversed_logo_height: 230,
      email_logo_path: 'releases/42/email.png',
      pdf_logo_path: 'releases/42/pdf.png',
      favicon_ico_path: 'releases/42/favicon.ico',
      favicon_16_path: 'releases/42/favicon-16.png',
      favicon_32_path: 'releases/42/favicon-32.png',
      favicon_48_path: 'releases/42/favicon-48.png',
      apple_touch_icon_path: 'releases/42/apple.png',
      app_icon_192_path: 'releases/42/app-192.png',
      app_icon_512_path: 'releases/42/app-512.png',
      maskable_icon_path: 'releases/42/maskable.png',
      social_card_path: 'releases/42/social.png',
      revision: 42,
      updated_at: '2026-08-01T10:00:00.000Z',
    },
    'https://project.supabase.co',
  );
  assert.equal(
    brand.primaryLogoUrl,
    'https://project.supabase.co/storage/v1/object/public/brand-assets/releases/42/logo%20principal.png',
  );
});

test('les sources produisent tous les dérivés PNG/ICO aux dimensions attendues', async () => {
  const logo = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="280"><rect width="1000" height="280" rx="30" fill="#15324b"/></svg>',
  );
  const reversed = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="280"><rect width="1000" height="280" rx="30" fill="#ffffff"/></svg>',
  );
  const favicon = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><circle cx="256" cy="256" r="240" fill="#315cf4"/></svg>',
  );
  const release = await generateBrandRelease({
    releaseId: '11111111-1111-4111-8111-111111111111',
    bankName: customBrand.bankName,
    primary: { bytes: logo, mimeType: 'image/svg+xml' },
    reversed: { bytes: reversed, mimeType: 'image/svg+xml' },
    favicon: { bytes: favicon, mimeType: 'image/svg+xml' },
  });
  assert.equal(release.assets.length, 13);
  assert.ok(release.assets.every((asset) => asset.path.startsWith('releases/11111111-1111-4111-8111-111111111111/')));
  const byPath = new Map(release.assets.map((asset) => [asset.path, asset]));
  for (const [path, size] of [
    [release.paths.favicon16, 16],
    [release.paths.favicon32, 32],
    [release.paths.favicon48, 48],
    [release.paths.appleTouchIcon, 180],
    [release.paths.appIcon192, 192],
    [release.paths.appIcon512, 512],
    [release.paths.maskableIcon, 512],
  ] as const) {
    const metadata = await sharp(byPath.get(path)!.bytes).metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
  }
  const social = await sharp(byPath.get(release.paths.socialCard)!.bytes).metadata();
  assert.deepEqual([social.width, social.height], [1200, 630]);
  assert.equal(byPath.get(release.paths.faviconIco)!.bytes.readUInt16LE(2), 1);
});

test('les SVG actifs, favicons non carrés et images surdimensionnées sont refusés', async () => {
  const safeLogo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128"><rect width="512" height="128"/></svg>');
  const active = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128"><script>alert(1)</script></svg>');
  const nonSquare = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256"><rect width="512" height="256"/></svg>');
  const base = {
    releaseId: '22222222-2222-4222-8222-222222222222',
    bankName: 'Banque Test',
    primary: { bytes: safeLogo, mimeType: 'image/svg+xml' },
    reversed: { bytes: safeLogo, mimeType: 'image/svg+xml' },
    favicon: { bytes: nonSquare, mimeType: 'image/svg+xml' },
  };
  await assert.rejects(() => generateBrandRelease(base), /favicon.*carré/i);
  await assert.rejects(
    () => generateBrandRelease({ ...base, primary: { bytes: active, mimeType: 'image/svg+xml' } }),
    /actif.*interdit/i,
  );
  await assert.rejects(
    () => generateBrandRelease({ ...base, primary: { bytes: Buffer.alloc(5 * 1024 * 1024 + 1), mimeType: 'image/png' } }),
    /5 Mo/,
  );
});

test('le hook Auth rend la marque et respecte le double changement d’e-mail sécurisé', () => {
  const payload: SupabaseAuthEmailPayload = {
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'current@example.test',
      new_email: 'new@example.test',
      user_metadata: { preferred_language: 'en' },
    },
    email_data: {
      email_action_type: 'email_change',
      token: '111111',
      token_new: '222222',
      token_hash: 'hash-for-new-address',
      token_hash_new: 'hash-for-current-address',
      redirect_to: 'https://app.example.test/settings',
    },
  };
  const messages = renderSupabaseAuthEmails(
    payload,
    customBrand,
    'https://app.example.test',
  );
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map((message) => message.recipientEmail), [
    'current@example.test',
    'new@example.test',
  ]);
  assert.match(messages[0].email.html, /hash-for-current-address/);
  assert.match(messages[1].email.html, /hash-for-new-address/);
  assert.match(messages[1].email.html, /Banque Horizon/);
  assert.match(messages[1].email.html, /releases\/42\/email\.png/);
  assert.doesNotMatch(messages[1].email.html, /Monalyz/);
});

test('le hook Auth produit une confirmation OTP personnalisée sans lien', () => {
  const messages = renderSupabaseAuthEmails(
    {
      user: {
        email: 'client@example.test',
        user_metadata: {
          preferred_language: 'de',
          display_name: 'Ada Beispiel',
        },
      },
      email_data: {
        email_action_type: 'signup',
        token: '305805',
        token_hash: 'ce-hash-ne-doit-pas-etre-rendu',
        redirect_to: 'https://app.example.test/onboarding',
      },
    },
    customBrand,
    'https://app.example.test',
  );

  assert.equal(messages.length, 1);
  assert.match(messages[0].email.subject, /Bestätigungscode/);
  assert.match(messages[0].email.html, /Ada Beispiel/);
  assert.match(messages[0].email.html, />305805</);
  assert.match(messages[0].email.text, /305805/);
  assert.doesNotMatch(messages[0].email.html, /ce-hash-ne-doit-pas-etre-rendu|auth\/confirm|href=/);
  assert.throws(
    () =>
      renderSupabaseAuthEmails(
        {
          user: { email: 'client@example.test' },
          email_data: { email_action_type: 'signup', token: '123' },
        },
        customBrand,
        'https://app.example.test',
      ),
    /OTP.*invalide/,
  );
});

test('le hook Auth accepte uniquement une signature Standard Webhooks valide', () => {
  const secretBytes = Buffer.alloc(32, 7);
  const configuredSecret = `v1,whsec_${secretBytes.toString('base64')}`;
  const payload = JSON.stringify({
    user: { email: 'client@example.test' },
    email_data: { email_action_type: 'recovery', token_hash: 'hash' },
  });
  const webhook = new Webhook(secretBytes.toString('base64'));
  const id = 'msg_11111111';
  const timestamp = new Date();
  const signature = webhook.sign(id, timestamp, payload);
  const verified = verifySupabaseAuthWebhook(
    payload,
    {
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': signature,
    },
    configuredSecret,
  );
  assert.equal(verified.user?.email, 'client@example.test');
  assert.throws(
    () =>
      verifySupabaseAuthWebhook(
        `${payload} `,
        {
          'webhook-id': id,
          'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
          'webhook-signature': signature,
        },
        configuredSecret,
      ),
    /signature|No matching/i,
  );
});
