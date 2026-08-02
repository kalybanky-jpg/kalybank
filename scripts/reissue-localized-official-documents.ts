import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { renderOfficialDocumentPdf } from '../lib/server/official-document-pdf';

interface DocumentRow {
  id: string;
  owner_id: string;
  document_number: string;
  document_type: string;
  title: string;
  language: string;
  version: number;
  localization_revision: number;
  issued_at: string | null;
  is_demo: boolean;
  status: 'pending' | 'issued' | 'failed' | 'revoked';
  snapshot: Record<string, unknown>;
  content_hash: string | null;
  supersedes_document_id: string | null;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value || /replace|changeme|your[-_]/i.test(value)) {
    throw new Error(`Configuration requise : ${name}.`);
  }
  return value;
}

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const url = requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL');
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from('official_documents')
    .select('*')
    .eq('status', 'issued')
    .lt('localization_revision', 2)
    .order('requested_at');
  if (error) throw error;
  const sources = (data ?? []) as DocumentRow[];
  console.log(`${sources.length} document(s) historique(s) à réémettre${apply ? '.' : ' (simulation).'}`);
  if (!apply) return;

  let completed = 0;
  for (const source of sources) {
    const { data: rpcData, error: createError } = await supabase.rpc(
      'create_official_document_localized_reissue',
      { p_source_document_id: source.id, p_idempotency_key: randomUUID() },
    );
    if (createError) throw createError;
    const replacement = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as DocumentRow;
    if (!replacement?.id) throw new Error(`Réémission absente pour ${source.id}.`);

    if (replacement.status !== 'issued') {
      const pdf = await renderOfficialDocumentPdf({
        documentNumber: replacement.document_number,
        documentType: replacement.document_type,
        title: replacement.title,
        language: replacement.language,
        version: replacement.version,
        localizationRevision: replacement.localization_revision,
        issuedAt: replacement.issued_at ?? new Date().toISOString(),
        isDemo: replacement.is_demo,
        contentHash: replacement.content_hash,
        snapshot: replacement.snapshot,
      });
      const expectedHash = sha256(pdf);
      const storagePath = `${replacement.owner_id}/${replacement.id}/v${replacement.version}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('official-documents')
        .upload(storagePath, pdf, { contentType: 'application/pdf', cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: downloaded, error: downloadError } = await supabase.storage
        .from('official-documents')
        .download(storagePath);
      if (downloadError) throw downloadError;
      const uploadedHash = sha256(new Uint8Array(await downloaded.arrayBuffer()));
      if (uploadedHash !== expectedHash) throw new Error(`Empreinte incohérente pour ${replacement.id}.`);

      const { data: completedData, error: completeError } = await supabase.rpc(
        'complete_official_document',
        {
          p_document_id: replacement.id,
          p_storage_path: storagePath,
          p_content_hash: expectedHash,
          p_succeeded: true,
          p_error: null,
        },
      );
      if (completeError) throw completeError;
      const completedDocument = (Array.isArray(completedData) ? completedData[0] : completedData) as DocumentRow;
      if (completedDocument.content_hash !== expectedHash) {
        throw new Error(`L’empreinte enregistrée ne correspond pas pour ${replacement.id}.`);
      }
    }

    const { error: finalizeError } = await supabase.rpc(
      'finalize_official_document_localized_reissue',
      { p_replacement_document_id: replacement.id },
    );
    if (finalizeError) throw finalizeError;
    completed += 1;
    console.log(`${source.document_number} → ${replacement.document_number}`);
  }
  console.log(`${completed} document(s) réémis, vérifiés et chaînés.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Réémission interrompue.');
  process.exitCode = 1;
});
