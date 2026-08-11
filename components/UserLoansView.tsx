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
    <div className="mx-auto max-w-7xl min-w-0 space-y-4 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="flex min-w-0 flex-col gap-4 rounded-3xl bg-slate-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase">
            <FileText className="w-4 h-4" />
            <span>{t.loans.eyebrow}</span>
          </div>
          <h1 className="mt-1 break-words text-xl font-extrabold sm:text-2xl">{t.loans.title}</h1>
          <p className="mt-2 max-w-2xl break-words text-xs text-slate-300">{t.loans.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsLoanModalOpen(true)}
          className="w-full shrink-0 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold sm:w-auto"
        >
          {t.loans.newLoan}
        </button>
      </header>

      <section className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        {loans.map((loan) => (
          <article key={loan.id} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="break-all font-mono text-[10px] text-slate-500">{loan.reference}</p>
                <p className="mt-1 break-words font-extrabold text-slate-900">
                  {loanMotiveLabel(language, loan.motiveCode)}
                </p>
              </div>
              <p className="break-words font-extrabold text-indigo-700 sm:text-right">
                {displayMoney(loan.requestedAmount, loan.currency)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] text-slate-500">{t.loans.simulatedDuration}</p>
                <p className="break-words text-xs font-bold text-slate-900">
                  {formatLocalizedMonths(loan.durationMonths, language)}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] text-slate-500">{t.loans.indicativePayment}</p>
                <p className="break-words text-xs font-bold text-slate-900">
                  {displayMoney(loan.monthlyPayment, loan.currency)}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-indigo-50 rounded-xl flex gap-2">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-indigo-900">
                  {t.loans.statuses[loan.workflowStatus ?? 'submitted']}
                </p>
                <p className="mt-1 break-words text-[10px] text-indigo-700">
                  {t.loans.progress}: {formatLocalizedPercent(loan.complianceProgress, language)}. {t.loans.progressHint}
                </p>
              </div>
            </div>
          </article>
        ))}
        {!loans.length && (
          <div className="rounded-3xl border bg-white py-14 text-center md:col-span-2">
            <Calculator className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm text-slate-500">{t.loans.noLoans}</p>
          </div>
        )}
      </section>
    </div>
  );
}
