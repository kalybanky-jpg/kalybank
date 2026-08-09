'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/lib/store';
import type { Language } from '@/lib/types';
import {
  disableWebPush,
  enableWebPush,
  reconcileWebPush,
  unsubscribeBrowserPush,
  type WebPushStatus,
} from '@/lib/support/web-push';
import { SUPPORT_SIGNED_OUT_EVENT } from '@/lib/support/session-events';

const TAWK_SCRIPT_ID = 'monalyz-tawk-widget-script';
const TAWK_API_TIMEOUT_MS = 12_000;
const TAWK_CALLBACK_TIMEOUT_MS = 12_000;

type TawkCallback = (error?: unknown) => void;

interface TawkLoginData {
  userId: string;
  hash: string;
  name: string;
  email: string;
}

interface TawkApi {
  autoStart?: boolean;
  customStyle?: { zIndex: number | string };
  onBeforeLoad?: () => void;
  onLoad?: () => void;
  onChatMaximized?: () => void;
  onChatMinimized?: () => void;
  onChatHidden?: () => void;
  login?: (data: TawkLoginData, callback: TawkCallback) => void;
  logout?: (callback: TawkCallback) => void;
  switchWidget?: (
    data: { propertyId: string; widgetId: string },
    callback: TawkCallback,
  ) => void;
  showWidget?: () => void;
  hideWidget?: () => void;
  maximize?: () => void;
  shutdown?: () => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

interface TawkIdentity extends TawkLoginData {
  propertyId: string;
  widgetId: string;
}

type TawkStatus = 'loading' | 'ready' | 'unavailable';

interface SupportContextValue {
  tawkStatus: TawkStatus;
  openSupport: () => Promise<void>;
  signOut: () => Promise<void>;
  isSigningOut: boolean;
  webPushStatus: WebPushStatus;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const SupportContext = createContext<SupportContextValue | null>(null);

let tawkScriptPromise: Promise<void> | null = null;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseTawkIdentity(value: unknown): TawkIdentity {
  if (!value || typeof value !== 'object') {
    throw new Error('TAWK_IDENTITY_INVALID');
  }

  const candidate = value as Record<string, unknown>;
  const requiredKeys = [
    'userId',
    'hash',
    'name',
    'email',
    'propertyId',
    'widgetId',
  ] as const;

  for (const key of requiredKeys) {
    if (!isNonEmptyString(candidate[key])) {
      throw new Error('TAWK_IDENTITY_INVALID');
    }
  }

  return {
    userId: candidate.userId as string,
    hash: candidate.hash as string,
    name: candidate.name as string,
    email: candidate.email as string,
    propertyId: candidate.propertyId as string,
    widgetId: candidate.widgetId as string,
  };
}

async function fetchTawkIdentity(language: Language): Promise<TawkIdentity> {
  const response = await fetch(
    `/api/support/tawk-identity?language=${encodeURIComponent(language)}`,
    {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    },
  );

  if (!response.ok) throw new Error(`TAWK_IDENTITY_${response.status}`);
  return parseTawkIdentity(await response.json());
}

function currentTawkApi(): TawkApi {
  window.Tawk_API = window.Tawk_API ?? {};
  return window.Tawk_API;
}

function loadTawkScript(identity: TawkIdentity): Promise<void> {
  if (tawkScriptPromise) return tawkScriptPromise;

  const existingScript = document.getElementById(TAWK_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    tawkScriptPromise = Promise.resolve();
    return tawkScriptPromise;
  }

  const api = currentTawkApi();
  // Keep the socket disconnected until Secure Mode login has been confirmed.
  // This prevents tawk.to from briefly restoring an anonymous/stale visitor.
  api.autoStart = false;
  // tawk.to officially exposes only zIndex through customStyle. Keep the chat
  // below application dialogs/drawers (z-50) and configure it before downloading.
  api.customStyle = { zIndex: '40 !important' };
  window.Tawk_LoadStart = new Date();

  tawkScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = TAWK_SCRIPT_ID;
    script.async = true;
    script.charset = 'UTF-8';
    script.src = `https://embed.tawk.to/${encodeURIComponent(identity.propertyId)}/${encodeURIComponent(identity.widgetId)}`;
    script.setAttribute('crossorigin', '*');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => {
        tawkScriptPromise = null;
        script.remove();
        reject(new Error('TAWK_SCRIPT_FAILED'));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return tawkScriptPromise;
}

async function waitForTawkApi(): Promise<TawkApi> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TAWK_API_TIMEOUT_MS) {
    const api = currentTawkApi();
    if (api.login && api.logout && api.switchWidget) return api;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error('TAWK_API_TIMEOUT');
}

function invokeTawkCallback(
  operation: (callback: TawkCallback) => void,
  timeoutMs = TAWK_CALLBACK_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('TAWK_CALLBACK_TIMEOUT'));
    }, timeoutMs);

    try {
      operation((error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      });
    } catch (error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(error);
    }
  });
}

