import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLIENT_PURGE_STORAGE_VERIFY_CONCURRENCY,
  executePurge,
  processStorageWorkUnit,
  type ActiveAdmin,
} from '../lib/server/client-purge';

const adminId = '10000000-0000-4000-8000-000000000001';
const targetId = '20000000-0000-4000-8000-000000000001';
const foreignId = '30000000-0000-4000-8000-000000000001';
const challengeId = '40000000-0000-4000-8000-000000000001';

type Work = Record<string, unknown> & { kind: string };

function adminWithWorker(worker: object): ActiveAdmin {
  return {
    user: { id: adminId },
    email: 'admin@example.test',
    worker: worker as ActiveAdmin['worker'],
  };
}

test('une claim falsifiée vers le fichier de B est rejetée avant toute suppression', async () => {
  let removed = false;
  let acknowledged = false;
  const worker = {
    rpc: async (name: string) => {
      if (name === 'admin_claim_client_purge_storage_work') {
        return {
          data: {
            kind: 'delete',
            claimToken: crypto.randomUUID(),
            items: [{
              bucket: 'kyc-evidence',
              objectPath: `${foreignId}/identity.pdf`,
              ownershipScope: 'target_prefix',
            }],
            complete: false,
          },
          error: null,
        };
      }
      acknowledged = true;
      return { data: {}, error: null };
    },
    storage: {
      from: () => ({
        remove: async () => {
          removed = true;
          return { data: [], error: null };
        },
      }),
    },
  };
  await assert.rejects(
    processStorageWorkUnit(
      adminWithWorker(worker),
      targetId,
      challengeId,
    ),
    /STORAGE_OWNERSHIP_ANOMALY/,
  );
  assert.equal(removed, false);
  assert.equal(acknowledged, false);
});

test('les claims acquittées reprennent à la page suivante sans rejouer la page 1', async () => {
  const remaining = Array.from(
    { length: 2_001 },
    (_, index) => `${targetId}/opaque-${index}.pdf`,
  );
  const claimed = new Map<string, string[]>();
  const removedPages: string[][] = [];
  const worker = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'admin_claim_client_purge_storage_work') {
        const paths = remaining.slice(0, 1_000);
        const token = crypto.randomUUID();
        claimed.set(token, paths);
        return {
          data: {
            kind: 'delete',
            claimToken: token,
            items: paths.map((objectPath) => ({
              bucket: 'kyc-evidence',
              objectPath,
              ownershipScope: 'target_prefix',
            })),
            complete: false,
          },
          error: null,
        };
      }
      if (name === 'admin_ack_client_purge_storage_work') {
        const paths = claimed.get(String(args.p_claim_token)) ?? [];
        remaining.splice(0, paths.length);
        claimed.delete(String(args.p_claim_token));
        return { data: { acknowledged: true }, error: null };
      }
      return { data: null, error: { code: 'UNEXPECTED_RPC', message: name } };
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removedPages.push([...paths]);
          return { data: [], error: null };
        },
      }),
    },
  };
  const admin = adminWithWorker(worker);
  await processStorageWorkUnit(admin, targetId, challengeId);
  const firstPage = [...removedPages[0]];

  // Simulate a process interruption after the durable ack, then resume with a
  // fresh invocation. The durable server cursor must return page 2, not page 1.
  await processStorageWorkUnit(admin, targetId, challengeId);
  await processStorageWorkUnit(admin, targetId, challengeId);
  assert.deepEqual(removedPages.map((page) => page.length), [1_000, 1_000, 1]);
  assert.equal(removedPages[1].some((path) => firstPage.includes(path)), false);
  assert.equal(new Set(removedPages.flat()).size, 2_001);
  assert.equal(remaining.length, 0);
});

