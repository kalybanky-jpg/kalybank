'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency } from '@/lib/currency';
import { LoanApplication } from '@/lib/types';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function AdminLoansView() {
  const {
    language,
    currency,
    rates,
    loans,
    advanceLoanStep,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  const [statusFilter, setStatusFilter] = useState<'tous' | 'en_cours' | 'valide' | 'refuse'>('tous');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLoans = loans.filter((loan) => {
    const matchesStatus =
      statusFilter === 'tous' ||
      (statusFilter === 'en_cours' && loan.currentStep < 5 && loan.status !== 'refuse') ||
      (statusFilter === 'valide' && loan.currentStep === 5) ||
      (statusFilter === 'refuse' && loan.status === 'refuse');

    const matchesSearch =
      loan.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.reference.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Historique & Audit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Historique des Demandes de Prêt
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Consultez le registre complet des demandes de crédit par initiateur, suivez leur progression et validez les étapes.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setStatusFilter('tous')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === 'tous' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tous ({loans.length})
            </button>
            <button
              onClick={() => setStatusFilter('en_cours')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === 'en_cours' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              En cours
            </button>
            <button
              onClick={() => setStatusFilter('valide')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === 'valide' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Validés / Décaissés
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Rechercher client ou réf..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-3 font-bold px-2">Date / Réf</th>
                <th className="pb-3 font-bold px-2">Initiateur (Client)</th>
                <th className="pb-3 font-bold px-2 text-right">Montant Demandé</th>
                <th className="pb-3 font-bold px-2 text-right">Conditions</th>
                <th className="pb-3 font-bold px-2 text-center">Progression</th>
                <th className="pb-3 font-bold px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {filteredLoans.map((loan) => (
                <tr key={loan.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition group">
                  <td className="py-4 px-2 align-middle">
                    <p className="font-bold text-slate-900">{loan.requestDate}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{loan.reference}</p>
                  </td>
                  <td className="py-4 px-2 align-middle">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-sm shrink-0">
                        {loan.clientName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{loan.clientName}</p>
                        <p className="text-[10px] text-slate-500">{loan.clientEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2 align-middle text-right">
                    <p className="font-extrabold text-slate-900">
                      {formatCurrency(loan.requestedAmount, currency, rates, language)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Approuvé: <span className="text-emerald-600 font-bold">{formatCurrency(loan.approvedAmount, currency, rates, language)}</span>
                    </p>
                  </td>
                  <td className="py-4 px-2 align-middle text-right">
                    <p className="font-bold text-slate-800">{loan.durationMonths} mois</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      ~{formatCurrency(loan.monthlyPayment || 450, currency, rates, language)}/m
                    </p>
                  </td>
                  <td className="py-4 px-2 align-middle text-center">
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      {loan.currentStep === 5 ? (
                        <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Décaissé
                        </span>
                      ) : loan.status === 'refuse' ? (
                        <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 flex items-center">
                          <XCircle className="w-3 h-3 mr-1" />
                          Refusé
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 flex items-center">
                          <Clock className="w-3 h-3 mr-1 animate-pulse" />
                          Étape {loan.currentStep}/5
                        </span>
                      )}
                      {loan.currentStep < 5 && loan.status !== 'refuse' && (
                        <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full transition-all" style={{ width: `${loan.currentStep * 20}%` }} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-2 align-middle text-right">
                    {loan.currentStep < 5 && loan.status !== 'refuse' ? (
                      <button
                        onClick={() => {
                          if (window.confirm(`Valider l'étape ${loan.currentStep} vers l'étape ${loan.currentStep + 1} ?`)) {
                            advanceLoanStep(loan.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow-sm transition inline-flex items-center space-x-1"
                      >
                        <span>Valider Étape {loan.currentStep}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">Dossier clos</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                    Aucune demande de prêt trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
