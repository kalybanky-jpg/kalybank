'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency, formatDirectCurrency, convertAnyAmount } from '@/lib/currency';
import {
  CreditCard,
  Building2,
  PiggyBank,
  Copy,
  Check,
  Download,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  ShieldCheck,
  ExternalLink,
  Info,
} from 'lucide-react';
import { motion } from 'motion/react';

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

  const t = translations[language] || translations.fr;
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || 'acc_1');
  const [copiedIban, setCopiedIban] = useState<string | null>(null);
  const [searchTx, setSearchTx] = useState('');
  const [showRibModal, setShowRibModal] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const handleCopy = (iban: string) => {
    navigator.clipboard.writeText(iban.replace(/\s+/g, ''));
    setCopiedIban(iban);
    setTimeout(() => setCopiedIban(null), 2000);
  };

  const filteredTransactions = transactions.filter((tx) => {
    return (
      tx.title.toLowerCase().includes(searchTx.toLowerCase()) ||
      tx.amount.toString().includes(searchTx)
    );
  });

  const handleDownloadRib = () => {
    setShowRibModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-blue-800/40">
        <div>
          <div className="flex items-center space-x-2 text-blue-300 text-xs font-bold uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>{t.myAccounts}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Gestion des Comptes & IBAN
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Consultez les détails de vos comptes bancaires, téléchargez vos RIB officiels et suivez l&apos;historique de vos opérations.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setIsStatementsModalOpen(true)}
            id="user-accounts-statements-btn"
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center space-x-2 backdrop-blur-md transition border border-white/10 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Relevé officiel</span>
          </button>
          <button
            onClick={() => alert(language === 'fr' ? 'Demande d\'ouverture de sous-compte transmise au conseiller.' : 'Sub-account request submitted to advisor.')}
            id="user-accounts-open-subaccount-btn"
            className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau sous-compte</span>
          </button>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((acc) => {
          const isSelected = acc.id === selectedAccountId;
          const isCourant = acc.type === 'courant';

          return (
            <motion.div
              key={acc.id}
              whileHover={{ scale: 1.01 }}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`rounded-3xl p-6 cursor-pointer transition-all border shadow-sm relative overflow-hidden ${
                isSelected
                  ? 'bg-white border-blue-600 ring-2 ring-blue-600/20'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                      isCourant
                        ? 'bg-blue-100 text-blue-600 border border-blue-200'
                        : 'bg-purple-100 text-purple-600 border border-purple-200'
                    }`}
                  >
                    {isCourant ? <Building2 className="w-5 h-5" /> : <PiggyBank className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{acc.name}</h3>
                    <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {acc.type === 'courant' ? t.checkingAccount : t.savingsAccount}
                    </span>
                  </div>
                </div>

                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>

              <div className="space-y-1 mb-4">
                <p className="text-xs text-slate-400 font-medium">{t.totalBalance}</p>
                <p className="text-2xl font-extrabold text-slate-900 font-sans">
                  {isMaskedBalance ? '••••••••' : formatDirectCurrency(acc.balance, acc.currency, language)}
                </p>
              </div>

              {/* IBAN & Quick Actions */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-mono font-bold text-slate-700 truncate mr-2">
                    {acc.iban}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(acc.iban);
                    }}
                    className="p-1 text-slate-500 hover:text-blue-600 transition shrink-0"
                    title="Copier IBAN"
                  >
                    {copiedIban === acc.iban ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 font-medium">BIC / SWIFT: <span className="font-mono font-bold text-slate-800">NOVABFRPPXXX</span></span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAccountId(acc.id);
                      handleDownloadRib();
                    }}
                    className="text-blue-600 font-bold hover:underline flex items-center space-x-1"
                  >
                    <span>Voir RIB</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Selected Account Detail & Transaction History Section */}
      {selectedAccount && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-extrabold text-slate-900">
                  Historique du {selectedAccount.name}
                </h2>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {selectedAccount.iban}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Solde disponible : <strong className="text-slate-900">{formatDirectCurrency(selectedAccount.balance, selectedAccount.currency, language)}</strong>
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Rechercher une opération..."
                value={searchTx}
                onChange={(e) => setSearchTx(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Transactions List */}
          <div className="divide-y divide-slate-100">
            {filteredTransactions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Aucune transaction trouvée.</p>
            ) : (
              filteredTransactions.map((tx, idx) => {
                const isCredit = tx.amount > 0;
                return (
                  <div key={`${tx.id}_${idx}`} className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-2xl px-3 transition">
                    <div className="flex items-center space-x-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                          isCredit
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">{tx.title}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{tx.date} • {tx.category}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`text-xs sm:text-sm font-extrabold ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {isCredit ? '+' : ''}{formatCurrency(tx.amount, currency, rates, language)}
                      </p>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Exécuté</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* RIB Preview Modal */}
      {showRibModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6 relative">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold">
                  RIB
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Relevé d&apos;Identité Bancaire</h3>
                  <p className="text-xs text-slate-500">NovaBank International S.A.</p>
                </div>
              </div>
              <button
                onClick={() => setShowRibModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 font-mono text-xs">
              <div>
                <p className="text-[10px] uppercase font-sans font-bold text-slate-400">Titulaire du compte</p>
                <p className="font-bold text-slate-900">Thomas Laurent</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-sans font-bold text-slate-400">IBAN</p>
                <p className="font-extrabold text-blue-700 text-sm tracking-wider">{selectedAccount.iban}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <p className="text-[10px] uppercase font-sans font-bold text-slate-400">Code Banque (BIC/SWIFT)</p>
                  <p className="font-bold text-slate-800">NOVABFRPPXXX</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-sans font-bold text-slate-400">Type de Compte</p>
                  <p className="font-bold text-slate-800">{selectedAccount.type.toUpperCase()}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => {
                  handleCopy(selectedAccount.iban);
                  alert('IBAN copié dans le presse-papier.');
                }}
                className="flex-1 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition"
              >
                <Copy className="w-4 h-4" />
                <span>Copier l&apos;IBAN</span>
              </button>
              <button
                onClick={() => {
                  alert('Impression du RIB officielle lancée.');
                  setShowRibModal(false);
                }}
                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