async function loginTawk(api: TawkApi, identity: TawkIdentity) {
  if (!api.login) throw new Error('TAWK_LOGIN_UNAVAILABLE');
  await invokeTawkCallback((callback) =>
    api.login?.(
      {
        userId: identity.userId,
        hash: identity.hash,
        name: identity.name,
        email: identity.email,
      },
      callback,
    ),
  );
}

async function switchTawkWidget(api: TawkApi, identity: TawkIdentity) {
  if (!api.switchWidget) throw new Error('TAWK_SWITCH_UNAVAILABLE');
  await invokeTawkCallback((callback) =>
    api.switchWidget?.(
      { propertyId: identity.propertyId, widgetId: identity.widgetId },
      callback,
    ),
  );
}

async function logoutTawk() {
  if (typeof window === 'undefined' || !window.Tawk_API) return;
  const api = window.Tawk_API;
  api.hideWidget?.();
  try {
    if (api.logout) {
      await invokeTawkCallback((callback) => api.logout?.(callback));
    }
  } finally {
    api.hideWidget?.();
    api.shutdown?.();
  }
}

async function clearTawkUser(api: TawkApi) {
  api.hideWidget?.();
  if (api.logout) {
    await invokeTawkCallback((callback) => api.logout?.(callback));
  }
  api.hideWidget?.();
}

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const { language, role, currentUserDisplayName } = useAppStore();
  // Match the language users actually see: the current back-office shell is
  // French-only, while customer and onboarding surfaces follow the preference.
  const effectiveLanguage = role === 'admin' ? 'fr' : language;
  const [tawkStatus, setTawkStatus] = useState<TawkStatus>('loading');
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus>('loading');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);
  const identityRef = useRef<TawkIdentity | null>(null);
  const authUserIdRef = useRef<string | null>(null);
  const authEpochRef = useRef(0);
  const operationRef = useRef<Promise<void>>(Promise.resolve());
  const pendingOpenRef = useRef(false);
  const chatOpenRef = useRef(false);
  const signingOutRef = useRef(false);
  const signedOutCleanupRef = useRef<Promise<void> | null>(null);

  const hideNativeWidget = useCallback(() => {
    currentTawkApi().hideWidget?.();
  }, []);

  const showMaximizedWidget = useCallback(() => {
    const api = currentTawkApi();
    api.showWidget?.();
    api.maximize?.();
    pendingOpenRef.current = false;
    chatOpenRef.current = true;
  }, []);

  const handleSignedOut = useCallback(() => {
    // This can be triggered by both Supabase and the store's pre-redirect
    // signal. Everything sensitive is invalidated and hidden synchronously.
    authEpochRef.current += 1;
    authUserIdRef.current = null;
    identityRef.current = null;
    pendingOpenRef.current = false;
    chatOpenRef.current = false;
    currentTawkApi().hideWidget?.();
    setTawkStatus('unavailable');
    setWebPushStatus('prompt');

    if (signingOutRef.current || signedOutCleanupRef.current) return;

    const pendingOperation = operationRef.current.catch(() => undefined);
    const immediateCleanup = logoutTawk().catch(() => undefined);
    signedOutCleanupRef.current = immediateCleanup;
    operationRef.current = Promise.all([pendingOperation, immediateCleanup]).then(
      () => undefined,
    );
    void unsubscribeBrowserPush().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const synchronize = async () => {
      const expectedAuthEpoch = authEpochRef.current;
      const isStaleIdentity = (identity?: TawkIdentity) =>
        cancelled ||
        expectedAuthEpoch !== authEpochRef.current ||
        Boolean(
          identity &&
            authUserIdRef.current &&
            authUserIdRef.current !== identity.userId,
        );

      // Any rebind (language or account) is fail-closed: the old widget stays
      // hidden until switchWidget + Secure Mode login both confirm success.
      hideNativeWidget();
      setTawkStatus('loading');
      const identity = await fetchTawkIdentity(effectiveLanguage);
      if (isStaleIdentity(identity)) return;

      const previousIdentity = identityRef.current;
      const shouldRestoreOpenChat = chatOpenRef.current || pendingOpenRef.current;
      const apiBeforeLoad = currentTawkApi();
      apiBeforeLoad.autoStart = false;
      apiBeforeLoad.customStyle = { zIndex: '40 !important' };
      apiBeforeLoad.onBeforeLoad = hideNativeWidget;
      apiBeforeLoad.onLoad = hideNativeWidget;
      apiBeforeLoad.onChatMaximized = () => {
        chatOpenRef.current = true;
      };
      apiBeforeLoad.onChatMinimized = () => {
        chatOpenRef.current = false;
        hideNativeWidget();
      };
      apiBeforeLoad.onChatHidden = () => {
        chatOpenRef.current = false;
      };

      await loadTawkScript(identity);
      const api = await waitForTawkApi();
      if (isStaleIdentity(identity)) return;

      if (!previousIdentity || previousIdentity.userId !== identity.userId) {
        // tawk.to can retain its own visitor cookie after an application
        // session ends. Clear it officially before binding the Supabase UUID.
        await clearTawkUser(api);
        if (isStaleIdentity(identity)) {
          api.hideWidget?.();
          return;
        }
      }

      if (
        previousIdentity &&
        (previousIdentity.propertyId !== identity.propertyId ||
          previousIdentity.widgetId !== identity.widgetId)
      ) {
        await switchTawkWidget(api, identity);
        if (isStaleIdentity(identity)) {
          api.hideWidget?.();
          return;
        }
      }

      await loginTawk(api, identity);
      if (isStaleIdentity(identity)) {
        api.hideWidget?.();
        await logoutTawk().catch(() => undefined);
        return;
      }

      identityRef.current = identity;
      authUserIdRef.current = identity.userId;
      hideNativeWidget();
      setTawkStatus('ready');
      try {
        setWebPushStatus(await reconcileWebPush(identity.userId));
      } catch {
        setWebPushStatus('error');
      }

      if (shouldRestoreOpenChat) showMaximizedWidget();
    };

    operationRef.current = operationRef.current
      .catch(() => undefined)
      .then(synchronize)
      .catch(() => {
        if (!cancelled) {
          identityRef.current = null;
          pendingOpenRef.current = false;
          chatOpenRef.current = false;
          const api = currentTawkApi();
          api.hideWidget?.();
          api.shutdown?.();
          setTawkStatus('unavailable');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    authRevision,
    currentUserDisplayName,
    effectiveLanguage,
    hideNativeWidget,
    showMaximizedWidget,
  ]);

  useEffect(() => {
    window.addEventListener(SUPPORT_SIGNED_OUT_EVENT, handleSignedOut);
    return () =>
      window.removeEventListener(SUPPORT_SIGNED_OUT_EVENT, handleSignedOut);
  }, [handleSignedOut]);

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        handleSignedOut();
        return;
      }

      if (session) signedOutCleanupRef.current = null;

      const nextUserId = session?.user.id ?? null;
      const previousUserId = authUserIdRef.current ?? identityRef.current?.userId ?? null;
      const accountChanged = Boolean(
        nextUserId && previousUserId && nextUserId !== previousUserId,
      );

      if (accountChanged) {
        authEpochRef.current += 1;
        currentTawkApi().hideWidget?.();
        identityRef.current = null;
        pendingOpenRef.current = false;
        chatOpenRef.current = false;
        setTawkStatus('loading');

        // Serialize the official logout ahead of the next identity bootstrap.
        operationRef.current = operationRef.current
          .catch(() => undefined)
          .then(async () => clearTawkUser(await waitForTawkApi()));
      }

      authUserIdRef.current = nextUserId;
      if (
        accountChanged ||
        event === 'USER_UPDATED' ||
        (event === 'SIGNED_IN' && !identityRef.current)
      ) {
        if (!accountChanged) authEpochRef.current += 1;
        window.setTimeout(() => setAuthRevision((revision) => revision + 1), 0);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [handleSignedOut]);

  useEffect(() => {
    const emergencyTeardown = () => {
      const api = currentTawkApi();
      api.hideWidget?.();
      api.shutdown?.();
    };
    const restoreFromPageCache = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.setTimeout(() => setAuthRevision((revision) => revision + 1), 0);
      }
    };

    window.addEventListener('pagehide', emergencyTeardown);
    window.addEventListener('pageshow', restoreFromPageCache);
    return () => {
      // The provider only exists inside authenticated route shells. A client
      // navigation outside one must immediately hide and tear down tawk.to.
      window.removeEventListener('pagehide', emergencyTeardown);
      window.removeEventListener('pageshow', restoreFromPageCache);
      authEpochRef.current += 1;
      currentTawkApi().hideWidget?.();
      authUserIdRef.current = null;
      identityRef.current = null;
      void logoutTawk().catch(() => undefined);
    };
  }, []);

  const openSupport = useCallback(async () => {
    pendingOpenRef.current = true;
    if (tawkStatus !== 'ready') {
      await operationRef.current.catch(() => undefined);
    }
    if (identityRef.current && currentTawkApi().maximize) {
      showMaximizedWidget();
    }
  }, [showMaximizedWidget, tawkStatus]);

  const enablePush = useCallback(async () => {
    const identity = identityRef.current;
    if (!identity) throw new Error('SUPPORT_IDENTITY_UNAVAILABLE');
    setWebPushStatus('enabling');
    try {
      setWebPushStatus(await enableWebPush(identity.userId));
    } catch (error) {
      setWebPushStatus(
        typeof Notification !== 'undefined' && Notification.permission === 'denied'
          ? 'denied'
          : 'error',
      );
      throw error;
    }
  }, []);

  const disablePush = useCallback(async () => {
    const identity = identityRef.current;
    if (!identity) throw new Error('SUPPORT_IDENTITY_UNAVAILABLE');
    setWebPushStatus('disabling');
    try {
      await disableWebPush(identity.userId);
      setWebPushStatus('prompt');
    } catch (error) {
      setWebPushStatus('error');
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setIsSigningOut(true);
    const identity = identityRef.current;

    const supabase = createClient();
    try {
      await logoutTawk().catch(() => undefined);
      if (identity) {
        await disableWebPush(identity.userId, { bestEffort: true }).catch(() => undefined);
      } else {
        await unsubscribeBrowserPush().catch(() => undefined);
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch {
      // A failed remote revocation must not leave the shared browser session
      // or either support channel attached to the previous account.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    } finally {
      identityRef.current = null;
      authUserIdRef.current = null;
      setTawkStatus('unavailable');
      setWebPushStatus('prompt');
      signingOutRef.current = false;
      setIsSigningOut(false);
      window.location.replace('/login');
    }
  }, []);

  const value = useMemo<SupportContextValue>(
    () => ({
      tawkStatus,
      openSupport,
      signOut,
      isSigningOut,
      webPushStatus,
      enablePush,
      disablePush,
    }),
    [
      disablePush,
      enablePush,
      isSigningOut,
      openSupport,
      signOut,
      tawkStatus,
      webPushStatus,
    ],
  );

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

export function useSupport() {
  const context = useContext(SupportContext);
  if (!context) {
    throw new Error('useSupport doit être utilisé dans SupportProvider.');
  }
  return context;
}
