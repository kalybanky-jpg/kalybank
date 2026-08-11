import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDestructivePurgeRunsInGithubActions } from '../scripts/client-purge-integration-guard';

test('the destructive purge integration gate refuses every non-GitHub environment', () => {
  const allowed = {
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    MONALYZ_ALLOW_DESTRUCTIVE_LOCAL_PURGE_TEST: '1',
  } as const;

  assert.doesNotThrow(() => assertDestructivePurgeRunsInGithubActions(allowed));
  for (const override of [
    { CI: 'false' },
    { GITHUB_ACTIONS: 'false' },
    { GITHUB_ACTIONS: undefined },
    { MONALYZ_ALLOW_DESTRUCTIVE_LOCAL_PURGE_TEST: '0' },
  ]) {
    assert.throws(
      () => assertDestructivePurgeRunsInGithubActions({ ...allowed, ...override }),
      /DESTRUCTIVE_LOCAL_PURGE_TEST_GUARD_REQUIRED/,
    );
  }
});
