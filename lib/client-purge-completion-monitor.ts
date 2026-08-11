export type ObservedClientPurge = {
  targetUserId: string;
  email: string;
  displayName: string;
  sweepNotBefore: string;
};

type ListenerTarget = {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

type ClientPurgeCompletionMonitorOptions = {
  fetchStatus: (
    target: ObservedClientPurge,
  ) => Promise<{ stage: string; sweepNotBefore?: string | null } | null>;
  onCompleted: (target: ObservedClientPurge) => void;
  intervalMs?: number;
  now?: () => number;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
  focusTarget?: ListenerTarget;
  visibilityTarget?: ListenerTarget;
  isVisible?: () => boolean;
};

export function createClientPurgeCompletionMonitor(
  options: ClientPurgeCompletionMonitorOptions,
) {
  const intervalMs = options.intervalMs ?? 15_000;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1_000) {
    throw new RangeError('CLIENT_PURGE_STATUS_INTERVAL_INVALID');
  }
  const now = options.now ?? Date.now;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const targets = new Map<string, ObservedClientPurge>();
  const inFlight = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const stopTimer = () => {
    if (timer !== null) {
      clearTimeoutImpl(timer);
      timer = null;
    }
  };

  const scheduleNext = () => {
    stopTimer();
    if (stopped || targets.size === 0) return;
    const currentTime = now();
    const earliestSweep = Math.min(
      ...[...targets.values()].map((target) =>
        Date.parse(target.sweepNotBefore),
      ),
    );
    const delay = Number.isFinite(earliestSweep) && earliestSweep > currentTime
      ? Math.max(1_000, earliestSweep - currentTime + 1_000)
      : intervalMs;
    timer = setTimeoutImpl(() => {
      timer = null;
      void refresh();
    }, delay);
  };

  const refresh = async () => {
    if (stopped) return;
    const currentTime = now();
    const dueTargets = [...targets.values()].filter(
      (target) =>
        !inFlight.has(target.targetUserId) &&
        Date.parse(target.sweepNotBefore) <= currentTime,
    );
    if (dueTargets.length === 0) {
      scheduleNext();
      return;
    }
    await Promise.all(
      dueTargets.map(async (target) => {
        inFlight.add(target.targetUserId);
        try {
          const status = await options.fetchStatus(target);
          if (stopped || targets.get(target.targetUserId) !== target) return;
          if (status === null) {
            targets.delete(target.targetUserId);
            options.onCompleted(target);
            return;
          }
          if (status.sweepNotBefore) {
            const updated = {
              ...target,
              sweepNotBefore: status.sweepNotBefore,
            };
            targets.set(target.targetUserId, updated);
          }
        } catch {
          // A transient read never claims completion and retains every target.
        } finally {
          inFlight.delete(target.targetUserId);
        }
      }),
    );
    scheduleNext();
  };

  const observeWaitingSweep = (target: ObservedClientPurge) => {
    if (stopped || !target.targetUserId || !Number.isFinite(Date.parse(target.sweepNotBefore))) {
      return;
    }
    targets.set(target.targetUserId, target);
    scheduleNext();
  };

  const onFocus: EventListener = () => {
    void refresh();
  };
  const onVisibilityChange: EventListener = () => {
    if (options.isVisible?.() ?? true) void refresh();
  };
  options.focusTarget?.addEventListener('focus', onFocus);
  options.visibilityTarget?.addEventListener(
    'visibilitychange',
    onVisibilityChange,
  );

  return {
    observeWaitingSweep,
    refresh,
    stop() {
      if (stopped) return;
      stopped = true;
      targets.clear();
      stopTimer();
      options.focusTarget?.removeEventListener('focus', onFocus);
      options.visibilityTarget?.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );
    },
  };
}
