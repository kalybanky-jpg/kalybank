'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { FileDown, FileText, ShieldAlert } from 'lucide-react';

export default function UserDocumentsView() {
  const { transactions, setIsStatementsModalOpen } = useAppStore();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <FileText className="w-4 h-4" />
          <span>Exports KALY</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">Documents internes</h1>
        <p className="text-xs text-slate-300 mt-2 max-w-2xl">
          KALY ne produit ni relevé bancaire officiel, ni RIB, ni attestation de
          solde bancaire. Les exports décrivent uniquement les événements enregistrés dans l&apos;application.
        </p>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-slate-900">Registre des règlements externes</h2>
            <p className="text-xs text-slate-500 mt-1">
              {transactions.length} événement(s) confirmé(s) sur preuve
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsStatementsModalOpen(true)}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Préparer un export
          </button>
        </div>
      </section>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
        <p className="text-xs text-amber-900 leading-relaxed">
          Un export KALY n&apos;est pas une preuve émise par une banque. Pour un
          justificatif bancaire, utilisez le document fourni directement par
          l&apos;établissement qui a réellement exécuté l&apos;opération hors application.
        </p>
      </div>
    </div>
  );
}
