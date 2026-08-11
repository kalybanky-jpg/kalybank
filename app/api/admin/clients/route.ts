import type { NextRequest } from 'next/server';
import { CLIENT_PURGE_PAGE_SIZE } from '@/lib/client-purge';
import { noStoreJson } from '@/lib/server/api';
import {
  createClientPurgeRequestSignal,
  requireActiveAdmin,
} from '@/lib/server/client-purge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CandidateRow = {
  user_id: string;
  email: string;
  display_name: string;
  access_status: string;
  created_at: string;
  kyc_status: string | null;
  account_count: number;
  loan_count: number;
  transfer_count: number;
  document_count: number;
  purge_status: string | null;
  purge_stage: string | null;
  purge_sweep_not_before: string | null;
  total_count: number;
};

type UntypedRpc = {
  rpc<T>(name: string, args: Record<string, unknown>): Promise<{
    data: T | null;
    error: { code?: string } | null;
  }>;
};

export async function GET(request: NextRequest) {
  const access = await requireActiveAdmin(
    createClientPurgeRequestSignal(request.signal),
  );
  if (access.response) return access.response;
  const { admin } = access;

  const search = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const pageValue = Number(request.nextUrl.searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  if (search.length > 100 || page > 5_000) {
    return noStoreJson({ error: 'Recherche ou page invalide.' }, 400);
  }

  const { data, error } = await (
    admin.worker as unknown as UntypedRpc
  ).rpc<CandidateRow[]>('admin_list_client_purge_candidates', {
    p_actor_id: admin.user.id,
    p_search: search,
    p_limit: CLIENT_PURGE_PAGE_SIZE,
    p_offset: (page - 1) * CLIENT_PURGE_PAGE_SIZE,
  });
  if (error) {
    return noStoreJson({ error: 'Impossible de charger les clients.' }, 503);
  }

  const rows = data ?? [];
  const clients = (
    await Promise.all(
      rows.map(async (row) => {
        const auth = await admin.worker.auth.admin.getUserById(row.user_id);
        const authDeleted = row.access_status === 'auth_deleted';
        if ((!auth.data.user || !auth.data.user.email) && !authDeleted) return null;
        return {
          id: row.user_id,
          email: auth.data.user?.email ?? row.email,
          displayName: row.display_name,
          accessStatus: row.access_status,
          authDeleted,
          createdAt: auth.data.user?.created_at ?? row.created_at,
          lastSignInAt: auth.data.user?.last_sign_in_at ?? null,
          kycStatus: row.kyc_status,
          purgeStatus: row.purge_status,
          purgeStage: row.purge_stage,
          purgeSweepNotBefore: row.purge_sweep_not_before,
          counts: {
            accounts: Number(row.account_count),
            loans: Number(row.loan_count),
            transfers: Number(row.transfer_count),
            documents: Number(row.document_count),
          },
        };
      }),
    )
  ).filter((client) => client !== null);

  const total = Number(rows[0]?.total_count ?? 0);
  return noStoreJson({
    clients,
    page,
    pageSize: CLIENT_PURGE_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / CLIENT_PURGE_PAGE_SIZE)),
  });
}
