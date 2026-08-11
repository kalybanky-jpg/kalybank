import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { renderOfficialDocumentPdf } from '@/lib/server/official-document-pdf';
import {
  fetchBrandRowOrDefault,
  readBrandAsset,
} from '@/lib/server/branding';
import {
  createPrivilegedClient,
  isSameOriginMutation,
  noStoreJson,
} from '@/lib/server/api';
import type { Database } from '@/lib/supabase/database.types';
import { jsonObject } from '@/lib/supabase/json';
import { rpcArgsWithKnownNulls } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';
import type {
  Language,
  OfficialDocumentType,
} from '@/lib/types';
import { officialDocumentTitle } from '@/lib/user-i18n';

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
const LANGUAGES = new Set<Language>(['fr', 'en', 'de', 'es', 'it', 'nl']);

interface IssuePayload {
  ownerId?: unknown;
  accountId?: unknown;
  transferId?: unknown;
  loanId?: unknown;
  documentType?: unknown;
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
  localization_revision: number;
  requested_at: string;
  issued_at: string | null;
  is_demo: boolean;
  snapshot: Database['public']['Tables']['official_documents']['Row']['snapshot'];
  content_hash: string | null;
  status: string;
  storage_path: string | null;
  brand_name_snapshot?: string;
  brand_revision_snapshot?: number;
  brand_logo_path_snapshot?: string;
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
  return createPrivilegedClient(
    'SUPABASE_SECRET_KEY est requise pour émettre un document.',
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
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

  if (
    !ownerId ||
    accountId === undefined ||
    transferId === undefined ||
    loanId === undefined ||
    periodStart === undefined ||
    periodEnd === undefined ||
    !documentType
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
  if (profileError) return noStoreJson({ error: 'Le profil destinataire est introuvable.' }, 400);
  const language = LANGUAGES.has(profile.preferred_language as Language)
    ? (profile.preferred_language as Language)
    : 'fr';
  const title = officialDocumentTitle(language, documentType);
  const requestedIdempotencyKey = optionalUuid(
    request.headers.get('idempotency-key'),
  );
  if (requestedIdempotencyKey === undefined) {
    return noStoreJson({ error: 'Clé d’idempotence invalide.' }, 400);
  }
  const idempotencyKey = requestedIdempotencyKey ?? crypto.randomUUID();

  let worker: ReturnType<typeof privilegedClient>;
  try {
    worker = privilegedClient();
  } catch {
    return noStoreJson(
      { error: 'Le service de publication documentaire est indisponible.' },
      503,
    );
  }

  const { data, error: issueError } = await supabase.rpc(
    'branch_manager_issue_official_document',
    rpcArgsWithKnownNulls<'branch_manager_issue_official_document'>({
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
    }),
  );
  if (issueError) return noStoreJson({ error: 'Le document ne peut pas être émis avec les paramètres sélectionnés.' }, 400);

  const document = (Array.isArray(data) ? data[0] : data) as
    | IssuedDocumentRow
    | null;
  if (!document?.id || !document.snapshot) {
    return noStoreJson({ error: 'Snapshot documentaire absent.' }, 500);
  }

  if (document.status === 'issued' && document.storage_path) {
    return noStoreJson({
      id: document.id,
      documentNumber: document.document_number,
      status: 'issued',
    });
  }

  const storagePath = `${ownerId}/${document.id}/v${document.version}.pdf`;
  let uploadedByRequest = false;
  try {
    const currentBrand = await fetchBrandRowOrDefault(worker);
    const bankName = document.brand_name_snapshot || currentBrand.bank_name;
    const brandRevision = Number(
      document.brand_revision_snapshot ?? currentBrand.revision,
    );
    const brandLogoPath =
      document.brand_logo_path_snapshot || currentBrand.pdf_logo_path;
    const logoBytes = await readBrandAsset(worker, brandLogoPath);
    const pdf = await renderOfficialDocumentPdf({
      documentNumber: document.document_number,
      documentType: document.document_type,
      title: document.title,
      language: document.language,
      version: document.version,
      localizationRevision: document.localization_revision ?? 2,
      issuedAt: document.issued_at ?? document.requested_at,
      isDemo: document.is_demo,
      contentHash: document.content_hash,
      snapshot: jsonObject(document.snapshot),
      branding: {
        bankName,
        revision: brandRevision,
        logoBytes,
      },
    });
    const pdfBytes = Buffer.from(pdf);
    const contentHash = createHash('sha256').update(pdfBytes).digest('hex');
    const completePublication = () =>
      worker.rpc(
        'complete_official_document',
        rpcArgsWithKnownNulls<'complete_official_document'>({
          p_document_id: document.id,
          p_storage_path: storagePath,
          p_content_hash: contentHash,
          p_succeeded: true,
          p_error: null,
        }),
      );
    const { error: uploadError } = await worker.storage
      .from('official-documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: document.status === 'failed',
      });
    if (uploadError) {
      const { data: currentDocument } = await worker
        .from('official_documents')
        .select('status,storage_path')
        .eq('id', document.id)
        .maybeSingle();
      if (
        currentDocument?.status === 'issued' &&
        currentDocument.storage_path === storagePath
      ) {
        return noStoreJson({
          id: document.id,
          documentNumber: document.document_number,
          status: 'issued',
        });
      }
      if (currentDocument?.status === 'pending') {
        const { data: existingArtifact } = await worker.storage
          .from('official-documents')
          .download(storagePath);
        if (existingArtifact) {
          const existingHash = createHash('sha256')
            .update(Buffer.from(await existingArtifact.arrayBuffer()))
            .digest('hex');
          if (existingHash === contentHash) {
            const { error: takeoverError } = await completePublication();
            if (!takeoverError) {
              return noStoreJson({
                id: document.id,
                documentNumber: document.document_number,
                status: 'issued',
              });
            }
          }
        }
        return noStoreJson(
          { error: 'La publication de ce document est déjà en cours.' },
          409,
        );
      }
      throw uploadError;
    }
    uploadedByRequest = true;

    const { error: completeError } = await completePublication();
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
    if (uploadedByRequest) {
      const { data: currentDocument, error: stateError } = await worker
        .from('official_documents')
        .select('status,storage_path')
        .eq('id', document.id)
        .maybeSingle();
      if (
        currentDocument?.status === 'issued' &&
        currentDocument.storage_path === storagePath
      ) {
        return noStoreJson({
          id: document.id,
          documentNumber: document.document_number,
          status: 'issued',
        });
      }
      if (stateError) {
        return noStoreJson(
          { error: 'L’état de publication du PDF doit être vérifié.' },
          503,
        );
      }
      await worker.storage.from('official-documents').remove([storagePath]);
    }
    await worker.rpc(
      'complete_official_document',
      rpcArgsWithKnownNulls<'complete_official_document'>({
        p_document_id: document.id,
        p_storage_path: null,
        p_content_hash: null,
        p_succeeded: false,
        p_error:
          caughtError instanceof Error
            ? caughtError.message.slice(0, 1000)
            : 'Échec de génération PDF.',
      }),
    );
    return noStoreJson({ error: 'Le PDF officiel n’a pas pu être publié.' }, 500);
  }
}
