'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import { Clock, FileDown, WalletCards } from 'lucide-react';

export default function UserAccountsView() {
  const {
    language,
    accounts,
    transactions,
    isMaskedBalance,
    setIsStatementsModalOpen,
  } = useAppStore();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <WalletCards className="w-4 h-4" />
          <span>Registre interne</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">Positions financières déclarées</h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl">
          Ces positions ne sont pas des comptes bancaires et ne proviennent
          d&apos;aucune API bancaire. Leur date de rapprochement est affichée explicitement.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((account) => (
          <article key={account.id} className="bg-white rounded-3xl border border-slate-200 p-6">
            <p className="text-sm font-extrabold text-slate-900">{account.name}</p>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {isMaskedBalance
                ? '••••••'
                : formatDirectCurrency(account.balance, account.currency, language)}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Disponible après réservations internes :{' '}
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
                <dt className="text-slate-500">Nature</dt>
                <dd className="font-bold text-slate-800">
                  {account.positionKind === 'internally_reconciled'
                    ? 'Rapprochée manuellement'
                    : 'Déclarée'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Date de valeur interne</dt>
                <dd className="font-bold text-slate-800">
                  {account.asOf
                    ? new Date(account.asOf).toLocaleString(language)
                    : 'Non renseignée'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Référence externe masquée</dt>
                <dd className="font-mono font-bold text-slate-800">{account.iban}</dd>
              </div>
            </dl>
          </article>
        ))}
        {!accounts.length && (
          <p className="md:col-span-2 py-12 text-center text-sm text-slate-500 bg-white rounded-3xl border">
            Aucune position interne n&apos;a été enregistrée.
          </p>
        )}
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-extrabold text-slate-900">Événements financiers confirmés</h2>
            <p className="text-[11px] text-slate-500">
              Uniquement les règlements externes confirmés sur preuve
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsStatementsModalOpen(true)}
            className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Exporter le registre
          </button>
        </div>
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="p-3 bg-slate-50 rounded-xl flex justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900">{transaction.title}</p>
                <p className="text-[10px] text-slate-500">{transaction.date}</p>
              </div>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
          ))}
          {!transactions.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              Aucun règlement externe confirmé.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
