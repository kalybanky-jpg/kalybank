'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import type { Language } from '@/lib/types';
import { Download, FileText, X } from 'lucide-react';

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
  const t = messages[language];

  if (!isStatementsModalOpen) return null;

  const statements = officialDocuments.filter(
    (document) =>
      document.documentType === 'account_statement' &&
      document.status === 'issued',
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <section className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5">
        <header className="flex items-start justify-between border-b pb-4">
          <div className="flex gap-3">
            <FileText className="w-7 h-7 text-blue-600" />
            <div>
              <h2 className="font-extrabold text-slate-900">{t.title}</h2>
              <p className="text-xs text-slate-500">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStatementsModalOpen(false)}
            aria-label={t.close}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {statements.map((statement) => (
            <div
              key={statement.id}
              className="p-4 border rounded-2xl flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs font-extrabold text-slate-900">
                  {statement.title}
                </p>
                <p className="font-mono text-[10px] text-slate-500 mt-1">
                  {statement.documentNumber}
                </p>
              </div>
              <a
                href={`/api/official-documents/${statement.id}`}
                className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex gap-2"
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

        <p className="p-3 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl text-xs">
          {t.hint}
        </p>
      </section>
    </div>
  );
}
