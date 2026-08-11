'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import type { Language } from '@/lib/types';
import { Download, FileText, X } from 'lucide-react';
import { officialDocumentTitle } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';
import { Dialog, DialogBackdrop, DialogPanel } from '@/components/ui/Dialog';

const messages: Record<
  Language,
  {
    title: string;
    subtitle: string;
    empty: string;
    download: string;
    close: string;
    hint: string;
  }
> = {
  fr: {
    title: 'Relevés de compte officiels',
    subtitle: 'Documents émis et enregistrés par le chef d’agence',
    empty: 'Aucun relevé officiel n’est disponible pour le moment.',
    download: 'Télécharger',
    close: 'Fermer',
    hint: 'Un nouveau relevé doit être émis par le chef d’agence depuis le registre bancaire.',
  },
  en: {
    title: 'Official account statements',
    subtitle: 'Documents issued and recorded by the branch manager',
    empty: 'No official statement is available yet.',
    download: 'Download',
    close: 'Close',
    hint: 'A new statement must be issued by the branch manager from the bank register.',
  },
  de: {
    title: 'Offizielle Kontoauszüge',
    subtitle: 'Vom Filialleiter ausgestellte und erfasste Dokumente',
    empty: 'Noch kein offizieller Kontoauszug verfügbar.',
    download: 'Herunterladen',
    close: 'Schließen',
    hint: 'Ein neuer Auszug muss vom Filialleiter aus dem Bankregister ausgestellt werden.',
  },
  es: {
    title: 'Extractos oficiales',
    subtitle: 'Documentos emitidos y registrados por el director de sucursal',
    empty: 'Todavía no hay ningún extracto oficial disponible.',
    download: 'Descargar',
    close: 'Cerrar',
    hint: 'El director de sucursal debe emitir un nuevo extracto desde el registro bancario.',
  },
};

export default function AccountStatementsModal() {
  const {
    language,
    officialDocuments,
    isStatementsModalOpen,
    setIsStatementsModalOpen,
  } = useAppStore();
  const t = useBranded(messages[language]);

  if (!isStatementsModalOpen) return null;

  const statements = officialDocuments.filter(
    (document) =>
      document.documentType === 'account_statement' &&
      document.status === 'issued',
  );

  return (
    <Dialog
      open={isStatementsModalOpen}
      onClose={() => setIsStatementsModalOpen(false)}
      ariaLabelledBy="account-statements-modal-title"
    >
      <DialogBackdrop className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/70 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
        <DialogPanel
          as="section"
          className="flex max-h-dvh min-h-0 w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
        >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b p-4 sm:p-6">
          <div className="flex min-w-0 gap-3">
            <FileText className="h-7 w-7 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <h2
                id="account-statements-modal-title"
                className="break-words font-extrabold text-slate-900"
              >
                {t.title}
              </h2>
              <p className="mt-1 break-words text-xs text-slate-500">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStatementsModalOpen(false)}
            aria-label={t.close}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {statements.map((statement) => (
            <div
              key={statement.id}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words text-xs font-extrabold text-slate-900">
                  {officialDocumentTitle(language, statement.documentType)}
                </p>
                <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
                  {statement.documentNumber}
                </p>
              </div>
              <a
                href={`/api/official-documents/${statement.id}`}
                className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white sm:w-auto"
              >
                <Download className="w-4 h-4" />
                {t.download}
              </a>
            </div>
          ))}
          {!statements.length && (
            <p className="py-10 text-center text-sm text-slate-500">{t.empty}</p>
          )}
        </div>

        <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <p className="break-words rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            {t.hint}
          </p>
        </div>
        </DialogPanel>
      </DialogBackdrop>
    </Dialog>
  );
}
