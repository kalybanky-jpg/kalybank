import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const USER_PATHS = ['/myaccount', '/onboarding'];
const STAFF_PATHS = ['/admin'];
const AUTH_PATHS = ['/login', '/admin-login', '/admin/login', '/register', '/reset-pin'];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function safeRemoteOrigin(value: string | undefined) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const nonce = crypto.randomUUID();
  const remoteOrigin = safeRemoteOrigin(supabaseUrl);
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${remoteOrigin}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${remoteOrigin}`.trim(),
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const withSecurityHeaders = (target: NextResponse) => {
    target.headers.set('Content-Security-Policy', contentSecurityPolicy);
    target.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    target.headers.set('X-Content-Type-Options', 'nosniff');
    target.headers.set('X-Frame-Options', 'DENY');
    target.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return target;
  };

  if (!supabaseUrl || !supabaseKey) {
    if (startsWithAny(request.nextUrl.pathname, [...USER_PATHS, ...STAFF_PATHS])) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = startsWithAny(request.nextUrl.pathname, STAFF_PATHS)
        ? '/admin-login'
        : '/login';
      loginUrl.searchParams.set('error', 'configuration');
      return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  let response = withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = withSecurityHeaders(
          NextResponse.next({ request: { headers: requestHeaders } }),
        );
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headersToSet).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data: claimsResult } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(claimsResult?.claims.sub);
  const pathname = request.nextUrl.pathname;
  const isPasswordRecovery =
    pathname === '/reset-pin' && request.nextUrl.searchParams.get('mode') === 'update';

  if (
    !isAuthenticated &&
    (startsWithAny(pathname, [...USER_PATHS, ...STAFF_PATHS]) || isPasswordRecovery)
  ) {
    if (isPasswordRecovery) {
      const recoveryUrl = request.nextUrl.clone();
      recoveryUrl.search = '';
      recoveryUrl.searchParams.set('error', 'recovery_session');
      return withSecurityHeaders(NextResponse.redirect(recoveryUrl));
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = startsWithAny(pathname, STAFF_PATHS) ? '/admin-login' : '/login';
    loginUrl.searchParams.set('next', pathname);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isAuthenticated && startsWithAny(pathname, STAFF_PATHS)) {
    const { data: appRole } = await supabase.rpc('current_app_role');
    if (!appRole || appRole === 'user') {
      const accountUrl = request.nextUrl.clone();
      accountUrl.pathname = '/myaccount';
      accountUrl.searchParams.set('error', 'staff_required');
      return withSecurityHeaders(NextResponse.redirect(accountUrl));
    }
  }

  if (isAuthenticated && startsWithAny(pathname, AUTH_PATHS) && !isPasswordRecovery) {
    const targetUrl = request.nextUrl.clone();
    const { data: appRole } = await supabase.rpc('current_app_role');
    targetUrl.pathname = appRole && appRole !== 'user' ? '/admin' : '/myaccount';
    targetUrl.search = '';
    return withSecurityHeaders(NextResponse.redirect(targetUrl));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
