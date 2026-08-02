'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import { accountNumberLabel, bankingMessages } from '@/lib/banking-i18n';
import { Clock, FileDown, WalletCards } from 'lucide-react';
import { formatLocalizedDateTime } from '@/lib/language';
import { accountTypeLabel, ledgerEntryLabel } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';

export default function UserAccountsView() {
  const {
    language,
    accounts,
    transactions,
    isMaskedBalance,
    setIsStatementsModalOpen,
  } = useAppStore();
  const t = useBranded(bankingMessages[language]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <WalletCards className="w-4 h-4" />
          <span>{t.accounts.eyebrow}</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">{t.accounts.title}</h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl">
          {t.accounts.subtitle}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((account) => (
          <article key={account.id} className="bg-white rounded-3xl border border-slate-200 p-6">
            <p className="text-sm font-extrabold text-slate-900">
              {accountTypeLabel(language, account.accountType)}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {isMaskedBalance
                ? '••••••'
                : formatDirectCurrency(account.balance, account.currency, language)}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {t.accounts.availableBalance}:{' '}
              <strong>
                {isMaskedBalance
                  ? '••••'
                  : formatDirectCurrency(
                      account.availableBalance ?? account.balance,
                      account.currency,
                      language,
                    )}
              </strong>
            </p>
            <dl className="mt-4 pt-4 border-t text-[11px] space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t.accounts.accountStatus}</dt>
                <dd className="font-bold text-emerald-700">{t.accounts.activeAccount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t.accounts.lastUpdate}</dt>
                <dd className="font-bold text-slate-800">
                  {account.asOf
                    ? formatLocalizedDateTime(account.asOf, language)
                    : t.common.unavailable}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t.accounts.accountNumber}</dt>
                <dd className="font-mono font-bold text-slate-800">
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

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-extrabold text-slate-900">{t.accounts.recentTransactions}</h2>
            <p className="text-[11px] text-slate-500">{t.accounts.recentTransactionsHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsStatementsModalOpen(true)}
            className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            {t.accounts.downloadStatement}
          </button>
        </div>
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="p-3 bg-slate-50 rounded-xl flex justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {ledgerEntryLabel(language, transaction.entryKind, transaction.metadata)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {formatLocalizedDateTime(transaction.date, language)}
                </p>
              </div>
              <Clock className="w-4 h-4 text-emerald-600" />
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
