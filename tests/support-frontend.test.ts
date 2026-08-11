import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SUPPORTED_LANGUAGES } from '../lib/language';
import { parsePushRegistrationPayload } from '../lib/support/push-registration';
import { extraUserMessages } from '../lib/user-i18n';

const readSource = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('le widget tawk est réservé aux clients avec un lanceur flottant', async () => {
  const [rootLayout, mainLayout, onboardingLayout, header, provider, button, login, register, resetPin] =
    await Promise.all([
      readSource('app/layout.tsx'),
      readSource('components/MainAppLayout.tsx'),
      readSource('app/onboarding/layout.tsx'),
      readSource('components/Header.tsx'),
      readSource('components/support/SupportProvider.tsx'),
      readSource('components/support/SupportButton.tsx'),
      readSource('app/login/page.tsx'),
      readSource('app/register/page.tsx'),
      readSource('app/reset-pin/page.tsx'),
    ]);

  assert.doesNotMatch(rootLayout, /SupportProvider|embed\.tawk\.to/);
  assert.match(mainLayout, /<SupportProvider>/);
  assert.match(mainLayout, /currentRole === 'user' && <SupportButton variant="floating"/);
  assert.match(onboardingLayout, /<SupportProvider>/);
  assert.match(onboardingLayout, /<SupportButton variant="floating"/);
  assert.doesNotMatch(header, /SupportButton/);
  assert.match(provider, /const tawkEnabled = role !== 'admin'/);
  assert.match(provider, /if \(!tawkEnabled\) return/);
  assert.match(button, /if \(role === 'admin' \|\| \(variant === 'floating' && chatOpen\)\) return null/);
  assert.match(button, /bottom-\[calc\(1rem\+env\(safe-area-inset-bottom\)\)\]/);
  for (const publicPage of [login, register, resetPin]) {
    assert.doesNotMatch(publicPage, /SupportProvider|embed\.tawk\.to|Tawk_API/);
  }
});

