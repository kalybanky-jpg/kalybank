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
  start?: (options?: { showWidget?: boolean }) => void;
  onBeforeLoad?: () => void;
  onLoad?: () => void;
  onChatMaximized?: () => void;
  onChatMinimized?: () => void;
  onChatHidden?: () => void;
  onChatMessageVisitor?: (message: string) => void;
  onOfflineSubmit?: (data: unknown) => void;
  login?: (data: TawkLoginData, callback: TawkCallback) => void;
  logout?: (callback: TawkCallback) => void;
  switchWidget?: (
    data: { propertyId: string; widgetId: string },
    callback: TawkCallback,
  ) => void;
  showWidget?: () => void;
  hideWidget?: () => void;
  maximize?: () => void;
  isChatMaximized?: () => boolean;
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
  chatOpen: boolean;
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
    if (api.start && api.login && api.logout && api.switchWidget) return api;
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

function startTawk(api: TawkApi) {
  if (!api.start) throw new Error('TAWK_START_UNAVAILABLE');
  api.start();
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
  const tawkEnabled = role !== 'admin';
  const effectiveLanguage = language;
  const [tawkStatus, setTawkStatus] = useState<TawkStatus>('loading');
  const [chatOpen, setChatOpen] = useState(false);
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

  const setChatOpenState = useCallback((open: boolean) => {
    chatOpenRef.current = open;
    setChatOpen(open);
  }, []);

  const hideNativeWidget = useCallback(() => {
    currentTawkApi().hideWidget?.();
  }, []);

  const showMaximizedWidget = useCallback(() => {
    const api = currentTawkApi();
    if (!api.showWidget || !api.maximize) {
      pendingOpenRef.current = false;
      return;
    }
    pendingOpenRef.current = true;
    api.showWidget?.();
    api.maximize?.();
  }, []);

  const keepVisitorMessageVisible = useCallback(() => {
    pendingOpenRef.current = false;
    const api = currentTawkApi();
    if (chatOpenRef.current || api.isChatMaximized?.() === true) {
      setChatOpenState(true);
      return;
    }
    showMaximizedWidget();
  }, [setChatOpenState, showMaximizedWidget]);

  const handleSignedOut = useCallback(() => {
    // This can be triggered by both Supabase and the store's pre-redirect
    // signal. Everything sensitive is invalidated and hidden synchronously.
    authEpochRef.current += 1;
    authUserIdRef.current = null;
    identityRef.current = null;
    pendingOpenRef.current = false;
    setChatOpenState(false);
    if (tawkEnabled) currentTawkApi().hideWidget?.();
    setTawkStatus('unavailable');
    setWebPushStatus('prompt');

    if (signingOutRef.current || signedOutCleanupRef.current) return;

    const pendingOperation = operationRef.current.catch(() => undefined);
    const immediateCleanup = tawkEnabled
      ? logoutTawk().catch(() => undefined)
      : Promise.resolve();
    signedOutCleanupRef.current = immediateCleanup;
    operationRef.current = Promise.all([pendingOperation, immediateCleanup]).then(
      () => undefined,
    );
    void unsubscribeBrowserPush().catch(() => undefined);
  }, [setChatOpenState, tawkEnabled]);

  useEffect(() => {
    if (tawkEnabled) return;

    let cancelled = false;
    authEpochRef.current += 1;
    identityRef.current = null;
    pendingOpenRef.current = false;
    chatOpenRef.current = false;
    window.setTimeout(() => {
      if (!cancelled) setChatOpenState(false);
    }, 0);
    const api = window.Tawk_API;
    api?.hideWidget?.();
    api?.shutdown?.();

    const synchronizeWebPushOnly = async () => {
      setTawkStatus('unavailable');
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error) {
        setWebPushStatus('error');
        return;
      }

      authUserIdRef.current = user?.id ?? null;
      if (!user) {
        setWebPushStatus('prompt');
        return;
      }

      try {
        setWebPushStatus(await reconcileWebPush(user.id));
      } catch {
        if (!cancelled) setWebPushStatus('error');
      }
    };

    void synchronizeWebPushOnly();
    return () => {
      cancelled = true;
    };
  }, [authRevision, setChatOpenState, tawkEnabled]);

  useEffect(() => {
    let cancelled = false;

    if (!tawkEnabled) return () => {
      cancelled = true;
    };

    const synchronize = async () => {
      const expectedAuthEpoch = authEpochRef.current;
      const shouldRestoreOpenChat = chatOpenRef.current || pendingOpenRef.current;
      if (shouldRestoreOpenChat) {
        pendingOpenRef.current = true;
        setChatOpenState(false);
      }
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
      const apiBeforeLoad = currentTawkApi();
      apiBeforeLoad.autoStart = false;
      apiBeforeLoad.customStyle = { zIndex: '40 !important' };
      apiBeforeLoad.onBeforeLoad = hideNativeWidget;
      apiBeforeLoad.onLoad = () => {
        if (pendingOpenRef.current) showMaximizedWidget();
        else if (!chatOpenRef.current) hideNativeWidget();
      };
      apiBeforeLoad.onChatMaximized = () => {
        // tawk.to can restore its own previously maximized state after a page
        // reload. Because the application deliberately hides the native launcher, only
        // accept this callback when our launcher requested the opening (or the
        // current session already confirmed an open chat).
        if (!pendingOpenRef.current && !chatOpenRef.current) {
          hideNativeWidget();
          setChatOpenState(false);
          return;
        }
        pendingOpenRef.current = false;
        setChatOpenState(true);
      };
      apiBeforeLoad.onChatMinimized = () => {
        pendingOpenRef.current = false;
        setChatOpenState(false);
        hideNativeWidget();
      };
      apiBeforeLoad.onChatHidden = () => {
        pendingOpenRef.current = false;
        setChatOpenState(false);
      };
      apiBeforeLoad.onChatMessageVisitor = keepVisitorMessageVisible;
      apiBeforeLoad.onOfflineSubmit = keepVisitorMessageVisible;

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
      startTawk(api);

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
          setChatOpenState(false);
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
    keepVisitorMessageVisible,
    setChatOpenState,
    showMaximizedWidget,
    tawkEnabled,
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
        if (tawkEnabled) currentTawkApi().hideWidget?.();
        identityRef.current = null;
        pendingOpenRef.current = false;
        setChatOpenState(false);
        setTawkStatus(tawkEnabled ? 'loading' : 'unavailable');

        if (tawkEnabled) {
          // Serialize the official logout ahead of the next identity bootstrap.
          operationRef.current = operationRef.current
            .catch(() => undefined)
            .then(async () => clearTawkUser(await waitForTawkApi()));
        }
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
  }, [handleSignedOut, setChatOpenState, tawkEnabled]);

  useEffect(() => {
    if (!tawkEnabled) return;

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
      setChatOpenState(false);
      void logoutTawk().catch(() => undefined);
    };
  }, [setChatOpenState, tawkEnabled]);

  const openSupport = useCallback(async () => {
    if (!tawkEnabled) return;
    pendingOpenRef.current = true;
    if (tawkStatus !== 'ready') {
      await operationRef.current.catch(() => undefined);
    }
    if (identityRef.current && currentTawkApi().maximize) {
      showMaximizedWidget();
    } else {
      pendingOpenRef.current = false;
    }
  }, [showMaximizedWidget, tawkEnabled, tawkStatus]);

  const enablePush = useCallback(async () => {
    const userId = authUserIdRef.current ?? identityRef.current?.userId ?? null;
    if (!userId) throw new Error('SUPPORT_IDENTITY_UNAVAILABLE');
    setWebPushStatus('enabling');
    try {
      setWebPushStatus(await enableWebPush(userId));
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
    const userId = authUserIdRef.current ?? identityRef.current?.userId ?? null;
    if (!userId) throw new Error('SUPPORT_IDENTITY_UNAVAILABLE');
    setWebPushStatus('disabling');
    try {
      await disableWebPush(userId);
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
    const supportUserId = authUserIdRef.current ?? identityRef.current?.userId ?? null;

    const supabase = createClient();
    try {
      if (tawkEnabled) await logoutTawk().catch(() => undefined);
      if (supportUserId) {
        await disableWebPush(supportUserId, { bestEffort: true }).catch(() => undefined);
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
      setChatOpenState(false);
      setTawkStatus('unavailable');
      setWebPushStatus('prompt');
      signingOutRef.current = false;
      setIsSigningOut(false);
      window.location.replace('/login');
    }
  }, [setChatOpenState, tawkEnabled]);

  const value = useMemo<SupportContextValue>(
    () => ({
      tawkStatus,
      chatOpen,
      openSupport,
      signOut,
      isSigningOut,
      webPushStatus,
      enablePush,
      disablePush,
    }),
    [
      chatOpen,
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