test('les clés Storage opaques sont transmises octet pour octet', async () => {
  const exactPath = `${targetId}/identité 🧾.pdf `;
  let removedPath = '';
  const worker = {
    rpc: async (name: string) => {
      if (name === 'admin_claim_client_purge_storage_work') {
        return {
          data: {
            kind: 'delete',
            claimToken: crypto.randomUUID(),
            items: [{
              bucket: 'kyc-evidence',
              objectPath: exactPath,
              ownershipScope: 'target_prefix',
            }],
            complete: false,
          },
          error: null,
        };
      }
      return { data: { acknowledged: true }, error: null };
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removedPath = paths[0];
          return { data: [], error: null };
        },
      }),
    },
  };
  await processStorageWorkUnit(
    adminWithWorker(worker),
    targetId,
    challengeId,
  );
  assert.equal(removedPath, exactPath);
});

test('1001 vérifications relationnelles respectent la concurrence maximale', async () => {
  const paths = Array.from(
    { length: 1_001 },
    (_, index) => `${foreignId}/preuve-${index}.pdf`,
  );
  let cursor = 0;
  let active = 0;
  let maximumActive = 0;
  let listCalls = 0;
  const worker = {
    rpc: async (name: string) => {
      if (name === 'admin_claim_client_purge_storage_work') {
        const page = paths.slice(cursor, cursor + 100);
        cursor += page.length;
        return {
          data: {
            kind: 'verify_manifest',
            claimToken: crypto.randomUUID(),
            items: page.map((objectPath) => ({
              bucket: 'external-execution-evidence',
              objectPath,
              ownershipScope: 'relational',
            })),
            complete: false,
          },
          error: null,
        };
      }
      return { data: { acknowledged: true }, error: null };
    },
    storage: {
      from: () => ({
        list: async () => {
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          listCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 1));
          active -= 1;
          return { data: [], error: null };
        },
      }),
    },
  };
  const admin = adminWithWorker(worker);
  while (cursor < paths.length) {
    await processStorageWorkUnit(admin, targetId, challengeId);
  }
  assert.equal(listCalls, 1_001);
  assert.ok(maximumActive <= CLIENT_PURGE_STORAGE_VERIFY_CONCURRENCY);
  assert.ok(maximumActive > 1);
});

