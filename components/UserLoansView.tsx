'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { convertAnyAmount, formatDirectCurrency } from '@/lib/currency';
import { bankingMessages } from '@/lib/banking-i18n';
import { Calculator, Clock, FileText } from 'lucide-react';
import { formatLocalizedMonths, formatLocalizedPercent } from '@/lib/language';
import { loanMotiveLabel } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';

export default function UserLoansView() {
  const { language, currency, rates, loans, setIsLoanModalOpen } = useAppStore();
  const t = useBranded(bankingMessages[language]);
  const displayMoney = (amount: number, sourceCurrency: string) =>
    formatDirectCurrency(
      convertAnyAmount(amount, sourceCurrency, currency, rates),
      currency,
      language,
    );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase">
            <FileText className="w-4 h-4" />
            <span>{t.loans.eyebrow}</span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">{t.loans.title}</h1>
          <p className="text-xs text-slate-300 mt-2 max-w-2xl">{t.loans.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsLoanModalOpen(true)}
          className="px-4 py-3 bg-indigo-600 rounded-xl font-bold text-xs"
        >
          {t.loans.newLoan}
        </button>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loans.map((loan) => (
          <article key={loan.id} className="bg-white rounded-3xl border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] text-slate-500">{loan.reference}</p>
                <p className="font-extrabold text-slate-900 mt-1">
                  {loanMotiveLabel(language, loan.motiveCode)}
                </p>
              </div>
              <p className="font-extrabold text-indigo-700">
                {displayMoney(loan.requestedAmount, loan.currency)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-500">{t.loans.simulatedDuration}</p>
                <p className="text-xs font-bold text-slate-900">
                  {formatLocalizedMonths(loan.durationMonths, language)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-500">{t.loans.indicativePayment}</p>
                <p className="text-xs font-bold text-slate-900">
                  {displayMoney(loan.monthlyPayment, loan.currency)}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-indigo-50 rounded-xl flex gap-2">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-900">
                  {t.loans.statuses[loan.workflowStatus ?? 'submitted']}
                </p>
                <p className="text-[10px] text-indigo-700 mt-1">
                  {t.loans.progress}: {formatLocalizedPercent(loan.complianceProgress, language)}. {t.loans.progressHint}
                </p>
              </div>
            </div>
          </article>
        ))}
        {!loans.length && (
          <div className="lg:col-span-2 py-14 bg-white rounded-3xl border text-center">
            <Calculator className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm text-slate-500">{t.loans.noLoans}</p>
          </div>
        )}
      </section>
    </div>
  );
}
