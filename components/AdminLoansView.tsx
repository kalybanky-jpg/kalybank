'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import type { LoanApplication } from '@/lib/types';
import {
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useBrand } from '@/components/brand/BrandProvider';
import { Dialog, DialogBackdrop, DialogPanel } from '@/components/ui/Dialog';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'À approuver',
  under_review: 'À approuver',
  approved_for_external_funding: 'Approuvé — à décaisser',
  external_funding_recorded: 'Approuvé — décaissement à enregistrer',
  external_settlement_confirmed: 'Prêt décaissé',
  rejected: 'Refusé',
  cancelled: 'Annulé',
  external_failed: 'Échec déclaré',
};

export default function AdminLoansView() {
  const { brand } = useBrand();
  const {
    accounts,
    loans,
    approveLoan,
    disburseLoan,
    rejectLoan,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<LoanApplication | null>(null);
  const [destinationPositionId, setDestinationPositionId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredLoans = loans.filter((loan) => {
    const query = searchQuery.toLowerCase();
    return (
      loan.clientName.toLowerCase().includes(query) ||
      loan.clientEmail.toLowerCase().includes(query) ||
      loan.reference.toLowerCase().includes(query)
    );
  });

  const eligibleAccounts = selected
    ? accounts.filter(
        (account) =>
          account.ownerId === selected.ownerId &&
          account.type === 'courant' &&
          account.currency === selected.currency,
      )
    : [];

  const openLoan = (loan: LoanApplication) => {
    setSelected(loan);
    setDestinationPositionId('');
    setNote('');
    setError('');
  };

  const run = async (operation: () => Promise<void>) => {
    setError('');
    setIsSubmitting(true);
    try {
      await operation();
      setSelected(null);
      setDestinationPositionId('');
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
    <div className="min-w-0 space-y-6">
      <header className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-4 text-white shadow-xl sm:p-6">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase">
          <FileText className="w-4 h-4" />
          <span>Approbation simple</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
          Demandes de prêt
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl">
          Une seule décision approuve la demande. Le décaissement reste une action
          distincte : il crédite ensuite la position courante de l&apos;utilisateur dans{' '}
          {brand.bankName}.
        </p>
      </header>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="relative max-w-sm mb-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="search"
            placeholder="Référence, nom ou e-mail"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs"
          />
        </div>

        <div className="grid min-w-0 gap-3 md:hidden">
          {filteredLoans.map((loan) => {
            const status = loan.workflowStatus ?? 'submitted';
            return (
              <article
                key={loan.id}
                className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex min-w-0 flex-col gap-3 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900">
                      {loan.clientName}
                    </p>
                    <p className="mt-1 break-all text-[10px] text-slate-500">
                      {loan.clientEmail}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold text-indigo-700">
                    {formatDirectCurrency(loan.requestedAmount, loan.currency, 'fr')}
                  </p>
                </div>
                <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-[10px] min-[360px]:grid-cols-2">
                  <div className="min-w-0 rounded-xl bg-white p-2.5">
                    <dt className="text-slate-500">Référence / date</dt>
                    <dd className="mt-1 break-all font-mono font-bold text-slate-800">
                      {loan.reference}
                    </dd>
                    <dd className="mt-0.5 text-slate-500">{loan.requestDate}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl bg-white p-2.5">
                    <dt className="text-slate-500">Simulation</dt>
                    <dd className="mt-1 font-bold text-slate-800">
                      {loan.durationMonths} mois
                    </dd>
                  </div>
                </dl>
                <span
                  className={`mt-3 inline-flex max-w-full items-center gap-1 break-words rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusClass(status)}`}
                >
                  {status === 'external_settlement_confirmed' ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : (
                    <Clock className="h-3 w-3 shrink-0" />
                  )}
                  {STATUS_LABELS[status] ?? status}
                </span>
                <button
                  type="button"
                  onClick={() => openLoan(loan)}
                  className="mt-4 min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"
                >
                  Ouvrir
                </button>
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left min-w-[820px]">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-3 px-2">Date / référence</th>
                <th className="pb-3 px-2">Demandeur</th>
                <th className="pb-3 px-2 text-right">Montant</th>
                <th className="pb-3 px-2">Statut</th>
                <th className="pb-3 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredLoans.map((loan) => {
                const status = loan.workflowStatus ?? 'submitted';
                return (
                  <tr key={loan.id} className="hover:bg-slate-50">
                    <td className="py-4 px-2">
                      <p className="font-bold text-slate-900">{loan.requestDate}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {loan.reference}
                      </p>
                    </td>
                    <td className="py-4 px-2">
                      <p className="font-bold text-slate-900">{loan.clientName}</p>
                      <p className="text-[10px] text-slate-500">{loan.clientEmail}</p>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <p className="font-extrabold text-indigo-700">
                        {formatDirectCurrency(
                          loan.requestedAmount,
                          loan.currency,
                          'fr',
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Simulation : {loan.durationMonths} mois
                      </p>
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
                        onClick={() => openLoan(loan)}
                        className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold text-[11px]"
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filteredLoans.length && (
          <p className="py-10 text-center text-sm text-slate-500">
            Aucune demande trouvée.
          </p>
        )}
      </section>

      {selected && (
        <Dialog
          open
          onClose={() => setSelected(null)}
          ariaLabelledBy="admin-loan-dialog-title"
        >
          <DialogBackdrop className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/70 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
          <DialogPanel className="max-h-dvh w-full min-w-0 max-w-xl space-y-5 overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-6">
            <header className="flex min-w-0 items-start justify-between gap-3 border-b pb-4">
              <div className="min-w-0">
                <h2 id="admin-loan-dialog-title" className="break-words text-lg font-extrabold text-slate-900">
                  Dossier {selected.reference}
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
                <p className="text-slate-500">Demandeur</p>
                <p className="break-all font-bold text-slate-900">{selected.clientEmail}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Montant demandé</p>
                <p className="font-bold text-slate-900">
                  {formatDirectCurrency(
                    selected.requestedAmount,
                    selected.currency,
                          'fr',
                  )}
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
                  Cette action approuve immédiatement la demande. Elle ne déclenche
                  aucun décaissement : le crédit du compte reste une action séparée.
                </div>
                <label className="block text-xs font-bold">
                  Note interne facultative, ou motif de refus
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
                    disabled={isSubmitting}
                    onClick={() => void run(() => approveLoan(selected.id, note.trim()))}
                    className="min-h-11 w-full rounded-xl bg-indigo-600 px-3 py-3 font-bold text-white disabled:opacity-50"
                  >
                    <ShieldCheck className="inline w-4 h-4 mr-2" />
                    Approuver le prêt
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !note.trim()}
                    onClick={() => void run(() => rejectLoan(selected.id, note.trim()))}
                    className="min-h-11 w-full rounded-xl bg-rose-50 px-3 py-3 font-bold text-rose-700 disabled:opacity-50"
                  >
                    <XCircle className="inline w-4 h-4 mr-2" />
                    Refuser la demande
                  </button>
                </div>
              </div>
            )}

            {[
              'approved_for_external_funding',
              'external_funding_recorded',
            ].includes(selected.workflowStatus ?? '') && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  Enregistrez le décaissement uniquement après qu&apos;il a été
                  effectué en interne par le personnel compétent. Cette action crédite
                  immédiatement la position courante sélectionnée et finalise le dossier.
                </div>
                <label className="block text-xs font-bold">
                  Compte courant à créditer
                  <span className="relative block mt-1">
                    <Landmark className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                    <select
                      required
                      value={destinationPositionId}
                      onChange={(event) => setDestinationPositionId(event.target.value)}
                      className="w-full border rounded-xl py-3 pl-10 pr-3 bg-white"
                    >
                      <option value="">Sélectionner un compte courant</option>
                      {eligibleAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} — {account.currency} — {account.iban}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                {!eligibleAccounts.length && (
                  <p className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">
                    Aucun compte courant de même devise n&apos;est disponible pour cet
                    utilisateur. Le décaissement ne peut pas être enregistré.
                  </p>
                )}
                <label className="block text-xs font-bold">
                  Note de décaissement obligatoire
                  <textarea
                    required
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="mt-1 w-full border rounded-xl p-3"
                    rows={3}
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      isSubmitting || !destinationPositionId || !note.trim()
                    }
                    onClick={() =>
                      void run(() =>
                        disburseLoan(
                          selected.id,
                          destinationPositionId,
                          note.trim(),
                        ),
                      )
                    }
                    className="min-h-11 w-full rounded-xl bg-emerald-600 px-3 py-3 font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="inline w-4 h-4 mr-2" />
                    Décaisser et créditer
                  </button>
                  {selected.workflowStatus === 'approved_for_external_funding' && (
                    <button
                      type="button"
                      disabled={isSubmitting || !note.trim()}
                      onClick={() =>
                        void run(() => rejectLoan(selected.id, note.trim()))
                      }
                      className="min-h-11 w-full rounded-xl bg-rose-50 px-3 py-3 font-bold text-rose-700 disabled:opacity-50"
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
                {selected.workflowStatus === 'external_settlement_confirmed'
                  ? `Le prêt a été décaissé sur ${selected.disbursementAccount}.`
                  : 'Ce dossier est finalisé et conservé dans le journal d’audit.'}
              </div>
            )}
          </DialogPanel>
          </DialogBackdrop>
        </Dialog>
      )}
    </div>
  );
}
