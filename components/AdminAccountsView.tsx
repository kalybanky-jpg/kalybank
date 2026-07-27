'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency, formatDirectCurrency } from '@/lib/currency';
import { BankAccount } from '@/lib/types';
import {
  CreditCard,
  Building2,
  PiggyBank,
  Search,
  Lock,
  Unlock,
  PlusCircle,
  MinusCircle,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';

export default function AdminAccountsView() {
  const {
    language,
    currency,
    rates,
    accounts,
    updateAccountBalance,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const [searchQuery, setSearchQuery] = useState('');
  const [frozenAccounts, setFrozenAccounts] = useState<Record<string, boolean>>({});
  const [adjustModalAccount, setAdjustModalAccount] = useState<BankAccount | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustAmount, setAdjustAmount] = useState<number>(500);
  const [adjustReason, setAdjustReason] = useState('Ajustement comptable de régularisation');

  const toggleFreeze = (accId: string) => {
    setFrozenAccounts((prev) => ({ ...prev, [accId]: !prev[accId] }));
  };

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalAccount) return;

    const delta = adjustType === 'add' ? adjustAmount : -adjustAmount;
    const newBal = Math.max(0, adjustModalAccount.balance + delta);

    updateAccountBalance(adjustModalAccount.id, newBal);

    alert(`Ajustement de ${adjustAmount} € appliqué au compte ${adjustModalAccount.iban}.`);
    setAdjustModalAccount(null);
  };

  const filteredAccounts = accounts.filter((acc) =>
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.iban.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Gestion de la Tenue de Comptes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Registre des Comptes & IBANs Clients
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Inspectez la totalité des comptes de la banque, ajustez les soldes pour régularisation ou gels administratifs.
          </p>
        </div>
      </div>

      {/* Main Content Box */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Registre Actif ({accounts.length} Comptes)</h2>
              <p className="text-xs text-slate-500">Comptes courants et livrets d&apos;épargne</p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Chercher par IBAN ou nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Accounts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Intitulé Compte</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">IBAN & BIC</th>
                <th className="py-3 px-3">Solde Actuel</th>
                <th className="py-3 px-3">Statut</th>
                <th className="py-3 px-3 text-right">Actions Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredAccounts.map((acc) => {
                const isFrozen = !!frozenAccounts[acc.id];
                return (
                  <tr key={acc.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-bold flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        {acc.type === 'courant' ? <Building2 className="w-4 h-4" /> : <PiggyBank className="w-4 h-4" />}
                      </div>
                      <span className="font-extrabold text-slate-900">{acc.name}</span>
                    </td>
                    <td className="py-3 px-3 uppercase text-[10px] font-bold text-slate-500">
                      {acc.type}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[11px] text-slate-800">
                      {acc.iban}
                    </td>
                    <td className="py-3 px-3 font-extrabold text-slate-900 text-sm">
                      {formatDirectCurrency(acc.balance, acc.currency, language)}
                    </td>
                    <td className="py-3 px-3">
                      {isFrozen ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                          <Lock className="w-3 h-3 mr-1" />
                          Gelé
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Unlock className="w-3 h-3 mr-1" />
                          Actif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setAdjustModalAccount(acc)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-blue-600 font-bold text-[11px] flex items-center space-x-1 transition"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Ajuster</span>
                        </button>

                        <button
                          onClick={() => toggleFreeze(acc.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center space-x-1 transition ${
                            isFrozen
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {isFrozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          <span>{isFrozen ? 'Dégeler' : 'Geler'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Balance Adjustment Modal */}
      {adjustModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6 relative">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm">
                  ±
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Ajustement de Solde Compte</h3>
                  <p className="text-xs text-slate-500">{adjustModalAccount.iban}</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalAccount(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Type d&apos;Opération Comptable</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2.5 rounded-xl font-extrabold text-xs border transition ${
                      adjustType === 'add' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    + Créditer le solde
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-2.5 rounded-xl font-extrabold text-xs border transition ${
                      adjustType === 'deduct' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    - Débiter le solde
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Montant (€)</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-extrabold text-sm text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motif Audit Réglementaire</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setAdjustModalAccount(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition"
                >
                  Appliquer l&apos;Ajustement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
