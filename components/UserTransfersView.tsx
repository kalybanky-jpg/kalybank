'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { convertAnyAmount, formatDirectCurrency } from '@/lib/currency';
import { bankingMessages } from '@/lib/banking-i18n';
import { Clock, Search, Send } from 'lucide-react';
import { formatLocalizedDateTime, formatLocalizedPercent } from '@/lib/language';
import { useBranded } from '@/components/brand/BrandProvider';

export default function UserTransfersView() {
  const {
    language,
    currency,
    rates,
    pendingTransfers,
    accounts,
    setIsTransferModalOpen,
  } = useAppStore();
  const t = useBranded(bankingMessages[language]);
  const [searchQuery, setSearchQuery] = useState('');
  const displayMoney = (amount: number, sourceCurrency: string) =>
    formatDirectCurrency(
      convertAnyAmount(amount, sourceCurrency, currency, rates),
      currency,
      language,
    );

  const filtered = pendingTransfers.filter((transfer) => {
    const query = searchQuery.toLowerCase();
    return (
      transfer.recipientName.toLowerCase().includes(query) ||
      transfer.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-4 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="flex min-w-0 flex-col gap-4 rounded-3xl bg-slate-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
            <Send className="w-4 h-4" />
            <span>{t.transfers.eyebrow}</span>
          </div>
          <h1 className="mt-1 break-words text-xl font-extrabold sm:text-2xl">{t.transfers.title}</h1>
          <p className="mt-2 max-w-2xl break-words text-xs text-slate-300">{t.transfers.subtitle}</p>
        </div>
        <button
          type="button"
          disabled={!accounts.length}
          onClick={() => setIsTransferModalOpen(true)}
          className="w-full shrink-0 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold disabled:opacity-40 sm:w-auto"
        >
          {t.transfers.newTransfer}
        </button>
      </header>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="relative mb-5 w-full min-w-0 max-w-sm">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t.transfers.searchPlaceholder}
            className="w-full min-w-0 rounded-xl border bg-slate-50 py-2 pl-9 pr-3 text-xs"
          />
        </div>
        <div className="space-y-3">
          {filtered.map((transfer) => (
            <article key={transfer.id} className="min-w-0 rounded-2xl border p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-extrabold text-slate-900">{transfer.recipientName}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
                    {transfer.id} • {transfer.recipientAccount}
                  </p>
                </div>
                <div className="min-w-0 sm:text-right">
                  <p className="break-words font-extrabold text-blue-700">
                    {displayMoney(transfer.amount, transfer.currency)}
                  </p>
                  <p className="break-words text-[10px] text-slate-500">
                    {formatLocalizedDateTime(transfer.date, language)}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-slate-50 rounded-xl flex items-start gap-2">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">
                    {t.transfers.statuses[transfer.workflowStatus ?? 'submitted']}
                  </p>
                  <p className="mt-1 break-words text-[10px] text-slate-500">
                    {t.transfers.progress}: {formatLocalizedPercent(transfer.complianceProgress, language)}.{' '}
                    {t.transfers.progressHint}
                  </p>
                </div>
              </div>
            </article>
          ))}
          {!filtered.length && (
            <p className="py-10 text-center text-sm text-slate-500">
              {t.transfers.noTransfers}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
