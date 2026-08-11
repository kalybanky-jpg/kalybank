import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClientPurgeCompletionMonitor,
  type ObservedClientPurge,
} from '../lib/client-purge-completion-monitor';

class FakeEventTarget {
  private listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
  }
  count(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function fakeTimeouts() {
  let callback: (() => void) | null = null;
  let delay = 0;
  return {
    setTimeoutImpl(next: () => void, nextDelay?: number) {
      callback = next;
      delay = nextDelay ?? 0;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeoutImpl() {
      callback = null;
    },
    async fire() {
      const next = callback;
      callback = null;
      next?.();
      await new Promise((resolve) => setImmediate(resolve));
    },
    get active() {
      return callback !== null;
    },
    get delay() {
      return delay;
    },
  };
}

const target = (
  suffix: string,
  sweepNotBefore: string,
): ObservedClientPurge => ({
  targetUserId: `91000000-0000-4000-8000-0000000000${suffix}`,
  email: `client-${suffix}@monalyz.test`,
  displayName: `Client ${suffix}`,
  sweepNotBefore,
});

test('un 404 initial sans cible observée ne simule jamais un succès', async () => {
  let reads = 0;
  const completed: ObservedClientPurge[] = [];
  const monitor = createClientPurgeCompletionMonitor({
    fetchStatus: async () => {
      reads += 1;
      return null;
    },
    onCompleted: (completedTarget) => completed.push(completedTarget),
    intervalMs: 1_000,
  });
  await monitor.refresh();
  assert.equal(reads, 0);
  assert.deepEqual(completed, []);
  monitor.stop();
});

test('plusieurs purges dues sont suivies sans écrasement et gardent leur identité', async () => {
  const completed: ObservedClientPurge[] = [];
  const now = Date.parse('2026-08-11T12:00:00Z');
  const monitor = createClientPurgeCompletionMonitor({
    fetchStatus: async () => null,
    onCompleted: (completedTarget) => completed.push(completedTarget),
    intervalMs: 1_000,
    now: () => now,
  });
  monitor.observeWaitingSweep(target('02', '2026-08-11T11:59:00Z'));
  monitor.observeWaitingSweep(target('05', '2026-08-11T11:58:00Z'));
  await monitor.refresh();
  assert.deepEqual(
    completed.map(({ targetUserId, email }) => ({ targetUserId, email })).sort(
      (left, right) => left.targetUserId.localeCompare(right.targetUserId),
    ),
    [
      {
        targetUserId: '91000000-0000-4000-8000-000000000002',
        email: 'client-02@monalyz.test',
      },
      {
        targetUserId: '91000000-0000-4000-8000-000000000005',
        email: 'client-05@monalyz.test',
      },
    ],
  );
  monitor.stop();
});

test('le premier poll attend sweepNotBefore au lieu de requêter pendant deux heures', async () => {
  const timeouts = fakeTimeouts();
  let currentTime = Date.parse('2026-08-11T12:00:00Z');
  let reads = 0;
  const monitor = createClientPurgeCompletionMonitor({
    fetchStatus: async () => {
      reads += 1;
      return null;
    },
    onCompleted: () => undefined,
    intervalMs: 1_000,
    now: () => currentTime,
    setTimeoutImpl: timeouts.setTimeoutImpl as typeof setTimeout,
    clearTimeoutImpl: timeouts.clearTimeoutImpl as typeof clearTimeout,
  });
  monitor.observeWaitingSweep(target('02', '2026-08-11T14:05:00Z'));
  assert.equal(timeouts.delay, 2 * 60 * 60 * 1000 + 5 * 60 * 1000 + 1_000);
  assert.equal(reads, 0);
  currentTime = Date.parse('2026-08-11T14:05:01Z');
  await timeouts.fire();
  assert.equal(reads, 1);
  monitor.stop();
});

test('chevauchement, visibilité cachée et résolution après stop restent sûrs', async () => {
  const focus = new FakeEventTarget();
  const visibility = new FakeEventTarget();
  const now = Date.parse('2026-08-11T12:00:00Z');
  let visible = false;
  let reads = 0;
  let release!: (value: null) => void;
  const pending = new Promise<null>((resolve) => {
    release = resolve;
  });
  const completed: ObservedClientPurge[] = [];
  const monitor = createClientPurgeCompletionMonitor({
    fetchStatus: async () => {
      reads += 1;
      return pending;
    },
    onCompleted: (completedTarget) => completed.push(completedTarget),
    intervalMs: 1_000,
    now: () => now,
    focusTarget: focus,
    visibilityTarget: visibility,
    isVisible: () => visible,
  });
  monitor.observeWaitingSweep(target('02', '2026-08-11T11:59:00Z'));
  visibility.dispatch('visibilitychange');
  assert.equal(reads, 0);
  focus.dispatch('focus');
  const overlapping = monitor.refresh();
  assert.equal(reads, 1);
  monitor.stop();
  release(null);
  await overlapping;
  assert.deepEqual(completed, []);
  assert.equal(focus.count('focus'), 0);
  assert.equal(visibility.count('visibilitychange'), 0);
  visible = true;
  focus.dispatch('focus');
  assert.equal(reads, 1);
});
