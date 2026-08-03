import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import nextConfig from '../next.config';
import { PERMISSIONS_POLICY } from '../lib/security/browser-policy';
import {
  applySupabaseResponseMutations,
  EMPTY_SUPABASE_RESPONSE_MUTATIONS,
  recordSupabaseResponseMutations,
  type SupabaseCookieMutation,
} from '../lib/security/proxy-response';
import { handleProxy, type ProxyDependencies } from '../proxy';

const SUPABASE_COOKIES = [
  {
    name: 'sb-access-token',
    value: 'access.value',
    options: {
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    },
  },
  {
    name: 'sb-refresh-token',
    value: 'refresh.value',
    options: {
      path: '/auth',
      expires: new Date('2030-01-02T03:04:05.000Z'),
      sameSite: 'strict',
    },
  },
] satisfies readonly SupabaseCookieMutation[];

const SUPABASE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

const EXPECTED_SET_COOKIE = [
  'sb-access-token=access.value; Path=/; Secure; HttpOnly; SameSite=lax',
  'sb-refresh-token=refresh.value; Path=/auth; Expires=Wed, 02 Jan 2030 03:04:05 GMT; SameSite=strict',
];

function createDependencies({
  authenticated,
  role = null,
  configured = true,
  emitSession = true,
}: {
  authenticated: boolean;
  role?: unknown;
  configured?: boolean;
  emitSession?: boolean;
}): ProxyDependencies {
  return {
    supabaseUrl: configured ? 'https://project.supabase.co' : undefined,
    supabaseKey: configured ? 'publishable-key' : undefined,
    nodeEnv: 'test',
    createNonce: () => 'contract-test-nonce',
    createClient: (_url, _key, { cookies }) => ({
      auth: {
        async getClaims() {
          if (emitSession) {
            await cookies.setAll(
              SUPABASE_COOKIES.map((cookie) => ({
                ...cookie,
                options: { ...cookie.options },
              })),
              { ...SUPABASE_HEADERS },
            );
          }
          return {
            data: authenticated
              ? { claims: { sub: '11111111-1111-4111-8111-111111111111' } }
              : null,
          };
        },
      },
      async rpc() {
        return { data: role };
      },
    }),
  };
}

function assertSecurityHeaders(response: NextResponse) {
  assert.equal(response.headers.get('permissions-policy'), PERMISSIONS_POLICY);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(
    response.headers.get('content-security-policy') ?? '',
    /script-src 'self' 'nonce-contract-test-nonce'/,
  );
}

function assertSupabaseResponseMutations(response: NextResponse) {
  assert.deepEqual(response.headers.getSetCookie(), EXPECTED_SET_COOKIE);
  assert.equal(response.headers.get('cache-control'), SUPABASE_HEADERS['Cache-Control']);
  assert.equal(response.headers.get('expires'), SUPABASE_HEADERS.Expires);
  assert.equal(response.headers.get('pragma'), SUPABASE_HEADERS.Pragma);
}

test('Next headers and Proxy share the self-only camera policy', async () => {
  assert.ok(nextConfig.headers);
  const rules = await nextConfig.headers();
  const catchAll = rules.find((rule) => rule.source === '/:path*');
  const configuredPolicy = catchAll?.headers.find(
    (header) => header.key.toLowerCase() === 'permissions-policy',
  );

  assert.equal(configuredPolicy?.value, PERMISSIONS_POLICY);
  assert.equal(PERMISSIONS_POLICY, 'camera=(self), microphone=(), geolocation=()');

  const response = await handleProxy(
    new NextRequest('https://monalyz.test/public'),
    createDependencies({ authenticated: false, emitSession: false }),
  );
  assertSecurityHeaders(response);
});

test('Supabase response mutations are recorded immutably and replayed exactly', () => {
  const originalCookie = {
    ...SUPABASE_COOKIES[0],
    options: { ...SUPABASE_COOKIES[0].options },
  };
  const originalHeaders = { ...SUPABASE_HEADERS };
  const first = recordSupabaseResponseMutations(
    EMPTY_SUPABASE_RESPONSE_MUTATIONS,
    [originalCookie],
    originalHeaders,
  );

  originalCookie.value = 'changed-after-recording';
  originalCookie.options.path = '/changed';
  originalHeaders.Expires = 'changed-after-recording';

  const complete = recordSupabaseResponseMutations(
    first,
    [SUPABASE_COOKIES[1]],
    { Expires: SUPABASE_HEADERS.Expires },
  );
  const response = applySupabaseResponseMutations(
    NextResponse.redirect(new URL('https://monalyz.test/login')),
    complete,
  );

  assert.deepEqual(response.headers.getSetCookie(), EXPECTED_SET_COOKIE);
  assert.equal(response.headers.get('cache-control'), SUPABASE_HEADERS['Cache-Control']);
  assert.equal(response.headers.get('expires'), SUPABASE_HEADERS.Expires);
  assert.equal(response.headers.get('pragma'), SUPABASE_HEADERS.Pragma);
});

