'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import type { LoanApplication } from '@/lib/types';
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

type CheckKey =
  | 'doubleValidation'
  | 'escalade'
  | 'controleConformite'
  | 'autorisationFinale';

const CHECKS: { key: CheckKey; label: string }[] = [
  { key: 'doubleValidation', label: 'Double revue' },
  { key: 'escalade', label: 'Escalade si nécessaire' },
  { key: 'controleConformite', label: 'Contrôle conformité' },
  { key: 'autorisationFinale', label: 'Autorisation finale' },
];

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Demande enregistrée',
  under_review: 'En étude',
  approved_for_external_funding: 'Autorisée pour financement externe',
  external_funding_recorded: 'Versement externe déclaré',
  external_settlement_confirmed: 'Versement externe confirmé',
  rejected: 'Rejetée',
  cancelled: 'Annulée',
  external_failed: 'Versement externe en échec',
};

export default function AdminLoansView() {
  const {
    language,
    loans,
    updateLoanComplianceCheck,
    rejectLoan,
    recordLoanExternalFunding,
    confirmLoanExternalSettlement,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<LoanApplication | null>(null);
  const [externalReference, setExternalReference] = useState('');
  const [executedAt, setExecutedAt] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredLoans = loans.filter((loan) => {
    const query = searchQuery.toLowerCase();
    return (
      loan.clientName.toLowerCase().includes(query) ||
      loan.reference.toLowerCase().includes(query)
    );
  });

  const run = async (operation: () => Promise<void>) => {
    setError('');
    setIsSubmitting(true);
    try {
      await operation();
      setSelected(null);
      setExternalReference('');
      setExecutedAt('');
      setEvidenceFile(null);
      setNote('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Action impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordFunding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !evidenceFile || !externalReference.trim() || !executedAt) {
      setError('Référence, date de versement et justificatif sont obligatoires.');
      return;
    }
    await run(() =>
      recordLoanExternalFunding(
        selected.id,
        externalReference,
        evidenceFile,
        executedAt,
        note,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase">
          <FileText className="w-4 h-4" />
          <span>Étude et preuves externes</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
          Suivi des demandes de financement
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl">
          La simulation est indicative. Toute contractualisation et tout versement
          financier ont lieu hors de KALY, puis sont documentés manuellement.
        </p>
      </header>

      <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="relative max-w-sm mb-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="search"
            placeholder="Référence ou demandeur"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[850px]">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-3 px-2">Date / référence</th>
                <th className="pb-3 px-2">Demandeur</th>
                <th className="pb-3 px-2 text-right">Montant demandé</th>
                <th className="pb-3 px-2">État probant</th>
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
                      <p className="font-mono text-[10px] text-slate-500">{loan.reference}</p>
                    </td>
                    <td className="py-4 px-2">
                      <p className="font-bold text-slate-900">{loan.clientName}</p>
                      <p className="text-[10px] text-slate-500">{loan.clientEmail}</p>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <p className="font-extrabold text-indigo-700">
                        {formatDirectCurrency(loan.requestedAmount, loan.currency, language)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Simulation : {loan.durationMonths} mois
                      </p>
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          status === 'external_settlement_confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ['rejected', 'cancelled', 'external_failed'].includes(status)
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {status === 'external_settlement_confirmed' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(loan);
                          setError('');
                        }}
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
          {!filteredLoans.length && (
            <p className="text-center py-10 text-sm text-slate-500">Aucune demande trouvée.</p>
          )}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <section className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-6 my-auto">
            <header className="flex justify-between items-start border-b pb-4">
              <div>
                <h2 className="font-extrabold text-lg text-slate-900">
                  Dossier {selected.reference}
                </h2>
                <p className="text-xs text-slate-500">
                  {STATUS_LABELS[selected.workflowStatus ?? 'submitted']}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fermer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </header>

            {error && (
              <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">
                {error}
              </p>
            )}

            {['submitted', 'under_review'].includes(selected.workflowStatus ?? 'submitted') && (
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-3">
                  Contrôles du dossier
                </h3>
                <div className="space-y-2">
                  {CHECKS.map((check) => (
                    <div key={check.key} className="flex items-center justify-between border rounded-xl p-3">
                      <span className="text-xs font-bold text-slate-700">{check.label}</span>
                      <div className="flex gap-1">
                        {[
                          ['en_attente', 'À faire'],
                          ['en_cours', 'En cours'],
                          ['termine', 'Terminé'],
                        ].map(([state, label]) => (
                          <button
                            key={state}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() =>
                              void run(() =>
                                updateLoanComplianceCheck(
                                  selected.id,
                                  check.key,
                                  state as 'en_attente' | 'en_cours' | 'termine',
                                ),
                              )
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                              selected.complianceChecks[check.key] === state
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    const reason = window.prompt('Motif détaillé du rejet :')?.trim();
                    if (reason) void run(() => rejectLoan(selected.id, reason));
                  }}
                  className="mt-4 px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold"
                >
                  Rejeter la demande
                </button>
              </div>
            )}

            {selected.workflowStatus === 'approved_for_external_funding' && (
              <form onSubmit={handleRecordFunding} className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  L&apos;autorisation interne n&apos;est pas un contrat et ne prouve aucun
                  versement. Enregistrez uniquement un financement exécuté hors de KALY.
                </div>
                <label className="block text-xs font-bold">
                  Référence externe
                  <input required value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="mt-1 w-full border rounded-xl p-3" />
                </label>
                <label className="block text-xs font-bold">
                  Date et heure du versement externe
                  <input type="datetime-local" required value={executedAt} onChange={(event) => setExecutedAt(event.target.value)} className="mt-1 w-full border rounded-xl p-3" />
                </label>
                <label className="block text-xs font-bold">
                  Justificatif
                  <input type="file" required accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)} className="mt-1 w-full border rounded-xl p-3" />
                </label>
                <label className="block text-xs font-bold">
                  Note opérateur
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full border rounded-xl p-3" />
                </label>
                <button disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
                  <FileCheck2 className="inline w-4 h-4 mr-2" />
                  Enregistrer la preuve de versement externe
                </button>
              </form>
            )}

            {selected.workflowStatus === 'external_funding_recorded' && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                  Un superviseur différent de l&apos;opérateur déclarant doit rapprocher
                  la preuve et confirmer le règlement.
                </div>
                <label className="block text-xs font-bold">
                  Note de rapprochement
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full border rounded-xl p-3" />
                </label>
                <button
                  type="button"
                  disabled={isSubmitting || !note.trim()}
                  onClick={() =>
                    void run(() => confirmLoanExternalSettlement(selected.id, note.trim()))
                  }
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  <ShieldCheck className="inline w-4 h-4 mr-2" />
                  Confirmer le règlement externe
                </button>
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
                Ce dossier est terminal et conservé dans le journal d&apos;audit.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