test('une invocation utilisateur traite une seule unité puis répond processing', async () => {
  const calls: string[] = [];
  const worker = {
    rpc: async (name: string) => {
      calls.push(name);
      if (name === 'admin_claim_client_purge_storage_work') {
        return {
          data: {
            kind: 'database',
            phase: 'references',
            processed: 1_000,
            complete: false,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };
  const outcome = await executePurge({
    admin: adminWithWorker(worker),
    targetUserId: targetId,
    challengeId,
    startState: {
      status: 'running',
      stage: 'storage',
      sweepNotBefore: null,
    },
    leaseAlreadyAcquired: true,
  });
  assert.equal(outcome.status, 'processing');
  assert.deepEqual(calls, ['admin_claim_client_purge_storage_work']);
  assert.equal(calls.includes('admin_purge_client_relational_data'), false);
});

test('la purge relationnelle passe par Auth sans annoncer waiting_sweep', async () => {
  const sweepNotBefore = '2026-08-17T14:05:00.000Z';
  const calls: string[] = [];
  const worker = {
    rpc: async (name: string) => {
      calls.push(name);
      if (name === 'admin_purge_client_relational_data') {
        return {
          data: {
            status: 'running',
            stage: 'auth',
            sweepNotBefore,
            ignoredUnsafeStorageReferences: 2,
          },
          error: null,
        };
      }
      return { data: null, error: { code: 'UNEXPECTED_RPC', message: name } };
    },
  };

  const outcome = await executePurge({
    admin: adminWithWorker(worker),
    targetUserId: targetId,
    challengeId,
    startState: { status: 'running', stage: 'database', sweepNotBefore: null },
    leaseAlreadyAcquired: true,
  });

  assert.deepEqual(calls, ['admin_purge_client_relational_data']);
  assert.equal(outcome.status, 'processing');
  assert.equal(outcome.stage, 'auth');
  assert.equal(outcome.sweepNotBefore, sweepNotBefore);
  assert.equal(outcome.ignoredUnsafeStorageReferences, 2);
  assert.equal(outcome.authDeleted, false);
});

test('un replay waiting_sweep sans indicateur relit Auth et confirme sa suppression', async () => {
  const sweepNotBefore = '2026-08-17T14:05:00.000Z';
  let lookupCalls = 0;
  const worker = {
    auth: {
      admin: {
        getUserById: async () => {
          lookupCalls += 1;
          return {
            data: { user: null },
            error: { code: 'user_not_found', status: 404 },
          };
        },
      },
    },
  };

  const outcome = await executePurge({
    admin: adminWithWorker(worker),
    targetUserId: targetId,
    challengeId,
    startState: {
      status: 'waiting_sweep',
      stage: 'waiting_sweep',
      sweepNotBefore,
    },
    leaseAlreadyAcquired: false,
  });

  assert.equal(lookupCalls, 1);
  assert.equal(outcome.status, 'waiting_sweep');
  assert.equal(outcome.stage, 'waiting_sweep');
  assert.equal(outcome.sweepNotBefore, sweepNotBefore);
  assert.equal(outcome.authDeleted, true);
});

test('un conflit PostgreSQL conserve son symbole métier dans l’état de reprise', async () => {
  let persistedError = '';
  const worker = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'admin_claim_client_purge_storage_work') {
        return {
          data: null,
          error: {
            code: '55000',
            message: 'PURGE_EVIDENCE_PATH_OWNERSHIP_CONFLICT',
          },
        };
      }
      if (name === 'admin_mark_client_purge_stage') {
        persistedError = String(args.p_error_code ?? '');
        return { data: true, error: null };
      }
      return { data: null, error: { code: 'UNEXPECTED_RPC', message: name } };
    },
  };

  await assert.rejects(
    executePurge({
      admin: adminWithWorker(worker),
      targetUserId: targetId,
      challengeId,
      startState: { status: 'running', stage: 'storage_sweep', sweepNotBefore: null },
      leaseAlreadyAcquired: true,
    }),
    /PURGE_EVIDENCE_PATH_OWNERSHIP_CONFLICT/,
  );
  assert.equal(persistedError, 'PURGE_EVIDENCE_PATH_OWNERSHIP_CONFLICT');
});

test('Auth est supprimée avant le passage durable à waiting_sweep', async () => {
  const calls: string[] = [];
  let authExists = true;
  const sweepNotBefore = '2026-08-17T14:05:00.000Z';
  const worker = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === 'admin_assert_client_purge_auth_ready') {
        return {
          data: {
            allowed: true,
            targetEmail: 'target@example.test',
            sweepNotBefore,
          },
          error: null,
        };
      }
      if (name === 'admin_mark_client_purge_stage') {
        assert.equal(args.p_stage, 'waiting_sweep');
        assert.equal(authExists, false);
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: authExists
              ? { id: targetId, email: 'target@example.test' }
              : null,
          },
          error: authExists ? null : { code: 'user_not_found', status: 404 },
        }),
        deleteUser: async () => {
          calls.push('auth.deleteUser');
          authExists = false;
          return { data: null, error: null };
        },
      },
    },
  };
  const outcome = await executePurge({
    admin: adminWithWorker(worker),
    targetUserId: targetId,
    challengeId,
    startState: { status: 'running', stage: 'auth', sweepNotBefore },
    leaseAlreadyAcquired: true,
  });
  assert.equal(outcome.authDeleted, true);
  assert.equal(outcome.status, 'waiting_sweep');
  assert.equal(outcome.stage, 'waiting_sweep');
  assert.equal(outcome.sweepNotBefore, sweepNotBefore);
  assert.ok(
    calls.indexOf('admin_assert_client_purge_auth_ready') <
      calls.indexOf('auth.deleteUser'),
  );
  assert.ok(
    calls.indexOf('auth.deleteUser') <
      calls.indexOf('admin_mark_client_purge_stage'),
  );
});

