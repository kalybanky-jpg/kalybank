import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../app/api/health/route';

test('le health check échoue sans divulguer la configuration serveur', async () => {
  const secret = process.env.SUPABASE_SECRET_KEY;
  const legacySecret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
  } finally {
    if (secret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = secret;
    if (legacySecret === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = legacySecret;
    }
  }
});
