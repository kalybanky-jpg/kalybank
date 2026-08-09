'use client';

import { createClient } from '@/lib/supabase/client';

const PUSH_OWNER_STORAGE_KEY = 'monalyz-push-owner';
const SERVICE_WORKER_PATH = '/sw.js';

export type WebPushStatus =
  | 'loading'
  | 'unsupported'
  | 'prompt'
  | 'denied'
  | 'subscribed'
  | 'enabling'
  | 'disabling'
  | 'error';

interface PushConfig {
  publicKey: string;
}

interface DisableWebPushOptions {
  bestEffort?: boolean;
}

function resolveAfter(delayMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

function hasWebPushSupport() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function storedPushOwner() {
  try {
    return window.localStorage.getItem(PUSH_OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storePushOwner(userId: string) {
  try {
    window.localStorage.setItem(PUSH_OWNER_STORAGE_KEY, userId);
  } catch {
    // The subscription remains valid when private storage is unavailable.
  }
}

function clearPushOwner() {
  try {
    window.localStorage.removeItem(PUSH_OWNER_STORAGE_KEY);
  } catch {
    // Nothing else can be cleared in storage-restricted browsers.
  }
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = `${value}${padding}`.replaceAll('-', '+').replaceAll('_', '/');
  const decoded = window.atob(normalized);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function subscriptionUsesKey(subscription: PushSubscription, publicKey: string) {
  const configuredKey = subscription.options.applicationServerKey;
  if (!configuredKey) return false;
  const actual = new Uint8Array(configuredKey);
  const expected = base64UrlToUint8Array(publicKey);
  return (
    actual.byteLength === expected.byteLength &&
    actual.every((value, index) => value === expected[index])
  );
}

async function registerServiceWorker() {
  if (!hasWebPushSupport()) throw new Error('WEB_PUSH_UNSUPPORTED');
  return navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
    scope: '/',
    updateViaCache: 'none',
  });
}

async function fetchPushConfig(): Promise<PushConfig> {
  const response = await fetch('/api/support/push-config', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`WEB_PUSH_CONFIG_${response.status}`);

  const data = (await response.json()) as { publicKey?: unknown };
  if (typeof data.publicKey !== 'string' || data.publicKey.trim().length < 20) {
    throw new Error('WEB_PUSH_CONFIG_INVALID');
  }
  return { publicKey: data.publicKey.trim() };
}

async function registerSubscription(userId: string, subscription: PushSubscription) {
  const serialized = subscription.toJSON();
  const p256dh = serialized.keys?.p256dh;
  const authKey = serialized.keys?.auth;
  if (!p256dh || !authKey) throw new Error('WEB_PUSH_KEYS_MISSING');

  const { error } = await createClient().rpc('register_push_subscription', {
    p_expected_user_id: userId,
    p_endpoint: subscription.endpoint,
    p_p256dh: p256dh,
    p_auth_key: authKey,
    ...(subscription.expirationTime === null
      ? {}
      : { p_expiration_time: subscription.expirationTime }),
    ...(navigator.userAgent ? { p_user_agent: navigator.userAgent } : {}),
  });
  if (error) throw error;
}

async function unregisterSubscription(userId: string, endpoint: string) {
  const { error } = await createClient().rpc('unregister_push_subscription', {
    p_expected_user_id: userId,
    p_endpoint: endpoint,
  });
  if (error) throw error;
}

export async function reconcileWebPush(userId: string): Promise<WebPushStatus> {
  if (!hasWebPushSupport()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const registration = await registerServiceWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      clearPushOwner();
      return 'prompt';
    }

    if (storedPushOwner() !== userId) {
      // A stale browser subscription must never survive an account change on
      // a shared device. Its server row is later removed after a 404/410 push.
      await subscription.unsubscribe();
      clearPushOwner();
      return 'prompt';
    }

    const { publicKey } = await fetchPushConfig();
    if (!subscriptionUsesKey(subscription, publicKey)) {
      // VAPID rotation invalidates the old browser subscription. Keep the
      // replacement voluntary by returning to the explicit opt-in state.
      await unregisterSubscription(userId, subscription.endpoint).catch(
        () => undefined,
      );
      await subscription.unsubscribe();
      clearPushOwner();
      return 'prompt';
    }

    // Consent already exists on this device. Refreshing the secured RPC row
    // repairs a missing/stale database record without prompting again.
    await registerSubscription(userId, subscription);
    return 'subscribed';
  } catch {
    return 'error';
  }
}

export async function enableWebPush(userId: string): Promise<WebPushStatus> {
  if (!hasWebPushSupport()) throw new Error('WEB_PUSH_UNSUPPORTED');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    if (permission === 'denied') throw new Error('WEB_PUSH_DENIED');
    return 'prompt';
  }

  const [{ publicKey }, registration] = await Promise.all([
    fetchPushConfig(),
    registerServiceWorker(),
  ]);

  let subscription = await registration.pushManager.getSubscription();
  const existingOwner = storedPushOwner();
  if (
    subscription &&
    (existingOwner !== userId || !subscriptionUsesKey(subscription, publicKey))
  ) {
    if (existingOwner === userId) {
      await unregisterSubscription(userId, subscription.endpoint).catch(
        () => undefined,
      );
    }
    await subscription.unsubscribe();
    clearPushOwner();
    subscription = null;
  }

  const createdSubscription = !subscription;
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(publicKey),
  });

  try {
    await registerSubscription(userId, subscription);
    storePushOwner(userId);
    return 'subscribed';
  } catch (error) {
    if (createdSubscription) await subscription.unsubscribe().catch(() => false);
    clearPushOwner();
    throw error;
  }
}

export async function disableWebPush(
  userId: string,
  options: DisableWebPushOptions = {},
) {
  if (!hasWebPushSupport()) {
    clearPushOwner();
    return;
  }

  const registration = await registerServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    clearPushOwner();
    return;
  }

  try {
    const unregister = unregisterSubscription(userId, subscription.endpoint);
    if (options.bestEffort) {
      await Promise.race([unregister.catch(() => undefined), resolveAfter(2_000)]);
    } else {
      await unregister;
    }
  } catch (error) {
    if (!options.bestEffort) throw error;
  }

  await subscription.unsubscribe();
  if (storedPushOwner() === userId || options.bestEffort) clearPushOwner();
}

export async function unsubscribeBrowserPush() {
  if (!hasWebPushSupport()) {
    clearPushOwner();
    return;
  }

  const registration = await registerServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  await subscription?.unsubscribe();
  clearPushOwner();
}
