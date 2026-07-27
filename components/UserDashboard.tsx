'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency, formatDirectCurrency, convertAnyAmount } from '@/lib/currency';
import {
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Send,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  Circle,
  HelpCircle,
  PiggyBank,
  Building2,
  Wallet,
  Calendar,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';

import UserAccountsView from './UserAccountsView';
import UserTransfersView from './UserTransfersView';
import UserLoansView from './UserLoansView';
import UserDocumentsView from './UserDocumentsView';
import UserSettingsView from './UserSettingsView';

export default function UserDashboard() {
  const {
    language,
    currency,
    rates,
    activeTab,
    isMaskedBalance,
    toggleMaskBalance,
    accounts,
    transactions,
    pendingTransfers,
    loans,
    kycApplications,
    setIsTransferModalOpen,
    setIsLoanModalOpen,
    setIsStatementsModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  if (activeTab === 'accounts') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><UserAccountsView /></div>;
  if (activeTab === 'transfers') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><UserTransfersView /></div>;
  if (activeTab === 'loan') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><UserLoansView /></div>;
  if (activeTab === 'documents') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><UserDocumentsView /></div>;
  if (activeTab === 'settings') return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><UserSettingsView /></div>;

  const latestKyc = kycApplications[0];
  const primaryLoan = loans.find((l) => l.clientName.includes('Thomas')) || loans[0];
  const totalBalanceActive = accounts.reduce((acc, a) => acc + convertAnyAmount(a.balance, a.currency, currency, rates), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* KYC Status Notification Banner if applicable */}
      {latestKyc && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              latestKyc.status === 'valide'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : latestKyc.status === 'rejete'
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              {latestKyc.status === 'valide' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : latestKyc.status === 'rejete' ? (
                <Clock className="w-5 h-5 text-rose-600" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900">
                Statut Dossier KYC ({latestKyc.firstName} {latestKyc.lastName})
              </p>
              <p className="text-xs text-slate-500">
                {latestKyc.status === 'valide' && (
                  <>Compte activé • IBAN : <span className="font-mono font-bold text-slate-900">{latestKyc.iban}</span></>
                )}
                {latestKyc.status === 'en_attente' && (
                  <>Traitement Back-Office sous 24h ouvrées • Soumis le {latestKyc.submittedAt}</>
                )}
                {latestKyc.status === 'rejete' && (
                  <span className="text-rose-600 font-bold">Action requise : {latestKyc.rejectionReason}</span>
                )}
              </p>
            </div>
          </div>

          {latestKyc.status === 'rejete' && (
            <a
              href="/register"
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              Compléter mon dossier
            </a>
          )}
        </div>
      )}
      {/* Top Grid: Total Balance Card & Quick Actions / Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (lg:col-span-7): Solde Total Dark Card */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-gradient-to-br from-[#0c1033] via-[#0f1747] to-[#12163b] rounded-3xl p-6 text-white shadow-xl border border-blue-900/30 relative overflow-hidden min-h-[380px]">
          {/* Subtle Background Glows */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Balance Header */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-300 text-sm font-medium">
                <span>{t.totalBalance}</span>
                <button
                  onClick={toggleMaskBalance}
                  id="toggle-mask-balance-btn"
                  className="p-1 hover:text-white rounded-md transition text-slate-400"
                  title="Masquer/Afficher"
                >
                  {isMaskedBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Sparkline icon button */}
              <div className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-blue-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Total Balance Number */}
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-sans text-white">
                {isMaskedBalance ? '••••••••' : formatDirectCurrency(totalBalanceActive, currency, language)}
              </h2>
              <span className="inline-flex items-center text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full w-fit">
                + {formatCurrency(1250, currency, rates, language)} {t.thisMonth}
              </span>
            </div>

            {/* Glowing Wave Chart SVG */}
            <div className="w-full h-16 my-2 relative">
              <svg className="w-full h-full text-indigo-400/80" viewBox="0 0 400 60" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 45 Q 60 10, 120 35 T 240 15 T 360 40 T 400 20 L 400 60 L 0 60 Z" fill="url(#waveGradient)" />
                <path d="M0 45 Q 60 10, 120 35 T 240 15 T 360 40 T 400 20" stroke="#818cf8" strokeWidth="2.5" fill="none" />
              </svg>
            </div>
          </div>

          {/* Accounts List Inside Card */}
          <div className="relative z-10 pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 uppercase tracking-wider">{t.myAccounts}</span>
              <button
                onClick={() => alert(t.myAccounts)}
                id="user-see-all-accounts-btn"
                className="text-blue-400 hover:text-blue-300 transition"
              >
                {t.seeAll}
              </button>
            </div>

            <div className="space-y-2">
              {accounts.map((acc, index) => (
                <div
                  key={`${acc.id}_${index}`}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 transition group cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        acc.type === 'courant'
                          ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30'
                          : 'bg-purple-600/30 text-purple-400 border border-purple-500/30'
                      }`}
                    >
                      {acc.type === 'courant' ? <Building2 className="w-5 h-5" /> : <PiggyBank className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition">
                        {acc.name === 'Compte courant' ? t.checkingAccount : t.savingsAccount}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">{acc.iban}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">
                      {isMaskedBalance ? '••••' : formatDirectCurrency(acc.balance, acc.currency, language)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (lg:col-span-5): Quick Actions & Recent Transactions */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          {/* Actions rapides */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4">{t.quickActions}</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setIsTransferModalOpen(true)}
                id="quick-action-virement-btn"
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-indigo-50/50 hover:bg-indigo-100/60 border border-indigo-100/80 transition group"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-sm">
                  <Send className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 text-center leading-tight">
                  {t.makeTransfer}
                </span>
              </button>

              <button
                onClick={() => setIsLoanModalOpen(true)}
                id="quick-action-pret-btn"
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50/50 hover:bg-amber-100/60 border border-amber-100/80 transition group"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 text-center leading-tight">
                  {t.applyLoan}
                </span>
              </button>

              <button
                onClick={() => setIsStatementsModalOpen(true)}
                id="quick-action-releves-btn"
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50/50 hover:bg-blue-100/60 border border-blue-100/80 transition group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-sm">
                  <Download className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 text-center leading-tight">
                  {t.myStatements}
                </span>
              </button>
            </div>
          </div>

          {/* Dernières transactions */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-slate-900">{t.recentTransactions}</h3>
              <button
                onClick={() => alert(t.recentTransactions)}
                id="user-see-all-transactions-btn"
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
              >
                {t.seeEverything}
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 6).map((tx, index) => {
                const isCredit = tx.amount > 0;
                return (
                  <div key={`${tx.id}_${index}`} className="py-2.5 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                          tx.title.includes('Amazon')
                            ? 'bg-amber-100 text-amber-900'
                            : tx.title.includes('Carrefour')
                            ? 'bg-blue-50 text-blue-600'
                            : tx.title.includes('Netflix')
                            ? 'bg-slate-900 text-red-500 font-black'
                            : tx.title.includes('Apple')
                            ? 'bg-slate-900 text-white'
                            : isCredit
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-indigo-100 text-indigo-600'
                        }`}
                      >
                        {tx.title.includes('Amazon')
                          ? 'a'
                          : tx.title.includes('Carrefour')
                          ? 'C'
                          : tx.title.includes('Netflix')
                          ? 'N'
                          : tx.title.includes('Apple')
                          ? ''
                          : isCredit
                          ? <ArrowDownLeft className="w-4 h-4" />
                          : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">{tx.title}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{tx.date}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-xs sm:text-sm font-extrabold ${
                          isCredit ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {isCredit ? '+ ' : ''}
                        {formatCurrency(tx.amount, currency, rates, language)}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Personal Loan Tracker & Pending Transfers / Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Card (lg:col-span-7): Prêt personnel */}
        {primaryLoan && (
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-extrabold text-slate-900">{t.personalLoan}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      {t.inProgress}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsLoanModalOpen(true)}
                id="user-see-all-loans-btn"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
              >
                {t.seeAll}
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="relative py-2">
              <div className="absolute top-5 left-8 right-8 h-1 bg-slate-100 -z-0" />
              <div
                className="absolute top-5 left-8 h-1 bg-emerald-500 transition-all duration-500 -z-0"
                style={{
                  width: `${((primaryLoan.currentStep - 1) / 3) * 85}%`,
                }}
              />

              <div className="grid grid-cols-4 gap-2 relative z-10 text-center">
                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-emerald-500/20 mb-2">
                    ✓
                  </div>
                  <span className="text-xs font-bold text-slate-900">{t.stepReceived}</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold">✓</span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-emerald-500/20 mb-2">
                    ✓
                  </div>
                  <span className="text-xs font-bold text-slate-900">{t.stepAnalysis}</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold">✓</span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-md mb-2 ${
                      primaryLoan.currentStep >= 3
                        ? 'bg-blue-600 text-white shadow-blue-500/30 ring-4 ring-blue-500/10'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    3
                  </div>
                  <span className="text-xs font-bold text-blue-600">{t.stepValidation}</span>
                  <span className="text-[10px] text-blue-600 font-bold">{t.inProgress}</span>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mb-2 ${
                      primaryLoan.currentStep >= 5
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    4
                  </div>
                  <span className="text-xs font-bold text-slate-400">{t.stepDisbursement}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{t.pendingStatus}</span>
                </div>
              </div>
            </div>

            {/* Details Table */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-2">
              <div>
                <p className="text-slate-500 font-medium mb-0.5">{t.dossierRef}</p>
                <p className="font-extrabold text-slate-900 font-mono">{primaryLoan.reference}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-0.5">{t.requestDate}</p>
                <p className="font-extrabold text-slate-900">{primaryLoan.requestDate}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-0.5">{t.requestedAmount}</p>
                <p className="font-extrabold text-slate-900">{formatCurrency(primaryLoan.requestedAmount, currency, rates, language)}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-0.5">{t.approvedAmount}</p>
                <p className="font-extrabold text-slate-900">{formatCurrency(primaryLoan.approvedAmount, currency, rates, language)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 font-medium mb-0.5">{t.disbursementMode}</p>
                <p className="font-extrabold text-slate-900">{primaryLoan.disbursementAccount}</p>
              </div>
            </div>

            {/* Blue Banner Box */}
            <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-3.5 flex items-start space-x-3 text-xs text-indigo-900 shadow-xs">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">{t.fundsDisbursementNotice}</p>
            </div>

            {/* Remboursement Section */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">{t.repayment}</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">{t.borrowedAmount}</p>
                  <p className="text-sm font-extrabold text-slate-900">{formatCurrency(primaryLoan.approvedAmount, currency, rates, language)}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">{t.remainingToRepay}</p>
                  <p className="text-sm font-extrabold text-slate-900">
                    {formatCurrency(primaryLoan.approvedAmount - primaryLoan.repaidAmount, currency, rates, language)}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">{t.nextDueDate}</p>
                  <p className="text-sm font-extrabold text-slate-900">{primaryLoan.nextDueDate}</p>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => setIsLoanModalOpen(true)}
                  id="view-loan-details-btn"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl border border-indigo-200 text-indigo-600 bg-indigo-50/40 hover:bg-indigo-50 font-bold text-xs transition shadow-xs"
                >
                  {t.loanDetailsBtn}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Column (lg:col-span-5): Virements en attente & Contrôles de conformité */}
        <div className="lg:col-span-5 space-y-6">
          {/* Virements en attente */}
          <div className="bg-white rounded-3xl p-5 border-2 border-indigo-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">{t.pendingTransfers}</h3>
              <button
                onClick={() => setIsTransferModalOpen(true)}
                id="user-see-pending-transfers-btn"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
              >
                {t.seeAll}
              </button>
            </div>

            <div className="space-y-2.5">
              {pendingTransfers.map((tr, index) => (
                <div key={`${tr.id}_${index}`} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{t.transfers} {tr.recipientName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">IBAN : {tr.recipientAccount}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-extrabold text-slate-900">
                      {formatCurrency(tr.amount, currency, rates, language)}
                    </p>
                    {tr.status === 'valide' ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" />
                        <span>
                          {language === 'fr'
                            ? 'Effectué'
                            : language === 'en'
                            ? 'Completed'
                            : language === 'es'
                            ? 'Completado'
                            : 'Abgeschlossen'}
                        </span>
                      </span>
                    ) : tr.status === 'rejete' ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full mt-0.5 border border-rose-200">
                        <span className="mr-0.5">✕</span>
                        <span>
                          {language === 'fr'
                            ? 'Refusé (Restitué)'
                            : language === 'en'
                            ? 'Rejected (Refunded)'
                            : language === 'es'
                            ? 'Rechazado (Reembolsado)'
                            : 'Abgelehnt (Erstattet)'}
                        </span>
                      </span>
                    ) : tr.status === 'en_cours' ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full mt-0.5 border border-indigo-200">
                        <Clock className="w-3 h-3 mr-0.5 animate-pulse" />
                        <span>
                          {language === 'fr'
                            ? 'En cours'
                            : language === 'en'
                            ? 'In progress'
                            : language === 'es'
                            ? 'En curso'
                            : 'In Bearbeitung'}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mt-0.5 border border-amber-200">
                        <Clock className="w-3 h-3 mr-0.5" />
                        <span>{t.pendingStatus}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contrôles de conformité et sécurité des virements */}
          {(() => {
            const activeTransfer = pendingTransfers[0];
            const activeProgress = activeTransfer
              ? (activeTransfer.complianceProgress || 25)
              : (primaryLoan?.complianceProgress || 0);

            const activeChecks = activeTransfer
              ? activeTransfer.complianceChecks
              : (primaryLoan?.complianceChecks || {
                  doubleValidation: 'en_attente',
                  escalade: 'en_attente',
                  controleConformite: 'en_attente',
                  autorisationFinale: 'en_attente',
                });

            const isDone = activeTransfer ? activeTransfer.status === 'valide' : activeProgress === 100;
            const isRejected = activeTransfer ? activeTransfer.status === 'rejete' : false;

            return (
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900">{t.securityCompliance}</h3>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isRejected
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : isDone
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    {isRejected
                      ? 'Refusé (Fonds restitués)'
                      : isDone
                      ? '100% - Virement déjà effectué'
                      : `${activeProgress}% - En cours`}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Circular gauge */}
                  <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={`${
                          isRejected
                            ? 'text-rose-500'
                            : isDone
                            ? 'text-emerald-500'
                            : 'text-indigo-600'
                        } transition-all duration-700 stroke-current`}
                        strokeWidth="3.5"
                        strokeDasharray={`${isRejected ? 0 : activeProgress}, 100`}
                        strokeLinecap="round"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-xl font-extrabold text-slate-900">
                        {isRejected ? '0%' : `${activeProgress}%`}
                      </span>
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">{t.progress}</span>
                    </div>
                  </div>

                  {/* Text explanation */}
                  <div className="text-xs text-slate-600 leading-relaxed space-y-1.5 font-medium">
                    {activeTransfer ? (
                      <>
                        <p className="font-bold text-slate-800">
                          Virement de {formatCurrency(activeTransfer.amount, activeTransfer.currency, rates, language)} vers {activeTransfer.recipientName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {isRejected
                            ? '❌ Ce virement a été rejeté par notre service conformité car il ne répondait pas à toutes les exigences réglementaires. L\'intégralité de la somme a été recréditée sur votre compte d\'origine.'
                            : isDone
                            ? '✓ Le virement bancaire a été validé à 100% et est désormais exécuté.'
                            : 'Contrôles manuels 1 à 1 en cours par le service conformité de la banque en ligne.'}
                        </p>
                      </>
                    ) : (
                      <p>Les contrôles manuels 1 à 1 par le service conformité garantissent la sécurité de votre virement.</p>
                    )}
                  </div>
                </div>

                {/* Steps list */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs font-medium">
                  {[
                    {
                      key: 'doubleValidation',
                      label: t.doubleInternalValidation || 'Double validation interne',
                      status: activeChecks?.doubleValidation || 'en_attente',
                    },
                    {
                      key: 'escalade',
                      label: t.hierarchicalEscalation || 'Escalade hiérarchique',
                      status: activeChecks?.escalade || 'en_attente',
                    },
                    {
                      key: 'controleConformite',
                      label: t.complianceCheck || 'Contrôle conformité & sécurité',
                      status: activeChecks?.controleConformite || 'en_attente',
                    },
                    {
                      key: 'autorisationFinale',
                      label: t.finalAuthorization || 'Autorisation finale de virement',
                      status: activeChecks?.autorisationFinale || 'en_attente',
                    },
                  ].map((step, idx) => (
                    <div key={step.key} className="flex items-center justify-between p-1.5 rounded-xl transition hover:bg-slate-50">
                      <div className="flex items-center space-x-2.5">
                        {step.status === 'termine' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : step.status === 'en_cours' ? (
                          <div className="w-4 h-4 rounded-full border-2 border-indigo-600 flex items-center justify-center shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                          </div>
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span
                          className={`text-xs ${
                            step.status === 'termine'
                              ? 'text-slate-900 font-bold'
                              : step.status === 'en_cours'
                              ? 'text-indigo-700 font-bold'
                              : 'text-slate-400 font-medium'
                          }`}
                        >
                          {idx + 1}. {step.label}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                          step.status === 'termine'
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : step.status === 'en_cours'
                            ? 'text-indigo-700 bg-indigo-50 border-indigo-200 animate-pulse'
                            : 'text-slate-400 bg-slate-50 border-slate-200'
                        }`}
                      >
                        {step.status === 'termine'
                          ? 'Terminé'
                          : step.status === 'en_cours'
                          ? 'En cours'
                          : 'En attente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
