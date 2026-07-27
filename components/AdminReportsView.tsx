'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency } from '@/lib/currency';
import {
  PieChart,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  Building,
  ShieldCheck,
  Users,
} from 'lucide-react';

export default function AdminReportsView() {
  const {
    language,
    currency,
    rates,
    accounts,
    loans,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  const totalDeposits = accounts.reduce((acc, a) => acc + a.balance, 0);
  const totalLoansValue = loans.reduce((acc, l) => acc + l.requestedAmount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <PieChart className="w-4 h-4" />
            <span>Direction Financière & Risques</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Rapports Financiers & Analytiques
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Indicateurs clés de performance (KPIs), répartition des encours bancaires et analyse des risques de liquidité.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase">Encours Total Dépôts</p>
          <h3 className="text-2xl font-extrabold text-slate-900">
            {formatCurrency(totalDeposits, currency, rates, language)}
          </h3>
          <p className="text-[11px] font-bold text-emerald-600 flex items-center">
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +8.4% ce mois-ci
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase">Portefeuille Crédits</p>
          <h3 className="text-2xl font-extrabold text-indigo-600">
            {formatCurrency(totalLoansValue, currency, rates, language)}
          </h3>
          <p className="text-[11px] font-bold text-emerald-600 flex items-center">
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +12.1% en S2
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase">Taux de Rétention KYC</p>
          <h3 className="text-2xl font-extrabold text-emerald-600">98.2 %</h3>
          <p className="text-[11px] font-bold text-slate-500">Conformité optimale</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase">Flux SWIFT Quotidiens</p>
          <h3 className="text-2xl font-extrabold text-blue-600">
            {formatCurrency(485000, currency, rates, language)}
          </h3>
          <p className="text-[11px] font-bold text-emerald-600 flex items-center">
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> 100% exécutés sans incident
          </p>
        </div>
      </div>

      {/* Breakdown Graphs Representation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Répartition des Encours par Devise</h3>
          <div className="space-y-3">
            {[
              { name: 'Euro (EUR)', pct: 68, color: 'bg-blue-600' },
              { name: 'US Dollar (USD)', pct: 18, color: 'bg-indigo-600' },
              { name: 'British Pound (GBP)', pct: 8, color: 'bg-purple-600' },
              { name: 'Swiss Franc (CHF)', pct: 6, color: 'bg-emerald-600' },
            ].map((item) => (
              <div key={item.name} className="space-y-1 text-xs font-bold">
                <div className="flex justify-between text-slate-700">
                  <span>{item.name}</span>
                  <span>{item.pct}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Score de Risque de Défaut de Crédit</h3>
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700">Risque Bas (AAA / AA)</span>
              <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                84 % des dossiers
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700">Risque Modéré (BBB / BB)</span>
              <span className="font-extrabold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                14 % des dossiers
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700">Sous Surveillance Spéciale</span>
              <span className="font-extrabold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                2 % des dossiers
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
