import { noStoreJson } from '@/lib/server/api';
import { getVapidPublicKey } from '@/lib/support/tawk-server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authenticationError,
    } = await supabase.auth.getUser();

    if (authenticationError || !user) {
      return noStoreJson({ error: 'unauthorized' }, 401);
    }

    return noStoreJson({ publicKey: getVapidPublicKey() });
  } catch {
    return noStoreJson({ error: 'support_unavailable' }, 503);
  }
}