test('une reprise avec Auth déjà absente ne relance pas deleteUser', async () => {
  const calls: string[] = [];
  let deleteCalls = 1;
  const sweepNotBefore = '2026-08-17T14:05:00.000Z';
  const worker = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === 'admin_assert_client_purge_auth_ready') {
        return {
          data: {
            allowed: true,
            targetEmail: 'target@example.test',
            authExists: false,
            sweepNotBefore,
          },
          error: null,
        };
      }
      if (name === 'admin_mark_client_purge_stage') {
        assert.equal(args.p_stage, 'waiting_sweep');
      }
      return { data: null, error: null };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: null },
          error: { code: 'user_not_found', status: 404 },
        }),
        deleteUser: async () => {
          deleteCalls += 1;
          calls.push('auth.deleteUser');
          return { data: null, error: null };
        },
      },
    },
  };

  const outcome = await executePurge({
    admin: adminWithWorker(worker),
    targetUserId: targetId,
    challengeId,
    startState: { status: 'running', stage: 'auth', sweepNotBefore },
    leaseAlreadyAcquired: true,
  });

  assert.equal(deleteCalls, 1);
  assert.equal(calls.includes('auth.deleteUser'), false);
  assert.equal(outcome.status, 'waiting_sweep');
  assert.equal(outcome.stage, 'waiting_sweep');
  assert.equal(outcome.authDeleted, true);
  assert.equal(outcome.sweepNotBefore, sweepNotBefore);
});

test('un échec deleteUser reste reprenable au stage auth', async () => {
  const persistedStages: Array<{ stage: unknown; errorCode: unknown }> = [];
  const worker = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'admin_assert_client_purge_auth_ready') {
        return {
          data: {
            allowed: true,
            targetEmail: 'target@example.test',
            sweepNotBefore: '2026-08-17T14:05:00.000Z',
          },
          error: null,
        };
      }
      if (name === 'admin_mark_client_purge_stage') {
        persistedStages.push({
          stage: args.p_stage,
          errorCode: args.p_error_code,
        });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { id: targetId, email: 'target@example.test' } },
          error: null,
        }),
        deleteUser: async () => ({
          data: null,
          error: { code: 'storage_objects_not_empty', status: 422 },
        }),
      },
    },
  };

  await assert.rejects(
    executePurge({
      admin: adminWithWorker(worker),
      targetUserId: targetId,
      challengeId,
      startState: {
        status: 'running',
        stage: 'auth',
        sweepNotBefore: '2026-08-17T14:05:00.000Z',
      },
      leaseAlreadyAcquired: true,
    }),
    /storage_objects_not_empty/,
  );
  assert.deepEqual(persistedStages, [
    { stage: 'auth', errorCode: 'storage_objects_not_empty' },
  ]);
  assert.equal(
    persistedStages.some(({ stage }) => stage === 'waiting_sweep'),
    false,
  );
});

test('un e-mail Auth modifié après le gel bloque la suppression avant son effet', async () => {
  let deleteCalls = 0;
  const worker = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
    rpc: async (name: string) => ({
      data:
        name === 'admin_assert_client_purge_auth_ready'
          ? {
              allowed: true,
              targetEmail: 'before@example.test',
              sweepNotBefore: '2026-08-17T14:05:00.000Z',
            }
          : null,
      error: null,
    }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { id: targetId, email: 'after@example.test' } },
          error: null,
        }),
        deleteUser: async () => {
          deleteCalls += 1;
          return { data: null, error: null };
        },
      },
    },
  };
  await assert.rejects(
    executePurge({
      admin: adminWithWorker(worker),
      targetUserId: targetId,
      challengeId,
      startState: { status: 'running', stage: 'auth', sweepNotBefore: null },
      leaseAlreadyAcquired: true,
    }),
    /PURGE_TARGET_EMAIL_CHANGED/,
  );
  assert.equal(deleteCalls, 0);
});
