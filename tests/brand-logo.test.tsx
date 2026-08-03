import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BrandLogo, {
  type BrandLogoProps,
  type BrandLogoKind,
  type BrandLogoTone,
} from '../components/brand/BrandLogo';
import { BrandProvider } from '../components/brand/BrandProvider';
import { DEFAULT_BRAND_SETTINGS } from '../lib/branding';

const kinds: BrandLogoKind[] = ['wordmark', 'mark'];
const tones: BrandLogoTone[] = [
  'primary',
  'monochrome-dark',
  'reversed-white',
];

function renderBrandLogo(props: BrandLogoProps = {}) {
  return renderToStaticMarkup(
    React.createElement(
      BrandProvider,
      { initialBrand: DEFAULT_BRAND_SETTINGS },
      React.createElement(BrandLogo, props),
    ),
  );
}

test('BrandLogo renders every supported kind and tone with the published brand assets', () => {
  for (const kind of kinds) {
    for (const tone of tones) {
      const markup = renderBrandLogo({ kind, tone, className: 'brand-test' });
      const expectedSource = kind === 'mark'
        ? DEFAULT_BRAND_SETTINGS.appIcon512Url
        : tone === 'reversed-white'
          ? DEFAULT_BRAND_SETTINGS.reversedLogoUrl
          : DEFAULT_BRAND_SETTINGS.primaryLogoUrl;

      assert.ok(markup.includes(`src="${expectedSource}"`));
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
  const markup = renderBrandLogo({
    kind: 'mark',
    tone: 'reversed-white',
    decorative: true,
  });

  assert.match(markup, /alt=""/);
  assert.match(markup, /aria-hidden="true"/);
});

test('BrandLogo forwards priority to the image loading strategy', () => {
  const markup = renderBrandLogo({ priority: true });

  assert.match(markup, /<link rel="preload" as="image"/);
  assert.ok(markup.includes(DEFAULT_BRAND_SETTINGS.primaryLogoUrl));
  assert.match(markup, /fetchPriority="high"/);
  assert.match(markup, /loading="eager"/);
});
