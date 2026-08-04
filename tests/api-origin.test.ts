import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configuredMutationOrigins,
  isAllowedMutationOrigin,
} from '../lib/server/api';

test('mutation origins include the canonical and explicit migration domains', () => {
  const environment = {
    NODE_ENV: 'production',
    APP_ORIGIN: 'https://bank.monalyz.com',
    NEXT_PUBLIC_APP_ORIGIN: 'https://bank.monalyz.com',
    APP_ALLOWED_ORIGINS:
      'https://www.monalyz.com, https://bank.monalyz.com, javascript:alert(1)',
  } as NodeJS.ProcessEnv;

  assert.deepEqual(
    [...configuredMutationOrigins(environment)].sort(),
    ['https://bank.monalyz.com', 'https://www.monalyz.com'],
  );
  assert.equal(
    isAllowedMutationOrigin(
      'https://www.monalyz.com',
      'https://bank.monalyz.com',
      environment,
    ),
    true,
  );
  assert.equal(
    isAllowedMutationOrigin(
      'https://attacker.example',
      'https://bank.monalyz.com',
      environment,
    ),
    false,
  );
});

test('production stays closed when no trusted origin is configured', () => {
  assert.equal(
    isAllowedMutationOrigin(
      'https://request.example',
      'https://request.example',
      { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
    ),
    false,
  );
  assert.equal(
    isAllowedMutationOrigin(
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3000',
      { NODE_ENV: 'development' } as NodeJS.ProcessEnv,
    ),
    true,
  );
});
