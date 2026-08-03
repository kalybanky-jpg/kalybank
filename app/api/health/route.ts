import { createPrivilegedClient, noStoreJson } from '@/lib/server/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEALTH_TIMEOUT_MS = 3_000;

async function checkDatabase() {
  const worker = createPrivilegedClient(
    'Configuration serveur indisponible.',
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      worker.from('brand_settings').select('revision').limit(1),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Health check timeout.')),
          HEALTH_TIMEOUT_MS,
        );
      }),
    ]);
    if (result.error) throw result.error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    await checkDatabase();
    return noStoreJson({ status: 'ok' });
  } catch {
    return noStoreJson({ status: 'unavailable' }, 503);
  }
}
