import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BrandLogo, {
  type BrandLogoKind,
  type BrandLogoTone,
} from '../components/brand/BrandLogo';

const kinds: BrandLogoKind[] = ['wordmark', 'mark'];
const tones: BrandLogoTone[] = [
  'primary',
  'monochrome-dark',
  'reversed-white',
];

test('BrandLogo renders all six approved asset variants with stable dimensions', () => {
  for (const kind of kinds) {
    for (const tone of tones) {
      const markup = renderToStaticMarkup(
        React.createElement(BrandLogo, { kind, tone, className: 'brand-test' }),
      );
      const assetName = kind === 'wordmark' ? 'wordmark' : 'mark-m';

      assert.match(
        markup,
        new RegExp(`monalyz-${assetName}-${tone}\\.svg`),
      );
      assert.match(markup, /class="brand-test"/);
      assert.match(markup, /alt="Monalyz"/);
      assert.match(
        markup,
        kind === 'wordmark'
          ? /width="1120" height="320"/
          : /width="320" height="320"/,
      );
    }
  }
});

test('BrandLogo is removed from the accessibility tree when decorative', () => {
  const markup = renderToStaticMarkup(
    React.createElement(BrandLogo, {
      kind: 'mark',
      tone: 'reversed-white',
      decorative: true,
    }),
  );

  assert.match(markup, /alt=""/);
  assert.match(markup, /aria-hidden="true"/);
});

test('BrandLogo forwards priority to the image loading strategy', () => {
  const markup = renderToStaticMarkup(
    React.createElement(BrandLogo, { priority: true }),
  );

  assert.match(markup, /<link rel="preload" as="image"/);
  assert.match(markup, /monalyz-wordmark-primary\.svg/);
});
