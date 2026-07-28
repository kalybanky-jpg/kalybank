'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Send,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import AdminKycManagement from './AdminKycManagement';
import AdminLoansView from './AdminLoansView';
import AdminTransfersView from './AdminTransfersView';
import AdminClientsView from './AdminClientsView';
import AdminAccountsView from './AdminAccountsView';
import AdminDocumentsView from './AdminDocumentsView';
import AdminReportsView from './AdminReportsView';
import AdminSettingsView from './AdminSettingsView';

export default function AdminDashboard() {
  const {
    activeTab,
    setActiveTab,
    pendingTransfers,
    loans,
    kycApplications,
    activityLogs,
  } = useAppStore();

  if (activeTab === 'loanRequests') {
    return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminLoansView /></div>;
  }
  if (activeTab === 'transfers') {
    return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminTransfersView /></div>;
  }
  if (activeTab === 'compliance') {
    return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminKycManagement /></div>;
  }
  if (activeTab === 'clients') {
    return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminClientsView /></div>;
  }
  if (activeTab === 'accounts') {
    return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminAccountsView /></div>;
  }
  if (activeTab === 'documents') {
    return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminDocumentsView /></div>;
  }
  if (activeTab === 'reports') {
    return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminReportsView /></div>;
  }
  if (activeTab === 'settings') {
    return <div className="p-4 sm:p-6 max-w-7xl mx-auto"><AdminSettingsView /></div>;
  }

  const activeTransfers = pendingTransfers.filter(
    (transfer) =>
      !['external_settlement_confirmed', 'rejected', 'cancelled', 'external_failed'].includes(
        transfer.workflowStatus ?? '',
      ),
  );
  const activeLoans = loans.filter(
    (loan) =>
      !['external_settlement_confirmed', 'rejected', 'cancelled', 'external_failed'].includes(
        loan.workflowStatus ?? '',
      ),
  );
  const pendingKyc = kycApplications.filter(
    (application) =>
      !['approved', 'rejected'].includes(application.workflowStatus ?? ''),
  );
  const confirmedExternalOperations =
    pendingTransfers.filter(
      (transfer) => transfer.workflowStatus === 'external_settlement_confirmed',
    ).length +
    loans.filter((loan) => loan.workflowStatus === 'external_settlement_confirmed').length;

  const cards = [
    {
      label: 'Virements à décider',
      value: activeTransfers.length,
      icon: Send,
      color: 'text-blue-600 bg-blue-50',
      target: 'transfers',
    },
    {
      label: 'Prêts à décider',
      value: activeLoans.length,
      icon: FileText,
      color: 'text-indigo-600 bg-indigo-50',
      target: 'loanRequests',
    },
    {
      label: 'Dossiers identité ouverts',
      value: pendingKyc.length,
      icon: UserCheck,
      color: 'text-amber-600 bg-amber-50',
      target: 'compliance',
    },
    {
      label: 'Opérations finalisées',
      value: confirmedExternalOperations,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50',
      target: 'documents',
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <ShieldCheck className="w-4 h-4" />
          <span>Espace chef d&apos;agence Monalyz</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">Décisions à prendre</h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl">
          Les contrôles et mouvements financiers sont réalisés hors de Monalyz.
          Cet espace permet au chef d&apos;agence de valider puis finaliser les dossiers.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setActiveTab(card.target)}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm text-left hover:border-blue-300 transition"
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="mt-4 text-xs font-bold text-slate-500">{card.label}</p>
              <div className="flex items-end justify-between">
                <strong className="text-3xl text-slate-900">{card.value}</strong>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-slate-900">Instructions récentes</h2>
            <button
              type="button"
              onClick={() => setActiveTab('transfers')}
              className="text-xs font-bold text-blue-600"
            >
              Examiner
            </button>
          </div>
          <div className="space-y-3">
            {pendingTransfers.slice(0, 5).map((transfer) => (
              <div key={transfer.id} className="p-3 rounded-xl bg-slate-50 flex justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900">{transfer.recipientName}</p>
                  <p className="text-[10px] font-mono text-slate-500">{transfer.id}</p>
                </div>
                <span className="text-[10px] font-bold text-slate-600 text-right">
                  {transfer.workflowStatus?.replaceAll('_', ' ')}
                </span>
              </div>
            ))}
            {!pendingTransfers.length && (
              <p className="py-8 text-center text-sm text-slate-500">Aucune instruction.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-slate-900">Journal d&apos;audit récent</h2>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className="text-xs font-bold text-blue-600"
            >
              Voir le journal
            </button>
          </div>
          <div className="space-y-3">
            {activityLogs.slice(0, 5).map((event) => (
              <div key={event.id} className="p-3 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-800">{event.description}</p>
                <p className="text-[10px] text-slate-500">{event.timestamp}</p>
              </div>
            ))}
            {!activityLogs.length && (
              <p className="py-8 text-center text-sm text-slate-500">
                Aucun événement accessible.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
