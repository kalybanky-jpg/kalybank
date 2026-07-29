import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { documentId } = await context.params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  ) {
    return NextResponse.json(
      { error: 'Identifiant de document invalide.' },
      { status: 400, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentification requise.' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }

  const { data: document, error } = await supabase
    .from('official_documents')
    .select('document_number,title,status,storage_path')
    .eq('id', documentId)
    .single();
  if (error || !document) {
    return NextResponse.json(
      { error: 'Document introuvable.' },
      { status: 404, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }
  if (document.status !== 'issued' || !document.storage_path) {
    return NextResponse.json(
      { error: 'Ce document n’est pas disponible au téléchargement.' },
      { status: 409, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from('official-documents')
    .download(document.storage_path);
  if (downloadError || !file) {
    return NextResponse.json(
      { error: 'Téléchargement impossible.' },
      { status: 404, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }

  const bytes = await file.arrayBuffer();
  const safeName = `${document.document_number}-${document.title}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, private',
      'Content-Disposition': `attachment; filename="${safeName || 'document-monalyz'}.pdf"`,
      'Content-Length': String(bytes.byteLength),
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
