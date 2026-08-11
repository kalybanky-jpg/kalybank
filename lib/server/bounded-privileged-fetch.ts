// A privileged request must never outlive the serverless executor that owns
// its database or Storage work. Long-lived operations are resumed through
// claim tokens instead of leaving a fetch running after the route is gone.
export const PRIVILEGED_FETCH_TIMEOUT_MS = 45_000;

export function createBoundedPrivilegedFetch(
  timeoutMs = PRIVILEGED_FETCH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
  scopeSignal?: AbortSignal,
): typeof fetch {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('PRIVILEGED_FETCH_TIMEOUT_INVALID');
  }

  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const signals = [AbortSignal.timeout(timeoutMs)];
    const callerSignal =
      init?.signal ?? (input instanceof Request ? input.signal : null);
    if (scopeSignal) signals.push(scopeSignal);
    if (callerSignal) signals.push(callerSignal);
    const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);
    if (signal.aborted) {
      return Promise.reject(
        signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'),
      );
    }
    return fetchImpl(input, { ...init, signal });
  }) as typeof fetch;
}
