'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import {
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Send,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import UserAccountsView from './UserAccountsView';
import UserTransfersView from './UserTransfersView';
import UserLoansView from './UserLoansView';
import UserDocumentsView from './UserDocumentsView';
import UserSettingsView from './UserSettingsView';

const TRANSFER_LABELS: Record<string, string> = {
  submitted: 'Instruction enregistrée',
  under_review: 'En contrôle',
  approved_for_external_execution: 'Autorisée pour traitement externe',
  external_execution_recorded: 'Exécution externe déclarée',
  external_settlement_confirmed: 'Règlement externe confirmé',
  rejected: 'Rejetée',
  cancelled: 'Annulée',
  external_failed: 'Exécution externe en échec',
};

export default function UserDashboard() {
  const {
    language,
    activeTab,
    accounts,
    transactions,
    pendingTransfers,
    loans,
    kycApplications,
    isMaskedBalance,
    toggleMaskBalance,
    setIsTransferModalOpen,
    setIsLoanModalOpen,
  } = useAppStore();

  if (activeTab === 'accounts') return <UserAccountsView />;
  if (activeTab === 'transfers') return <UserTransfersView />;
  if (activeTab === 'loan') return <UserLoansView />;
  if (activeTab === 'documents') return <UserDocumentsView />;
  if (activeTab === 'settings') return <UserSettingsView />;

  const latestKyc = kycApplications[0];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <ShieldCheck className="w-4 h-4" />
          <span>Tableau de suivi KALY</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
          Instructions et dossiers
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl">
          KALY ne consulte aucun compte bancaire. Les montants affichés sont des
          positions déclarées ou rapprochées manuellement, datées et internes à l&apos;application.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-slate-500">Positions internes</p>
              <p className="text-[11px] text-slate-400">
                Aucune donnée bancaire en temps réel
              </p>
            </div>
            <button
              type="button"
              onClick={toggleMaskBalance}
              className="p-2 bg-slate-100 rounded-xl"
              aria-label={isMaskedBalance ? 'Afficher les montants' : 'Masquer les montants'}
            >
              {isMaskedBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accounts.map((account) => (
              <div key={account.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-800">{account.name}</p>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {isMaskedBalance
                    ? '••••••'
                    : formatDirectCurrency(account.balance, account.currency, language)}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {account.positionKind === 'internally_reconciled'
                    ? 'Rapprochée manuellement'
                    : 'Déclarée'}{' '}
                  — au {account.asOf ? new Date(account.asOf).toLocaleString(language) : 'non daté'}
                </p>
              </div>
            ))}
            {!accounts.length && (
              <p className="sm:col-span-2 py-8 text-center text-sm text-slate-500">
                Aucune position interne enregistrée.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <p className="text-xs font-bold text-slate-500">Contrôle d&apos;identité</p>
          <p className="text-lg font-extrabold text-slate-900 mt-2">
            {latestKyc?.workflowStatus === 'approved'
              ? 'Identité approuvée'
              : latestKyc?.workflowStatus === 'rejected'
                ? 'Dossier rejeté'
                : latestKyc
                  ? 'Contrôle en cours'
                  : 'Dossier absent'}
          </p>
          <p className="text-[11px] text-slate-500 mt-2">
            Cette décision n&apos;ouvre aucun compte bancaire et ne génère aucun IBAN.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setIsTransferModalOpen(true)}
          disabled={!accounts.length}
          className="p-5 bg-blue-600 text-white rounded-3xl text-left disabled:opacity-40"
        >
          <Send className="w-6 h-6 mb-4" />
          <p className="font-extrabold">Préparer une instruction externe</p>
          <p className="text-xs text-blue-100 mt-1">
            Contrôlée dans KALY, exécutée hors application
          </p>
        </button>
        <button
          type="button"
          onClick={() => setIsLoanModalOpen(true)}
          className="p-5 bg-indigo-600 text-white rounded-3xl text-left"
        >
          <FileText className="w-6 h-6 mb-4" />
          <p className="font-extrabold">Déposer une demande de financement</p>
          <p className="text-xs text-indigo-100 mt-1">
            Simulation indicative, sans offre ni versement automatique
          </p>
        </button>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-blue-600" />
            Instructions récentes
          </h2>
          <div className="space-y-3">
            {pendingTransfers.slice(0, 5).map((transfer) => (
              <div key={transfer.id} className="p-3 bg-slate-50 rounded-xl flex justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-900">{transfer.recipientName}</p>
                  <p className="text-[10px] text-slate-500">{transfer.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-slate-900">
                    {formatDirectCurrency(transfer.amount, transfer.currency, language)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {TRANSFER_LABELS[transfer.workflowStatus ?? 'submitted']}
                  </p>
                </div>
              </div>
            ))}
            {!pendingTransfers.length && (
              <p className="py-8 text-center text-sm text-slate-500">
                Aucune instruction.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2 mb-4">
            <WalletCards className="w-4 h-4 text-emerald-600" />
            Règlements externes confirmés
          </h2>
          <div className="space-y-3">
            {transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="p-3 border rounded-xl flex justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-900">{transaction.title}</p>
                  <p className="text-[10px] text-slate-500">{transaction.date}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600" />
              </div>
            ))}
            {!transactions.length && (
              <p className="py-8 text-center text-sm text-slate-500">
                Aucun règlement externe confirmé.
              </p>
            )}
          </div>
        </div>
      </section>

      <p className="text-[11px] text-slate-500 text-center">
        Les positions dans KALY ne sont pas des soldes bancaires consultés en direct.
      </p>
    </div>
  );
}
