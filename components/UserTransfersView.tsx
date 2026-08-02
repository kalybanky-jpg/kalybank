'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import { bankingMessages } from '@/lib/banking-i18n';
import { Clock, Search, Send } from 'lucide-react';
import { formatLocalizedDateTime, formatLocalizedPercent } from '@/lib/language';
import { useBranded } from '@/components/brand/BrandProvider';

export default function UserTransfersView() {
  const {
    language,
    pendingTransfers,
    accounts,
    setIsTransferModalOpen,
  } = useAppStore();
  const t = useBranded(bankingMessages[language]);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = pendingTransfers.filter((transfer) => {
    const query = searchQuery.toLowerCase();
    return (
      transfer.recipientName.toLowerCase().includes(query) ||
      transfer.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
            <Send className="w-4 h-4" />
            <span>{t.transfers.eyebrow}</span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">{t.transfers.title}</h1>
          <p className="text-xs text-slate-300 mt-2 max-w-2xl">{t.transfers.subtitle}</p>
        </div>
        <button
          type="button"
          disabled={!accounts.length}
          onClick={() => setIsTransferModalOpen(true)}
          className="px-4 py-3 bg-blue-600 rounded-xl font-bold text-xs disabled:opacity-40"
        >
          {t.transfers.newTransfer}
        </button>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="relative max-w-sm mb-5">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t.transfers.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border rounded-xl text-xs"
          />
        </div>
        <div className="space-y-3">
          {filtered.map((transfer) => (
            <article key={transfer.id} className="border rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-slate-900">{transfer.recipientName}</p>
                  <p className="font-mono text-[10px] text-slate-500 mt-1">
                    {transfer.id} • {transfer.recipientAccount}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="font-extrabold text-blue-700">
                    {formatDirectCurrency(transfer.amount, transfer.currency, language)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatLocalizedDateTime(transfer.date, language)}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-slate-50 rounded-xl flex items-start gap-2">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {t.transfers.statuses[transfer.workflowStatus ?? 'submitted']}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
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
