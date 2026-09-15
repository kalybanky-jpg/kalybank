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

test('development allows local server ports and localhost/127.0.0.1 interoperability even when another origin is configured', () => {
  const env = {
    NODE_ENV: 'development',
    APP_ORIGIN: 'http://127.0.0.1:3000',
    NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3000',
  } as NodeJS.ProcessEnv;

  // Running on port 3001
  assert.equal(
    isAllowedMutationOrigin('http://localhost:3001', 'http://localhost:3001', env),
    true,
  );
  assert.equal(
    isAllowedMutationOrigin('http://127.0.0.1:3001', 'http://localhost:3001', env),
    true,
  );
  assert.equal(
    isAllowedMutationOrigin('http://localhost:3001', 'http://127.0.0.1:3001', env),
    true,
  );

  // Accessing configured port 3000 via localhost
  assert.equal(
    isAllowedMutationOrigin('http://localhost:3000', 'http://127.0.0.1:3000', env),
    true,
  );

  // Attacker domain is still blocked in development
  assert.equal(
    isAllowedMutationOrigin('http://attacker.example', 'http://localhost:3001', env),
    false,
  );
});
