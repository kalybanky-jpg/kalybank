'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import { Calculator, Clock, FileText } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Demande enregistrée',
  under_review: 'Dossier en étude',
  approved_for_external_funding: 'Autorisé pour contractualisation/financement externe',
  external_funding_recorded: 'Versement externe déclaré, second contrôle requis',
  external_settlement_confirmed: 'Versement externe confirmé sur preuve',
  rejected: 'Demande rejetée',
  cancelled: 'Demande annulée',
  external_failed: 'Versement externe déclaré en échec',
};

export default function UserLoansView() {
  const { language, loans, setIsLoanModalOpen } = useAppStore();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase">
            <FileText className="w-4 h-4" />
            <span>Demandes de financement</span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">Dossiers et simulations</h1>
          <p className="text-xs text-slate-300 mt-2 max-w-2xl">
            Toute estimation est non contractuelle. KALY ne prête pas, ne débite pas
            et ne verse pas automatiquement de fonds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsLoanModalOpen(true)}
          className="px-4 py-3 bg-indigo-600 rounded-xl font-bold text-xs"
        >
          Nouvelle demande
        </button>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loans.map((loan) => (
          <article key={loan.id} className="bg-white rounded-3xl border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] text-slate-500">{loan.reference}</p>
                <p className="font-extrabold text-slate-900 mt-1">{loan.motive}</p>
              </div>
              <p className="font-extrabold text-indigo-700">
                {formatDirectCurrency(loan.requestedAmount, loan.currency, language)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-500">Durée simulée</p>
                <p className="text-xs font-bold text-slate-900">{loan.durationMonths} mois</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-500">Mensualité indicative</p>
                <p className="text-xs font-bold text-slate-900">
                  {formatDirectCurrency(loan.monthlyPayment, loan.currency, language)}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-indigo-50 rounded-xl flex gap-2">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-900">
                  {STATUS_LABELS[loan.workflowStatus ?? 'submitted']}
                </p>
                <p className="text-[10px] text-indigo-700 mt-1">
                  Contrôles internes : {loan.complianceProgress} %. Cette jauge
                  n&apos;indique ni approbation contractuelle ni versement bancaire.
                </p>
              </div>
            </div>
          </article>
        ))}
        {!loans.length && (
          <div className="lg:col-span-2 py-14 bg-white rounded-3xl border text-center">
            <Calculator className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm text-slate-500">Aucune demande enregistrée.</p>
          </div>
        )}
      </section>
    </div>
  );
}
