'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import type { BankAccount } from '@/lib/types';
import { Search, WalletCards, X } from 'lucide-react';

export default function AdminAccountsView() {
  const { language, accounts, updateAccountBalance } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [newAmount, setNewAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filtered = accounts.filter((account) => {
    const query = searchQuery.toLowerCase();
    return (
      account.name.toLowerCase().includes(query) ||
      account.iban.toLowerCase().includes(query)
    );
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    setError('');
    setIsSaving(true);
    try {
      await updateAccountBalance(selected.id, newAmount, reason.trim());
      setSelected(null);
      setReason('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Ajustement impossible.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <WalletCards className="w-4 h-4" />
          <span>Rapprochement interne</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">Positions financières Monalyz</h1>
        <p className="text-xs text-slate-300 mt-2 max-w-2xl">
          Ce registre ne contient aucun compte ni solde bancaire connecté. Chaque
          ajustement est une écriture interne datée, motivée et auditée.
        </p>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="relative max-w-sm mb-5">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Libellé ou référence masquée" className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[750px]">
            <thead>
              <tr className="border-b text-[10px] uppercase text-slate-500">
                <th className="pb-3 px-2">Position</th>
                <th className="pb-3 px-2">Référence externe</th>
                <th className="pb-3 px-2 text-right">Montant interne</th>
                <th className="pb-3 px-2">Daté au</th>
                <th className="pb-3 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {filtered.map((account) => (
                <tr key={account.id}>
                  <td className="py-4 px-2">
                    <p className="font-bold text-slate-900">{account.name}</p>
                    <p className="text-[10px] text-slate-500">{account.positionKind}</p>
                  </td>
                  <td className="py-4 px-2 font-mono text-slate-600">{account.iban}</td>
                  <td className="py-4 px-2 text-right font-extrabold">
                    {formatDirectCurrency(account.balance, account.currency, language)}
                  </td>
                  <td className="py-4 px-2 text-slate-600">
                    {account.asOf ? new Date(account.asOf).toLocaleString(language) : '—'}
                  </td>
                  <td className="py-4 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(account);
                        setNewAmount(account.balance);
                        setError('');
                      }}
                      className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold"
                    >
                      Rapprocher
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="py-10 text-center text-sm text-slate-500">Aucune position.</p>}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
            <header className="flex justify-between">
              <div>
                <h2 className="font-extrabold text-slate-900">Rapprochement manuel</h2>
                <p className="text-xs text-slate-500">{selected.name}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)}><X className="w-5 h-5" /></button>
            </header>
            {error && <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">{error}</p>}
            <label className="block text-xs font-bold">
              Nouveau montant interne ({selected.currency})
              <input type="number" min="0" step="0.01" required value={newAmount} onChange={(event) => setNewAmount(Number(event.target.value))} className="mt-1 w-full p-3 border rounded-xl" />
            </label>
            <label className="block text-xs font-bold">
              Motif et référence du justificatif externe
              <textarea required minLength={10} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full p-3 border rounded-xl" />
            </label>
            <p className="text-[11px] text-amber-800 bg-amber-50 p-3 rounded-xl">
              Cette action ne modifie aucun solde bancaire. Elle rapproche uniquement
              la position interne Monalyz.
            </p>
            <button disabled={isSaving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">
              {isSaving ? 'Enregistrement…' : 'Enregistrer l’écriture auditée'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
