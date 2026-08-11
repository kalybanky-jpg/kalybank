import type { createPrivilegedClient } from '@/lib/server/api';

type PrivilegedClient = ReturnType<typeof createPrivilegedClient>;

export async function hasActiveProfile(
  worker: PrivilegedClient,
  userId: string,
) {
  const { data, error } = await worker
    .from('profiles')
    .select('access_status')
    .eq('user_id', userId)
    .maybeSingle();
  return !error && data?.access_status === 'active';
}
