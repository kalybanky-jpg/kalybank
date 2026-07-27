'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency } from '@/lib/currency';
import {
  FileText,
  Plus,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  Calculator,
  Calendar,
  Wallet,
  ChevronRight,
  ShieldCheck,
  Percent,
} from 'lucide-react';

export default function UserLoansView() {
  const {
    language,
    currency,
    rates,
    loans,
    setIsLoanModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  // Loan Calculator State
  const [simAmount, setSimAmount] = useState(25000);
  const [simMonths, setSimMonths] = useState(36);
  const simInterestRate = 3.9;

  // Monthly payment calculation formula: M = P * r * (1 + r)^n / ((1 + r)^n - 1)
  const monthlyRate = simInterestRate / 100 / 12;
  const simMonthlyPayment =
    (simAmount * monthlyRate * Math.pow(1 + monthlyRate, simMonths)) /
    (Math.pow(1 + monthlyRate, simMonths) - 1);
  const simTotalRepayment = simMonthlyPayment * simMonths;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-emerald-900/40">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>{t.loan}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Espace Crédits, Prêts & Simulates
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Suivez l&apos;avancement de vos demandes de financement ou simulez votre futur prêt immobilier / personnel en direct.
          </p>
        </div>

        <button
          onClick={() => setIsLoanModalOpen(true)}
          id="user-loans-apply-new-btn"
          className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.applyLoan}</span>
        </button>
      </div>

      {/* Grid: Active Loans List + Interactive Loan Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (lg:col-span-7): Active Loan Applications */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span>Vos Demandes de Prêt en Cours</span>
          </h2>

          {loans.map((loan) => (
            <div key={loan.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-extrabold border border-emerald-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{loan.motive || t.personalLoan}</h3>
                    <p className="text-xs text-slate-500">
                      Réf : <span className="font-mono font-bold text-slate-800">{loan.reference}</span> • Soumis le {loan.requestDate}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Étape {loan.currentStep}/5
                </span>
              </div>

              {/* Stepper Progress */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-900">
                  <span>Progression du Dossier</span>
                  <span className="text-emerald-600">
                    {loan.currentStep === 5 ? '100% - Fonds Débloqués' : `${loan.currentStep * 20}%`}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${loan.currentStep * 20}%` }}
                  />
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-2">
                <div>
                  <p className="text-slate-400 font-medium">Montant Demandé</p>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {formatCurrency(loan.requestedAmount, currency, rates, language)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Montant Approuvé</p>
                  <p className="font-extrabold text-emerald-600 text-sm">
                    {formatCurrency(loan.approvedAmount, currency, rates, language)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Durée</p>
                  <p className="font-extrabold text-slate-900 text-sm">{loan.durationMonths} Mois</p>
                </div>
              </div>

              {/* Disbursed Note */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 flex items-start space-x-3 text-xs text-emerald-900">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  {t.fundsDisbursementNotice}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column (lg:col-span-5): Interactive Loan Simulation Calculator */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center space-x-2.5 border-b pb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Simulateur de Crédit</h3>
              <p className="text-xs text-slate-500">Estimation immédiate sans engagement</p>
            </div>
          </div>

          {/* Amount Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-500">Montant Souhaité</span>
              <span className="text-blue-600 font-extrabold text-sm">
                {formatCurrency(simAmount, currency, rates, language)}
              </span>
            </div>
            <input
              type="range"
              min="2000"
              max="150000"
              step="1000"
              value={simAmount}
              onChange={(e) => setSimAmount(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>2 000 €</span>
              <span>150 000 €</span>
            </div>
          </div>

          {/* Duration Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-500">Durée du Remboursement</span>
              <span className="text-slate-900 font-extrabold text-sm">{simMonths} Mois ({Math.round(simMonths / 12)} Ans)</span>
            </div>
            <input
              type="range"
              min="12"
              max="120"
              step="6"
              value={simMonths}
              onChange={(e) => setSimMonths(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>12 Mois</span>
              <span>120 Mois</span>
            </div>
          </div>

          {/* Calculation Result Box */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-5 rounded-2xl text-white space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-xs text-slate-300 font-medium">Taux d&apos;intérêt fixe (TAEG)</span>
              <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {simInterestRate}%
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Mensualité Estimée</span>
              <p className="text-3xl font-extrabold text-white">
                {formatCurrency(simMonthlyPayment, currency, rates, language)} / mois
              </p>
            </div>

            <div className="flex justify-between text-xs text-slate-300 pt-2 border-t border-white/10 font-medium">
              <span>Montant total dû :</span>
              <strong className="text-white font-extrabold">
                {formatCurrency(simTotalRepayment, currency, rates, language)}
              </strong>
            </div>
          </div>

          <button
            onClick={() => setIsLoanModalOpen(true)}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
          >
            <span>Déposer ma demande avec cette simulation</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
