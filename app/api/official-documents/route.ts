import { createHash } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { renderOfficialDocumentPdf } from '@/lib/server/official-document-pdf';
import { getPublicSupabaseConfig } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import type {
  Language,
  OfficialDocumentType,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOCUMENT_TYPES = new Set<OfficialDocumentType>([
  'bank_details',
  'account_statement',
  'balance_certificate',
  'transfer_confirmation',
  'loan_disbursement_confirmation',
  'loan_decision',
]);
const LANGUAGES = new Set<Language>(['fr', 'en', 'de', 'es']);

interface IssuePayload {
  ownerId?: unknown;
  accountId?: unknown;
  transferId?: unknown;
  loanId?: unknown;
  documentType?: unknown;
  title?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
}

interface IssuedDocumentRow {
  id: string;
  owner_id: string;
  document_number: string;
  document_type: string;
  title: string;
  language: string;
  version: number;
  issued_at: string | null;
  is_demo: boolean;
  snapshot: Record<string, unknown>;
  content_hash: string | null;
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  const canonicalOrigin =
    process.env.APP_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    (process.env.NODE_ENV === 'development' ? request.nextUrl.origin : null);
  if (!origin || !canonicalOrigin) return false;
  try {
    return new URL(origin).origin === new URL(canonicalOrigin).origin;
  } catch {
    return false;
  }
}

function optionalUuid(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : undefined;
}

function optionalDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined;
}

function privilegedClient() {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secretKey || /replace|changeme|your[-_]/i.test(secretKey)) {
    throw new Error('SUPABASE_SECRET_KEY est requise pour émettre un document.');
  }
  const { url } = getPublicSupabaseConfig();
  return createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return noStoreJson({ error: 'Origine refusée.' }, 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return noStoreJson({ error: 'Authentification requise.' }, 401);
  }

  const { data: role, error: roleError } = await supabase.rpc('current_app_role');
  if (roleError || role !== 'admin') {
    return noStoreJson({ error: 'Habilitation chef d’agence requise.' }, 403);
  }

  let body: IssuePayload;
  try {
    body = (await request.json()) as IssuePayload;
  } catch {
    return noStoreJson({ error: 'Corps JSON invalide.' }, 400);
  }

  const ownerId = optionalUuid(body.ownerId);
  const accountId = optionalUuid(body.accountId);
  const transferId = optionalUuid(body.transferId);
  const loanId = optionalUuid(body.loanId);
  const periodStart = optionalDate(body.periodStart);
  const periodEnd = optionalDate(body.periodEnd);
  const documentType =
    typeof body.documentType === 'string' &&
    DOCUMENT_TYPES.has(body.documentType as OfficialDocumentType)
      ? (body.documentType as OfficialDocumentType)
      : null;
  const title =
    typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '';

  if (
    !ownerId ||
    accountId === undefined ||
    transferId === undefined ||
    loanId === undefined ||
    periodStart === undefined ||
    periodEnd === undefined ||
    !documentType ||
    title.length < 3
  ) {
    return noStoreJson({ error: 'Paramètres de document invalides.' }, 400);
  }
  if (periodStart && periodEnd && periodStart > periodEnd) {
    return noStoreJson({ error: 'La période du document est invalide.' }, 400);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('user_id', ownerId)
    .single();
  if (profileError) return noStoreJson({ error: profileError.message }, 400);
  const language = LANGUAGES.has(profile.preferred_language as Language)
    ? (profile.preferred_language as Language)
    : 'fr';
  const idempotencyKey = crypto.randomUUID();

  const { data, error: issueError } = await supabase.rpc(
    'branch_manager_issue_official_document',
    {
      p_owner_id: ownerId,
      p_account_id: accountId,
      p_transfer_id: transferId,
      p_loan_id: loanId,
      p_document_type: documentType,
      p_title: title,
      p_language: language,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_idempotency_key: idempotencyKey,
    },
  );
  if (issueError) return noStoreJson({ error: issueError.message }, 400);

  const document = (Array.isArray(data) ? data[0] : data) as
    | IssuedDocumentRow
    | null;
  if (!document?.id || !document.snapshot) {
    return noStoreJson({ error: 'Snapshot documentaire absent.' }, 500);
  }

  const worker = privilegedClient();
  const storagePath = `${ownerId}/${document.id}/v${document.version}.pdf`;
  try {
    const pdf = await renderOfficialDocumentPdf({
      documentNumber: document.document_number,
      documentType: document.document_type,
      title: document.title,
      language: document.language,
      version: document.version,
      issuedAt: document.issued_at ?? new Date().toISOString(),
      isDemo: document.is_demo,
      contentHash: document.content_hash,
      snapshot: document.snapshot,
    });
    const pdfBytes = Buffer.from(pdf);
    const contentHash = createHash('sha256').update(pdfBytes).digest('hex');
    const { error: uploadError } = await worker.storage
      .from('official-documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: completeError } = await worker.rpc(
      'complete_official_document',
      {
        p_document_id: document.id,
        p_storage_path: storagePath,
        p_content_hash: contentHash,
        p_succeeded: true,
        p_error: null,
      },
    );
    if (completeError) throw completeError;

    return noStoreJson(
      {
        id: document.id,
        documentNumber: document.document_number,
        status: 'issued',
      },
      201,
    );
  } catch (caughtError) {
    await worker.storage.from('official-documents').remove([storagePath]);
    await worker.rpc('complete_official_document', {
      p_document_id: document.id,
      p_storage_path: null,
      p_content_hash: null,
      p_succeeded: false,
      p_error:
        caughtError instanceof Error
          ? caughtError.message.slice(0, 1000)
          : 'Échec de génération PDF.',
    });
    return noStoreJson({ error: 'Le PDF officiel n’a pas pu être publié.' }, 500);
  }
}