test('le provider tawk utilise le contrat Secure Mode et nettoie chaque session', async () => {
  const source = await readSource('components/support/SupportProvider.tsx');

  assert.match(source, /\/api\/support\/tawk-identity\?language=/);
  assert.match(source, /userId:\s*identity\.userId/);
  assert.match(source, /hash:\s*identity\.hash/);
  assert.match(source, /name:\s*identity\.name/);
  assert.match(source, /email:\s*identity\.email/);
  assert.match(source, /await clearTawkUser\(api\)/);
  assert.match(source, /await switchTawkWidget\(api, identity\)/);
  assert.match(source, /await loginTawk\(api, identity\)/);
  assert.match(source, /api\.autoStart = false/);
  assert.match(source, /if \(api\.start && api\.login && api\.logout && api\.switchWidget\)/);
  assert.match(source, /startTawk\(api\)/);
  assert.match(source, /apiBeforeLoad\.onChatMessageVisitor = keepVisitorMessageVisible/);
  assert.match(source, /apiBeforeLoad\.onOfflineSubmit = keepVisitorMessageVisible/);
  assert.match(source, /apiBeforeLoad\.onLoad = \(\) => \{[\s\S]*?pendingOpenRef\.current[\s\S]*?showMaximizedWidget\(\)[\s\S]*?hideNativeWidget\(\)/);
  assert.match(source, /if \(!pendingOpenRef\.current && !chatOpenRef\.current\) \{[\s\S]*?hideNativeWidget\(\);[\s\S]*?setChatOpenState\(false\);[\s\S]*?return;/);
  assert.match(source, /apiBeforeLoad\.onChatMaximized = \(\) => \{[\s\S]*?pendingOpenRef\.current = false;[\s\S]*?setChatOpenState\(true\)/);
  assert.match(source, /if \(chatOpenRef\.current \|\| api\.isChatMaximized\?\.\(\) === true\)/);
  assert.match(source, /setChatOpenState\(true\)/);
  assert.match(source, /setChatOpenState\(false\)/);
  assert.match(source, /reject\(new Error\('TAWK_CALLBACK_TIMEOUT'\)\)/);
  assert.match(source, /nextUserId !== previousUserId/);
  assert.match(source, /currentUserDisplayName/);
  assert.match(source, /api\.hideWidget\?\.\(\)/);
  assert.match(source, /api\.shutdown\?\.\(\)/);
  assert.match(source, /SUPPORT_SIGNED_OUT_EVENT/);
  assert.match(source, /addEventListener\('pagehide', emergencyTeardown\)/);
  assert.doesNotMatch(source, /TAWK_API_KEY|TAWK_SECURE_MODE_SECRET|createHmac/);
});

test('Web Push reste volontaire et persiste uniquement via les RPC sécurisées', async () => {
  const [pushSource, settingsSource, userSettingsSource, providerSource, workerSource] = await Promise.all([
    readSource('lib/support/web-push.ts'),
    readSource('components/support/WebPushSettings.tsx'),
    readSource('components/UserSettingsView.tsx'),
    readSource('components/support/SupportProvider.tsx'),
    readSource('public/sw.js'),
  ]);

  assert.equal((pushSource.match(/Notification\.requestPermission\(\)/g) ?? []).length, 1);
  assert.match(pushSource, /export async function enableWebPush/);
  assert.match(pushSource, /rpc\('register_push_subscription'/);
  assert.match(pushSource, /rpc\('unregister_push_subscription'/);
  assert.equal((pushSource.match(/p_expected_user_id:\s*userId/g) ?? []).length, 2);
  assert.match(pushSource, /registerSubscription\(userId, subscription\)/);
  assert.match(pushSource, /unregisterSubscription\(userId, subscription\.endpoint\)/);
  assert.doesNotMatch(pushSource, /\.from\(['"]push_subscriptions['"]\)/);
  assert.match(settingsSource, /type="button"[\s\S]*?enablePush\(\)/);
  assert.match(userSettingsSource, /<WebPushSettings/);
  assert.match(providerSource, /synchronizeWebPushOnly/);
  assert.match(providerSource, /authUserIdRef\.current \?\? identityRef\.current\?\.userId/);
  assert.match(workerSource, /addEventListener\('push'/);
  assert.match(workerSource, /addEventListener\('pushsubscriptionchange'/);
  assert.match(workerSource, /credentials:\s*'same-origin'/);
  assert.match(workerSource, /PUSH_REGISTRATION_PATH/);
  assert.match(workerSource, /addEventListener\('notificationclick'/);
  assert.match(workerSource, /target\.origin === self\.location\.origin/);
});

test('le renouvellement Push est validé et enregistré par une route authentifiée', async () => {
  const [routeSource, storeSource] = await Promise.all([
    readSource('app/api/support/push-subscription/route.ts'),
    readSource('lib/store.tsx'),
  ]);

  assert.match(routeSource, /isSameOriginMutation\(request\)/);
  assert.match(routeSource, /supabase\.auth\.getUser\(\)/);
  assert.match(routeSource, /p_expected_user_id:\s*user\.id/);
  assert.doesNotMatch(routeSource, /createPrivilegedClient|SERVICE_ROLE|SECRET_KEY/);
  assert.match(
    storeSource,
    /dispatchEvent\(new Event\(SUPPORT_SIGNED_OUT_EVENT\)\)[\s\S]*?setTimeout/,
  );

  const valid = parsePushRegistrationPayload({
    endpoint: 'https://push.example.test/subscription/123',
    expirationTime: null,
    keys: { p256dh: 'abc_DEF-123', auth: 'auth_KEY-456' },
  });
  assert.deepEqual(valid, {
    endpoint: 'https://push.example.test/subscription/123',
    expirationTime: null,
    p256dh: 'abc_DEF-123',
    authKey: 'auth_KEY-456',
  });
  assert.equal(
    parsePushRegistrationPayload({
      endpoint: 'http://push.example.test/insecure',
      keys: { p256dh: 'abc', auth: 'def' },
    }),
    null,
  );
});

test('les quatre langues exposent les libellés complets du support', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const support = extraUserMessages[language].support;
    for (const value of Object.values(support)) assert.match(value, /\S/);
  }
});

test('le bouton de support expose ses états et sa variante flottante responsive', async () => {
  const source = await readSource('components/support/SupportButton.tsx');
  assert.match(source, /const label = unavailable \? copy\.unavailable : copy\.openChat/);
  assert.match(source, /'floating'/);
  assert.match(source, /hidden sm:inline/);
  assert.match(source, /variant === 'floating'/);
  assert.match(source, /variant === 'floating' && chatOpen/);
  assert.match(source, /sm:bottom-\[calc\(1\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(source, /sm:right-\[calc\(1\.5rem\+env\(safe-area-inset-right\)\)\]/);
  assert.match(source, /z-30/);
  assert.doesNotMatch(source, /z-40/);
});
