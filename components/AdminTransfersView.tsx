'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import type { PendingTransfer } from '@/lib/types';
import { CheckCircle2, Clock, Search, Send, X, XCircle } from 'lucide-react';
import { useBrand } from '@/components/brand/BrandProvider';
import { Dialog, DialogBackdrop, DialogPanel } from '@/components/ui/Dialog';

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
  const { brand } = useBrand();
  const {
    pendingTransfers,
    reviewTransferCheck,
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

  const checkDefinitions = [
    { kind: 'dual_review' as const, label: 'Double validation interne' },
    { kind: 'escalation' as const, label: 'Escalade hiérarchique' },
    { kind: 'compliance' as const, label: 'Contrôle conformité' },
    { kind: 'final_authorization' as const, label: 'Autorisation finale' },
  ];

  const checkStatusLabel = (status: string) => {
    if (status === 'termine') return 'Terminé';
    if (status === 'en_cours') return 'En cours';
    return 'En attente';
  };

  return (
    <div className="min-w-0 space-y-6">
      <header className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-4 text-white shadow-xl sm:p-6">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase">
          <Send className="w-4 h-4" />
          <span>Validation du chef d&apos;agence</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
          Demandes de virement
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl">
          Les contrôles et l&apos;exécution financière sont réalisés hors de {brand.bankName}{' '}
          par le personnel de la banque. Le chef d&apos;agence valide le dossier, puis
          confirme ici que le virement a effectivement été exécuté.
        </p>
      </header>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="relative max-w-sm mb-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="search"
            placeholder="Référence, bénéficiaire ou identifiant masqué"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs"
          />
        </div>

        <div className="grid min-w-0 gap-3 md:hidden">
          {filteredTransfers.map((transfer) => {
            const status = transfer.workflowStatus ?? 'submitted';
            return (
              <article key={transfer.id} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex min-w-0 flex-col gap-3 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-extrabold text-slate-900">
                      {transfer.recipientName}
                    </p>
                    <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
                      {transfer.recipientAccount}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold text-blue-700">
                    {formatDirectCurrency(transfer.amount, transfer.currency, 'fr')}
                  </p>
                </div>
                <div className="mt-3 min-w-0 rounded-xl bg-white p-2.5 text-[10px]">
                  <p className="text-slate-500">Référence / date</p>
                  <p className="mt-1 break-all font-mono font-bold text-slate-800">
                    {transfer.id}
                  </p>
                  <p className="mt-0.5 text-slate-500">{transfer.date}</p>
                </div>
                <span className={`mt-3 inline-flex max-w-full items-center gap-1 break-words rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusClass(status)}`}>
                  {status === 'external_settlement_confirmed' ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : (
                    <Clock className="h-3 w-3 shrink-0" />
                  )}
                  {STATUS_LABELS[status] ?? status}
                </span>
                <button type="button" onClick={() => openTransfer(transfer)} className="mt-4 min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">
                  Examiner
                </button>
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
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
                  {formatDirectCurrency(transfer.amount, transfer.currency, 'fr')}
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
        </div>
        {!filteredTransfers.length && (
          <p className="py-10 text-center text-sm text-slate-500">
            Aucune demande trouvée.
          </p>
        )}
      </section>

      {selected && (
        <Dialog open onClose={() => setSelected(null)} ariaLabelledBy="admin-transfer-dialog-title">
          <DialogBackdrop className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/70 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
          <DialogPanel className="max-h-dvh w-full min-w-0 max-w-xl space-y-5 overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-6">
            <header className="flex min-w-0 items-start justify-between gap-3 border-b pb-4">
              <div className="min-w-0">
                <h2 id="admin-transfer-dialog-title" className="break-words text-lg font-extrabold text-slate-900">
                  Virement {selected.id}
                </h2>
                <p className="text-xs text-slate-500">
                  {STATUS_LABELS[selected.workflowStatus ?? 'submitted']}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fermer" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </header>

            <div className="grid min-w-0 grid-cols-1 gap-3 text-xs min-[360px]:grid-cols-2">
              <div className="min-w-0 rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Bénéficiaire</p>
                <p className="break-words font-bold text-slate-900">{selected.recipientName}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Montant</p>
                <p className="font-bold text-slate-900">
                {formatDirectCurrency(selected.amount, selected.currency, 'fr')}
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">
                {error}
              </p>
            )}

            {['submitted', 'under_review'].includes(selected.workflowStatus ?? 'submitted') && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                  Validez chaque contrôle dans l&apos;ordre. Le quatrième contrôle débite
                  automatiquement le compte et clôture le virement.
                </div>
                <div className="space-y-2">
                  {checkDefinitions.map((check, index) => {
                    const status = selected.complianceChecks[{
                      dual_review: 'doubleValidation',
                      escalation: 'escalade',
                      compliance: 'controleConformite',
                      final_authorization: 'autorisationFinale',
                    }[check.kind] as keyof typeof selected.complianceChecks];
                    const previous = index === 0
                      ? undefined
                      : selected.complianceChecks[{
                          dual_review: 'doubleValidation',
                          escalation: 'escalade',
                          compliance: 'controleConformite',
                          final_authorization: 'autorisationFinale',
                        }[checkDefinitions[index - 1].kind] as keyof typeof selected.complianceChecks];
                    const enabled = status !== 'termine' && (index === 0 || previous === 'termine');
                    return (
                      <div key={check.kind} className="flex min-w-0 flex-col items-stretch gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900">{index + 1}. {check.label}</p>
                          <p className={`text-[11px] ${status === 'termine' ? 'text-emerald-600' : enabled ? 'text-indigo-600' : 'text-slate-500'}`}>
                            {checkStatusLabel(status)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isSubmitting || !enabled || !note.trim()}
                          onClick={() => void run(() => reviewTransferCheck(selected.id, check.kind, note.trim()))}
                          className={`min-h-11 w-full rounded-xl px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40 sm:w-auto ${check.kind === 'final_authorization' ? 'bg-emerald-600' : 'bg-blue-600'}`}
                        >
                          {check.kind === 'final_authorization' ? 'Confirmer définitivement' : 'Valider ce contrôle'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <label className="block text-xs font-bold">
                  Note du contrôle ou motif de refus
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="mt-1 w-full border rounded-xl p-3"
                    rows={3}
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isSubmitting || !note.trim()}
                    onClick={() =>
                      void run(() => rejectTransfer(selected.id, note.trim()))
                    }
                    className="min-h-11 w-full rounded-xl bg-rose-50 px-3 py-3 font-bold text-rose-700 disabled:opacity-50"
                  >
                    <XCircle className="inline w-4 h-4 mr-2" />
                    Refuser la demande
                  </button>
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
          </DialogPanel>
          </DialogBackdrop>
        </Dialog>
      )}
    </div>
  );
}
