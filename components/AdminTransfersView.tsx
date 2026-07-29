'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import type { PendingTransfer } from '@/lib/types';
import {
  CheckCircle2,
  Clock,
  Search,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'À valider par le chef d’agence',
  under_review: 'À valider par le chef d’agence',
  approved_for_external_execution: 'Validé — exécution hors application',
  external_execution_recorded: 'Exécution hors application à confirmer',
  external_settlement_confirmed: 'Virement effectué',
  rejected: 'Refusé',
  cancelled: 'Annulé',
  external_failed: 'Échec déclaré',
};

export default function AdminTransfersView() {
  const {
    language,
    pendingTransfers,
    approveTransfer,
    finalizeTransfer,
    rejectTransfer,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<PendingTransfer | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTransfers = pendingTransfers.filter((transfer) => {
    const query = searchQuery.toLowerCase();
    return (
      transfer.recipientName.toLowerCase().includes(query) ||
      transfer.recipientAccount.toLowerCase().includes(query) ||
      transfer.id.toLowerCase().includes(query)
    );
  });

  const openTransfer = (transfer: PendingTransfer) => {
    setSelected(transfer);
    setNote('');
    setError('');
  };

  const run = async (operation: () => Promise<void>) => {
    setError('');
    setIsSubmitting(true);
    try {
      await operation();
      setSelected(null);
      setNote('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Action impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusClass = (status: string) => {
    if (status === 'external_settlement_confirmed') {
      return 'bg-emerald-100 text-emerald-800';
    }
    if (['rejected', 'cancelled', 'external_failed'].includes(status)) {
      return 'bg-rose-100 text-rose-800';
    }
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <div className="space-y-6">
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase">
          <Send className="w-4 h-4" />
          <span>Validation du chef d&apos;agence</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
          Demandes de virement
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl">
          Les contrôles et l&apos;exécution financière sont réalisés hors de Monalyz
          par le personnel de la banque. Le chef d&apos;agence valide le dossier, puis
          confirme ici que le virement a effectivement été exécuté.
        </p>
      </header>

      <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="relative max-w-sm mb-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="search"
            placeholder="Référence, bénéficiaire ou identifiant masqué"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-3 px-2">Date / référence</th>
                <th className="pb-3 px-2">Bénéficiaire</th>
                <th className="pb-3 px-2 text-right">Montant</th>
                <th className="pb-3 px-2">Statut</th>
                <th className="pb-3 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredTransfers.map((transfer) => {
                const status = transfer.workflowStatus ?? 'submitted';
                return (
                  <tr key={transfer.id} className="hover:bg-slate-50">
                    <td className="py-4 px-2">
                      <p className="font-bold text-slate-900">{transfer.date}</p>
                      <p className="font-mono text-[10px] text-slate-500">{transfer.id}</p>
                    </td>
                    <td className="py-4 px-2">
                      <p className="font-bold text-slate-900">{transfer.recipientName}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {transfer.recipientAccount}
                      </p>
                    </td>
                    <td className="py-4 px-2 text-right font-extrabold text-blue-700">
                      {formatDirectCurrency(transfer.amount, transfer.currency, language)}
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${statusClass(status)}`}
                      >
                        {status === 'external_settlement_confirmed' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {STATUS_LABELS[status] ?? status}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => openTransfer(transfer)}
                        className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold text-[11px]"
                      >
                        Examiner
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredTransfers.length && (
            <p className="text-center py-10 text-sm text-slate-500">
              Aucune demande trouvée.
            </p>
          )}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <section className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-5 my-auto">
            <header className="flex justify-between items-start border-b pb-4">
              <div>
                <h2 className="font-extrabold text-lg text-slate-900">
                  Virement {selected.id}
                </h2>
                <p className="text-xs text-slate-500">
                  {STATUS_LABELS[selected.workflowStatus ?? 'submitted']}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fermer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </header>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Bénéficiaire</p>
                <p className="font-bold text-slate-900">{selected.recipientName}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Montant</p>
                <p className="font-bold text-slate-900">
                  {formatDirectCurrency(selected.amount, selected.currency, language)}
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">
                {error}
              </p>
            )}

            {['submitted', 'under_review'].includes(
              selected.workflowStatus ?? 'submitted',
            ) && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                  En validant, vous confirmez en qualité de chef d&apos;agence que les
                  contrôles requis ont déjà été effectués en interne par le personnel
                  compétent.
                </div>
                <label className="block text-xs font-bold">
                  Note interne ou motif de refus
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="mt-1 w-full border rounded-xl p-3"
                    rows={3}
                  />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() =>
                      void run(() => approveTransfer(selected.id, note.trim()))
                    }
                    className="py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    <ShieldCheck className="inline w-4 h-4 mr-2" />
                    Valider le virement
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !note.trim()}
                    onClick={() =>
                      void run(() => rejectTransfer(selected.id, note.trim()))
                    }
                    className="py-3 bg-rose-50 text-rose-700 rounded-xl font-bold disabled:opacity-50"
                  >
                    <XCircle className="inline w-4 h-4 mr-2" />
                    Refuser la demande
                  </button>
                </div>
              </div>
            )}

            {[
              'approved_for_external_execution',
              'external_execution_recorded',
            ].includes(selected.workflowStatus ?? '') && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  Confirmez uniquement après avoir reçu, hors Monalyz, la confirmation
                  que le virement a effectivement été exécuté. Cette action finalise le
                  dossier et débite le compte bancaire déclaré.
                </div>
                <label className="block text-xs font-bold">
                  Note de confirmation obligatoire
                  <textarea
                    required
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="mt-1 w-full border rounded-xl p-3"
                    rows={3}
                  />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting || !note.trim()}
                    onClick={() =>
                      void run(() => finalizeTransfer(selected.id, note.trim()))
                    }
                    className="py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    <CheckCircle2 className="inline w-4 h-4 mr-2" />
                    Confirmer le virement effectué
                  </button>
                  {selected.workflowStatus === 'approved_for_external_execution' && (
                    <button
                      type="button"
                      disabled={isSubmitting || !note.trim()}
                      onClick={() =>
                        void run(() => rejectTransfer(selected.id, note.trim()))
                      }
                      className="py-3 bg-rose-50 text-rose-700 rounded-xl font-bold disabled:opacity-50"
                    >
                      Refuser la demande
                    </button>
                  )}
                </div>
              </div>
            )}

            {[
              'external_settlement_confirmed',
              'rejected',
              'cancelled',
              'external_failed',
            ].includes(selected.workflowStatus ?? '') && (
              <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-700 flex gap-2">
                {selected.workflowStatus === 'external_settlement_confirmed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                Ce dossier est finalisé et conservé dans le journal d&apos;audit.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
