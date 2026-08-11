import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBoundedPrivilegedFetch,
  PRIVILEGED_FETCH_TIMEOUT_MS,
} from '../lib/server/bounded-privileged-fetch';

test('un fetch privilégié bloqué est interrompu par son budget', async () => {
  assert.ok(PRIVILEGED_FETCH_TIMEOUT_MS < 2 * 60 * 1000);
  let observedSignal: AbortSignal | undefined;
  const blockedFetch = (async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    observedSignal = init?.signal ?? undefined;
    await new Promise<void>((_resolve, reject) => {
      observedSignal?.addEventListener(
        'abort',
        () => reject(observedSignal?.reason ?? new Error('aborted')),
        { once: true },
      );
    });
    return new Response();
  }) as typeof fetch;

  const bounded = createBoundedPrivilegedFetch(20, blockedFetch);
  await assert.rejects(() => bounded('https://storage.example.test/list'));
  assert.equal(observedSignal?.aborted, true);
});

test('le signal appelant reste prioritaire sur le délai global', async () => {
  const caller = new AbortController();
  const blockedFetch = (async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const signal = init?.signal;
    await new Promise<void>((_resolve, reject) => {
      signal?.addEventListener(
        'abort',
        () => reject(signal.reason ?? new Error('aborted')),
        { once: true },
      );
    });
    return new Response();
  }) as typeof fetch;

  const bounded = createBoundedPrivilegedFetch(5_000, blockedFetch);
  const request = bounded('https://storage.example.test/list', {
    signal: caller.signal,
  });
  caller.abort(new Error('caller_abort'));
  await assert.rejects(request, /caller_abort/);
});

test('plusieurs appels partagent une échéance et les appels tardifs échouent immédiatement', async () => {
  const requestScope = new AbortController();
  let calls = 0;
  let releaseFirst!: () => void;
  const firstReleased = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const fetchImpl = (async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    calls += 1;
    if (calls === 1) {
      await firstReleased;
      return new Response('first');
    }
    const signal = init?.signal;
    await new Promise<void>((_resolve, reject) => {
      signal?.addEventListener(
        'abort',
        () => reject(signal.reason ?? new Error('aborted')),
        { once: true },
      );
    });
    return new Response();
  }) as typeof fetch;
  const bounded = createBoundedPrivilegedFetch(
    5_000,
    fetchImpl,
    requestScope.signal,
  );

  const first = bounded('https://db.example.test/first');
  releaseFirst();
  await first;
  const second = bounded('https://db.example.test/second');
  requestScope.abort(new Error('request_deadline'));
  await assert.rejects(second, /request_deadline/);
  await assert.rejects(
    () => bounded('https://db.example.test/third'),
    /request_deadline/,
  );
  assert.equal(calls, 2);
});

test('le délai commun borne deux fetchs séquentiels bien avant deux timeouts unitaires', async () => {
  const requestScope = new AbortController();
  const deadline = setTimeout(
    () => requestScope.abort(new Error('shared_deadline')),
    100,
  );
  let calls = 0;
  const fetchImpl = (async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    calls += 1;
    if (calls === 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response('first');
    }
    const signal = init?.signal;
    await new Promise<void>((_resolve, reject) => {
      signal?.addEventListener(
        'abort',
        () => reject(signal.reason ?? new Error('aborted')),
        { once: true },
      );
    });
    return new Response();
  }) as typeof fetch;
  try {
    const bounded = createBoundedPrivilegedFetch(
      1_000,
      fetchImpl,
      requestScope.signal,
    );
    const startedAt = Date.now();
    await bounded('https://db.example.test/first');
    await assert.rejects(
      () => bounded('https://db.example.test/second'),
      /shared_deadline/,
    );
    const elapsed = Date.now() - startedAt;
    assert.equal(requestScope.signal.aborted, true);
    assert.equal(calls, 2);
    assert.ok(elapsed < 600, `shared deadline took ${elapsed}ms`);
  } finally {
    clearTimeout(deadline);
  }
});