test('every configured Proxy exit preserves Supabase cookies and cache headers', async (t) => {
  const cases: Array<{
    name: string;
    path: string;
    authenticated: boolean;
    role?: unknown;
    expectedLocation: string | null;
  }> = [
    {
      name: 'anonymous public request',
      path: '/public',
      authenticated: false,
      expectedLocation: null,
    },
    {
      name: 'anonymous user-area request',
      path: '/myaccount',
      authenticated: false,
      expectedLocation: 'https://monalyz.test/login?next=%2Fmyaccount',
    },
    {
      name: 'anonymous staff-area request',
      path: '/admin/review',
      authenticated: false,
      expectedLocation: 'https://monalyz.test/admin-login?next=%2Fadmin%2Freview',
    },
    {
      name: 'anonymous password recovery without a recovery session',
      path: '/reset-pin?mode=update&token=discarded',
      authenticated: false,
      expectedLocation: 'https://monalyz.test/reset-pin?error=recovery_session',
    },
    {
      name: 'authenticated public request',
      path: '/public',
      authenticated: true,
      expectedLocation: null,
    },
    {
      name: 'authenticated user denied a staff route',
      path: '/admin/review',
      authenticated: true,
      role: 'user',
      expectedLocation: 'https://monalyz.test/myaccount?error=staff_required',
    },
    {
      name: 'authenticated account without an application role denied a staff route',
      path: '/admin',
      authenticated: true,
      role: null,
      expectedLocation: 'https://monalyz.test/myaccount?error=staff_required',
    },
    {
      name: 'authenticated staff request',
      path: '/admin/review',
      authenticated: true,
      role: 'admin',
      expectedLocation: null,
    },
    {
      name: 'authenticated user leaving an auth route',
      path: '/login?next=%2Fmyaccount',
      authenticated: true,
      role: 'user',
      expectedLocation: 'https://monalyz.test/myaccount',
    },
    {
      name: 'authenticated account without an application role leaving an auth route',
      path: '/register',
      authenticated: true,
      role: null,
      expectedLocation: 'https://monalyz.test/myaccount',
    },
    {
      name: 'authenticated staff leaving an auth route',
      path: '/admin-login',
      authenticated: true,
      role: 'manager',
      expectedLocation: 'https://monalyz.test/admin',
    },
    {
      name: 'authenticated password recovery request',
      path: '/reset-pin?mode=update',
      authenticated: true,
      role: 'user',
      expectedLocation: null,
    },
  ];

  for (const contract of cases) {
    await t.test(contract.name, async () => {
      const response = await handleProxy(
        new NextRequest(`https://monalyz.test${contract.path}`, {
          headers: { cookie: 'existing-cookie=existing-value' },
        }),
        createDependencies({
          authenticated: contract.authenticated,
          role: contract.role,
        }),
      );

      assert.equal(response.headers.get('location'), contract.expectedLocation);
      assert.equal(response.status, contract.expectedLocation ? 307 : 200);
      assertSecurityHeaders(response);
      assertSupabaseResponseMutations(response);

      if (!contract.expectedLocation) {
        const forwardedCookies = response.headers.get('x-middleware-request-cookie') ?? '';
        assert.match(forwardedCookies, /existing-cookie=existing-value/);
        assert.match(forwardedCookies, /sb-access-token=access\.value/);
        assert.match(forwardedCookies, /sb-refresh-token=refresh\.value/);
      }
    });
  }
});

test('unconfigured Proxy exits remain secure and do not fabricate Supabase state', async (t) => {
  const cases = [
    {
      path: '/public',
      expectedLocation: null,
    },
    {
      path: '/onboarding/identity',
      expectedLocation: 'https://monalyz.test/login?error=configuration',
    },
    {
      path: '/admin/review',
      expectedLocation: 'https://monalyz.test/admin-login?error=configuration',
    },
  ];

  for (const contract of cases) {
    await t.test(contract.path, async () => {
      const response = await handleProxy(
        new NextRequest(`https://monalyz.test${contract.path}`),
        createDependencies({ authenticated: false, configured: false }),
      );

      assert.equal(response.headers.get('location'), contract.expectedLocation);
      assertSecurityHeaders(response);
      assert.deepEqual(response.headers.getSetCookie(), []);
      assert.equal(response.headers.get('cache-control'), null);
      assert.equal(response.headers.get('expires'), null);
      assert.equal(response.headers.get('pragma'), null);
    });
  }
});
