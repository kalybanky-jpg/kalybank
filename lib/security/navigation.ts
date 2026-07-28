export function safeInternalPath(value: string | null | undefined, fallback: string) {
  let decoded = '';
  try {
    decoded = decodeURIComponent(value ?? '');
  } catch {
    return fallback;
  }

  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('\0') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    decoded.includes('\0')
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, 'https://kaly.invalid');
    if (parsed.origin !== 'https://kaly.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function safeHttpOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

export function configuredServerAppOrigin(
  requestOrigin: string,
  nodeEnv = process.env.NODE_ENV,
) {
  const configured = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (configured) return safeHttpOrigin(configured);
  return nodeEnv === 'production' ? null : safeHttpOrigin(requestOrigin);
}

export function configuredAppOrigin() {
  const value =
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    (typeof window !== 'undefined' ? window.location.origin : undefined);
  return safeHttpOrigin(value);
}

function matchesRoute(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function authFailureRedirect(pathname: string, search = '') {
  const searchParams = new URLSearchParams(search);

  if (pathname === '/reset-pin' && searchParams.get('mode') === 'update') {
    return '/reset-pin?error=recovery_session';
  }

  if (matchesRoute(pathname, '/admin')) {
    return '/admin-login?error=session';
  }

  if (matchesRoute(pathname, '/myaccount') || matchesRoute(pathname, '/onboarding')) {
    const params = new URLSearchParams({
      error: 'session',
      next: pathname,
    });
    return `/login?${params.toString()}`;
  }

  return null;
}
