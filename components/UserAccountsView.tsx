'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { convertAnyAmount, formatDirectCurrency } from '@/lib/currency';
import { accountNumberLabel, bankingMessages } from '@/lib/banking-i18n';
import { Clock, FileDown, WalletCards } from 'lucide-react';
import { formatLocalizedDateTime } from '@/lib/language';
import { accountTypeLabel, ledgerEntryLabel } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';

export default function UserAccountsView() {
  const {
    language,
    currency,
    rates,
    accounts,
    transactions,
    isMaskedBalance,
    setIsStatementsModalOpen,
  } = useAppStore();
  const t = useBranded(bankingMessages[language]);
  const displayMoney = (amount: number, sourceCurrency: string) =>
    formatDirectCurrency(
      convertAnyAmount(amount, sourceCurrency, currency, rates),
      currency,
      language,
    );

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-4 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="min-w-0 rounded-3xl bg-slate-900 p-4 text-white sm:p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <WalletCards className="w-4 h-4" />
          <span>{t.accounts.eyebrow}</span>
        </div>
        <h1 className="mt-1 break-words text-xl font-extrabold sm:text-2xl">{t.accounts.title}</h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl">
          {t.accounts.subtitle}
        </p>
      </header>

      <section className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        {accounts.map((account) => (
          <article key={account.id} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
            <p className="break-words text-sm font-extrabold text-slate-900">
              {accountTypeLabel(language, account.accountType)}
            </p>
            <p className="mt-2 break-words text-xl font-black text-slate-900 sm:text-2xl">
              {isMaskedBalance
                ? '••••••'
                : displayMoney(account.balance, account.currency)}
            </p>
            <p className="mt-2 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">
              {t.accounts.availableBalance}:{' '}
              <strong>
                {isMaskedBalance
                  ? '••••'
                  : displayMoney(
                      account.availableBalance ?? account.balance,
                      account.currency,
                    )}
              </strong>
            </p>
            <dl className="mt-4 space-y-3 border-t pt-4 text-[11px]">
              <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
                <dt className="text-slate-500">{t.accounts.accountStatus}</dt>
                <dd className="min-w-0 break-words font-bold text-emerald-700 sm:text-right">
                  {t.accounts.activeAccount}
                </dd>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
                <dt className="text-slate-500">{t.accounts.lastUpdate}</dt>
                <dd className="min-w-0 break-words font-bold text-slate-800 sm:text-right">
                  {account.asOf
                    ? formatLocalizedDateTime(account.asOf, language)
                    : t.common.unavailable}
                </dd>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
                <dt className="text-slate-500">{t.accounts.accountNumber}</dt>
                <dd className="min-w-0 break-all font-mono font-bold text-slate-800 sm:text-right">
                  {accountNumberLabel(
                    account.accountNumber,
                    t.accounts.accountNumberPending,
                  )}
                </dd>
              </div>
            </dl>
          </article>
        ))}
        {!accounts.length && (
          <p className="md:col-span-2 py-12 text-center text-sm text-slate-500 bg-white rounded-3xl border">
            {t.accounts.noAccounts}
          </p>
        )}
      </section>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="break-words font-extrabold text-slate-900">
              {t.accounts.recentTransactions}
            </h2>
            <p className="text-[11px] text-slate-500">{t.accounts.recentTransactionsHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsStatementsModalOpen(true)}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white sm:w-auto"
          >
            <FileDown className="w-4 h-4" />
            {t.accounts.downloadStatement}
          </button>
        </div>
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex min-w-0 justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <div className="min-w-0">
                <p className="break-words text-xs font-bold text-slate-900">
                  {ledgerEntryLabel(language, transaction.entryKind, transaction.metadata)}
                </p>
                <p className="break-words text-[10px] text-slate-500">
                  {formatLocalizedDateTime(transaction.date, language)}
                </p>
              </div>
              <Clock className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
          ))}
          {!transactions.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              {t.accounts.noTransactions}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
