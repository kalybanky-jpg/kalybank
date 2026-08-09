/* global self */

const DEFAULT_NOTIFICATION_ICON = '/brand/monalyz/monalyz-app-icon-192.png';
const PUSH_CONFIG_PATH = '/api/support/push-config';
const PUSH_REGISTRATION_PATH = '/api/support/push-subscription';

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = `${value}${padding}`.replaceAll('-', '+').replaceAll('_', '/');
  const decoded = self.atob(normalized);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function subscriptionUsesKey(subscription, publicKey) {
  const configuredKey = subscription.options.applicationServerKey;
  if (!configuredKey) return false;
  const actual = new Uint8Array(configuredKey);
  const expected = base64UrlToUint8Array(publicKey);
  return (
    actual.byteLength === expected.byteLength &&
    actual.every((value, index) => value === expected[index])
  );
}

async function authenticatedPushConfig() {
  const response = await fetch(PUSH_CONFIG_PATH, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('PUSH_SESSION_UNAVAILABLE');

  const value = await response.json();
  if (!value || typeof value.publicKey !== 'string' || value.publicKey.length < 20) {
    throw new Error('PUSH_CONFIG_INVALID');
  }
  return value.publicKey;
}

async function renewPushSubscription(event) {
  // Authenticate before creating an endpoint. A signed-out/background browser
  // must never silently attach a subscription to an unknown account.
  const publicKey = await authenticatedPushConfig();
  let subscription = event.newSubscription ?? null;
  let createdByHandler = false;

  if (subscription && !subscriptionUsesKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    });
    createdByHandler = true;
  }

  try {
    const response = await fetch(PUSH_REGISTRATION_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) throw new Error('PUSH_REGISTRATION_FAILED');
  } catch (error) {
    // Do not retain an endpoint we created but could not bind atomically.
    if (createdByHandler) await subscription.unsubscribe().catch(() => false);
    throw error;
  }
}

function notificationPayload(event) {
  if (!event.data) return null;

  try {
    const value = event.data.json();
    if (!value || typeof value !== 'object' || typeof value.title !== 'string') {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function notificationTarget(value) {
  try {
    const target = new URL(typeof value === 'string' ? value : '/myaccount', self.location.origin);
    return target.origin === self.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : '/myaccount';
  } catch {
    return '/myaccount';
  }
}

self.addEventListener('push', (event) => {
  const payload = notificationPayload(event);
  if (!payload) return;

  const options = {
    body: typeof payload.body === 'string' ? payload.body : undefined,
    icon: typeof payload.icon === 'string' ? payload.icon : DEFAULT_NOTIFICATION_ICON,
    badge: typeof payload.badge === 'string' ? payload.badge : DEFAULT_NOTIFICATION_ICON,
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: notificationTarget(payload.url ?? payload.data?.url),
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// This event has limited browser support. Where it is unavailable, the client
// reconcile path repairs an existing refreshed subscription on the next visit.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(renewPushSubscription(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = notificationTarget(event.notification.data?.url);
  const absoluteTarget = new URL(target, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (windows) => {
        const sameOriginWindow = windows.find((client) => {
          try {
            return new URL(client.url).origin === self.location.origin;
          } catch {
            return false;
          }
        });

        if (sameOriginWindow) {
          await sameOriginWindow.navigate(absoluteTarget);
          return sameOriginWindow.focus();
        }
        return self.clients.openWindow(absoluteTarget);
      }),
  );
});
