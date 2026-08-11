import type { NextRequest } from 'next/server';
import { createPrivilegedClient, noStoreJson } from '@/lib/server/api';
import {
  executePurge,
  pendingPurges,
  validSweepSecret,
} from '@/lib/server/client-purge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const CLIENT_PURGE_SWEEP_BUDGET_MS = 20_000;
export const CLIENT_PURGE_SUPABASE_TIMEOUT_MS = 15_000;
export const CLIENT_PURGE_INVOCATION_TIMEOUT_MS = 18_000;

export async function POST(request: NextRequest) {
  if (!validSweepSecret(request.headers.get('x-client-purge-sweep-secret'))) {
    return noStoreJson({ error: 'Accès refusé.' }, 401);
  }

  const invocationSignal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(CLIENT_PURGE_INVOCATION_TIMEOUT_MS),
  ]);
  let worker;
  try {
    worker = createPrivilegedClient(
      'SUPABASE_SECRET_KEY est requise pour reprendre les suppressions.',
      {
        fetchTimeoutMs: CLIENT_PURGE_SUPABASE_TIMEOUT_MS,
        requestTimeoutMs: CLIENT_PURGE_INVOCATION_TIMEOUT_MS,
        requestSignal: invocationSignal,
      },
    );
  } catch {
    return noStoreJson({ error: 'Service indisponible.' }, 503);
  }

  const deadline = Date.now() + CLIENT_PURGE_SWEEP_BUDGET_MS;
  const maxBatches = 25;
  let inspected = 0;
  let completed = 0;
  let failed = 0;
  while (
    inspected < maxBatches &&
    Date.now() < deadline &&
    !invocationSignal.aborted
  ) {
    let pending;
    try {
      pending = await pendingPurges(worker, 1);
    } catch {
      if (inspected === 0) {
        return noStoreJson({ error: 'Reprise temporairement indisponible.' }, 503);
      }
      failed += 1;
      break;
    }
    const operation = pending[0];
    if (!operation) break;
    let stage = operation.stage;
    while (
      inspected < maxBatches &&
      Date.now() < deadline &&
      !invocationSignal.aborted
    ) {
      inspected += 1;
      try {
        const outcome = await executePurge({
          admin: {
            worker,
            user: { id: operation.actor_id },
            email: '',
          },
          targetUserId: operation.target_user_id,
          challengeId: operation.challenge_id,
          startState: {
            status: 'running',
            stage,
            sweepNotBefore: null,
          },
          leaseAlreadyAcquired: true,
        });
        if (outcome.deleted || outcome.status === 'waiting_sweep') {
          completed += 1;
          break;
        }
        stage = outcome.stage;
        if (outcome.workKind === 'wait') break;
      } catch {
        failed += 1;
        break;
      }
    }
  }
  return noStoreJson(
    {
      inspected,
      completed,
      failed,
      budgetExhausted:
        inspected >= maxBatches ||
        Date.now() >= deadline ||
        invocationSignal.aborted,
    },
    200,
  );
}
