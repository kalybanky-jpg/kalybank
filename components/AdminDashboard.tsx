'use client';

import React from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  FileText,
  Landmark,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import AdminKycManagement from './AdminKycManagement';
import AdminLoansView from './AdminLoansView';
import AdminTransfersView from './AdminTransfersView';
import AdminClientsView from './AdminClientsView';
import AdminAccountsView from './AdminAccountsView';
import AdminBalanceAdjustmentView from './AdminBalanceAdjustmentView';
import AdminDocumentsView from './AdminDocumentsView';
import AdminReportsView from './AdminReportsView';
import AdminSettingsView from './AdminSettingsView';
import AdminSupportMessagesView from './AdminSupportMessagesView';

const cardClass =
  'rounded-[14px] border border-[#e4e7f0] bg-white shadow-[0_8px_30px_rgba(25,34,80,0.025)]';

function ComplianceRing({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="relative flex h-[116px] w-[116px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(#4a2bf4 ${safeValue * 3.6}deg, #e8ebf4 0deg)`,
      }}
      aria-label={`${safeValue}% d’avancement`}
    >
      <div className="flex h-[102px] w-[102px] flex-col items-center justify-center rounded-full bg-white">
        <strong className="text-[27px] leading-none text-[#0a154f]">{safeValue}%</strong>
        <span className="mt-1 text-[9px] text-[#69729f]">Avancement</span>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e9ebf3]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#5334f3] to-[#3d23f0]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export default function AdminDashboard() {
  const {
    activeTab,
    setActiveTab,
    pendingTransfers,
    loans,
    kycApplications,
    activityLogs,
    accountNumberConfiguration,
  } = useAppStore();

  if (activeTab === 'loanRequests') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminLoansView /></div>;
  }
  if (activeTab === 'transfers') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminTransfersView /></div>;
  }
  if (activeTab === 'compliance') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminKycManagement /></div>;
  }
  if (activeTab === 'clients') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminClientsView /></div>;
  }
  if (activeTab === 'accounts') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminAccountsView /></div>;
  }
  if (activeTab === 'balanceAdjustment') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminBalanceAdjustmentView /></div>;
  }
  if (activeTab === 'documents') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminDocumentsView /></div>;
  }
  if (activeTab === 'reports') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminReportsView /></div>;
  }
  if (activeTab === 'support') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminSupportMessagesView /></div>;
  }
  if (activeTab === 'settings') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminSettingsView /></div>;
  }

  const activeTransfers = pendingTransfers.filter(
    (transfer) => !['valide', 'rejete'].includes(transfer.status),
  );
  const activeLoans = loans.filter((loan) => !['refuse', 'decaisse'].includes(loan.status));
  const pendingKyc = kycApplications.filter(
    (application) => !['approved', 'rejected'].includes(application.workflowStatus ?? ''),
  );
  const fundedLoans = loans.filter((loan) =>
    ['approved_for_external_funding', 'external_funding_recorded', 'external_settlement_confirmed'].includes(
      loan.workflowStatus ?? '',
    ),
  );
  const fundedToday = fundedLoans.reduce(
    (sum, loan) => sum + (loan.approvedAmount || loan.requestedAmount),
    0,
  );
  const progressSamples = [
    ...activeTransfers.map((transfer) => transfer.complianceProgress),
    ...activeLoans.map((loan) => loan.complianceProgress),
  ];
  const averageCompliance = progressSamples.length
    ? progressSamples.reduce((sum, value) => sum + value, 0) / progressSamples.length
    : 0;
  const trackedCase = activeTransfers[0] ?? activeLoans[0];
  const trackedChecks =
    trackedCase?.complianceChecks ?? {
      doubleValidation: 'en_attente' as const,
      escalade: 'en_attente' as const,
      controleConformite: 'en_attente' as const,
      autorisationFinale: 'en_attente' as const,
    };
  const defaultCurrency = loans[0]?.currency ?? pendingTransfers[0]?.currency ?? 'EUR';
  const money = (amount: number, currency = defaultCurrency) =>
    formatDirectCurrency(amount, currency, 'fr');

  const stats = [
    {
      label: 'Demandes à traiter',
      value: activeLoans.length + activeTransfers.length,
      trend: `${Math.max(0, activeLoans.length)} vs hier`,
      icon: FileText,
      colors: 'bg-[#eee8ff] text-[#4b2df1]',
      target: 'loanRequests',
    },
    {
      label: 'Validations en attente',
      value: activeLoans.length,
      trend: `${Math.max(0, activeTransfers.length)} vs hier`,
      icon: UserRound,
      colors: 'bg-[#fff0e1] text-[#ff7818]',
      target: 'loanRequests',
    },
    {
      label: 'Décaissements aujourd’hui',
      value: money(fundedToday),
      trend: '18% vs hier',
      icon: WalletCards,
      colors: 'bg-[#e2f8e9] text-[#09a849]',
      target: 'transfers',
    },
    {
      label: 'Alertes conformité',
      value: pendingKyc.length,
      trend: `${pendingKyc.length} vs hier`,
      icon: ShieldAlert,
      colors: 'bg-[#ffe9eb] text-[#f22c46]',
      target: 'compliance',
      alert: true,
    },
  ];

  const pipeline = [
    { label: 'Demande reçue', value: loans.length, color: '#4b2df1' },
    {
      label: 'Analyse',
      value: loans.filter((loan) => loan.workflowStatus === 'under_review').length,
      color: '#2464e9',
    },
    {
      label: 'Validation',
      value: activeLoans.filter((loan) => loan.currentStep >= 3).length,
      color: '#4b2df1',
    },
    {
      label: 'Conformité & sécurité',
      value: activeLoans.filter((loan) => loan.currentStep >= 4).length,
      color: '#ff9a2f',
    },
    {
      label: 'Décaissement',
      value: fundedLoans.filter((loan) => loan.workflowStatus !== 'external_settlement_confirmed').length,
      color: '#0aae4f',
    },
    {
      label: 'Viré sur compte courant',
      value: loans.filter((loan) => loan.workflowStatus === 'external_settlement_confirmed').length,
      color: '#0aae4f',
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-7 sm:px-7 lg:px-10">
      <section
        className={`mb-4 flex flex-col gap-3 rounded-[14px] border p-4 sm:flex-row sm:items-center sm:justify-between ${
          accountNumberConfiguration
            ? 'border-[#dfe3ee] bg-white'
            : 'border-amber-300 bg-amber-50'
        }`}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#69729f]">
            Numéros de compte automatiques
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[#0a154f]">
            {accountNumberConfiguration
              ? `Préfixe ${accountNumberConfiguration.prefix} · ${accountNumberConfiguration.capacity.toLocaleString('fr-FR')} numéros possibles`
              : 'Aucun préfixe configuré : la création de comptes est suspendue.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className="rounded-lg bg-[#4b2df1] px-4 py-2.5 text-[10px] font-semibold text-white"
        >
          {accountNumberConfiguration ? 'Modifier le préfixe' : 'Configurer maintenant'}
        </button>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => setActiveTab(stat.target)}
              className={`${cardClass} flex items-center gap-4 px-5 py-5 text-left transition hover:border-[#cfc8ff]`}
            >
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${stat.colors}`}>
                <Icon className="h-7 w-7" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-medium text-[#1b285f]">{stat.label}</span>
                <strong className="mt-1 block truncate text-[21px] leading-none text-[#0a154f]">{stat.value}</strong>
                <span className={`mt-2 block text-[9px] ${stat.alert ? 'text-[#ef334e]' : 'text-[#0aae4f]'}`}>
                  ↗ {stat.trend}
                </span>
              </span>
            </button>
          );
        })}
      </section>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.56fr_1fr]">
        <div className="space-y-4">
          <section className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">Pipeline des prêts</h2>
              <button
                type="button"
                onClick={() => setActiveTab('loanRequests')}
                className="rounded-md border border-[#d9d5f8] px-3 py-1.5 text-[9px] font-medium text-[#4b2df1]"
              >
                Voir le pipeline détaillé
              </button>
            </div>
            <div className="mt-5 grid grid-cols-6">
              {pipeline.map((step, index) => (
                <div key={step.label} className="relative text-center">
                  {index < pipeline.length - 1 && (
                    <div className="absolute left-[62%] top-3 flex w-[76%] items-center">
                      <span className="h-px flex-1 bg-[#cfd4e3]" />
                      <ArrowRight className="-ml-1 h-3 w-3 text-[#aab2c9]" strokeWidth={1.4} />
                    </div>
                  )}
                  <span
                    className="relative z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: step.color }}
                  >
                    {index + 1}
                  </span>
                  <span className="mx-auto mt-2 block max-w-[86px] text-[9px] font-medium leading-[13px] text-[#0a154f]">
                    {step.label}
                  </span>
                  <strong className="mt-1.5 block text-[14px] text-[#0a154f]">{step.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between px-1 pb-3">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">Demandes prioritaires</h2>
              <button
                type="button"
                onClick={() => setActiveTab('loanRequests')}
                className="text-[9px] font-medium text-[#4b2df1]"
              >
                Voir toutes les demandes
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f7f8fc] text-[8px] font-medium text-[#25336b]">
                    <th className="rounded-l-lg px-3 py-2">Client</th>
                    <th className="px-2 py-2">Référence</th>
                    <th className="px-2 py-2">Montant</th>
                    <th className="px-2 py-2">Étape actuelle</th>
                    <th className="px-2 py-2">Contrôle conformité</th>
                    <th className="rounded-r-lg px-2 py-2 text-center">Décision / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.slice(0, 5).map((loan, index) => {
                    const ready = loan.workflowStatus === 'approved_for_external_funding';
                    const review = loan.workflowStatus === 'under_review';
                    return (
                      <tr key={loan.id} className="border-b border-[#edf0f5] text-[8px] text-[#0a154f]">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full ${index % 2 ? 'bg-[#e8ebf5]' : 'bg-[#e7d3c5]'}`}>
                              <CircleUserRound className="h-3.5 w-3.5" />
                            </span>
                            <span className="max-w-[98px] truncate">{loan.clientName}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 font-medium">{loan.reference}</td>
                        <td className="px-2 py-2 font-semibold">{money(loan.requestedAmount, loan.currency)}</td>
                        <td className="px-2 py-2">
                          <span className={`rounded px-2 py-1 ${ready ? 'bg-[#e1f7e8] text-[#158d47]' : review ? 'bg-[#e8efff] text-[#315cf4]' : 'bg-[#f1eaff] text-[#6543eb]'}`}>
                            {ready ? 'Prêt au décaissement' : review ? 'En analyse' : 'Validation manager'}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`rounded px-2 py-1 ${loan.complianceProgress >= 75 ? 'bg-[#e1f7e8] text-[#158d47]' : 'bg-[#fff0e1] text-[#f07a17]'}`}>
                            {loan.complianceProgress >= 75 ? 'Validé' : 'En attente'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setActiveTab('loanRequests')}
                            className={`min-w-[64px] rounded-md border px-3 py-1.5 font-medium ${
                              ready
                                ? 'border-[#4b2df1] bg-[#4b2df1] text-white'
                                : 'border-[#9d8cff] text-[#4b2df1]'
                            }`}
                          >
                            {ready ? 'Autoriser' : 'Voir'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loans.length && (
                <p className="py-10 text-center text-[10px] text-[#69729f]">Aucune demande prioritaire</p>
              )}
            </div>
            <div className="flex items-center justify-between px-1 pt-3 text-[9px] text-[#5c6695]">
              <span>{loans.length} résultat{loans.length > 1 ? 's' : ''}</span>
              <div className="flex items-center gap-1">
                <button type="button" className="rounded bg-[#f4f5f9] px-2 py-1">‹</button>
                <span className="rounded bg-[#4b2df1] px-2 py-1 text-white">1</span>
                <button type="button" className="rounded bg-[#f4f5f9] px-2 py-1">›</button>
              </div>
            </div>
          </section>

          <section className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between px-1 pb-3">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">Décaissements du jour</h2>
              <button
                type="button"
                onClick={() => setActiveTab('transfers')}
                className="text-[9px] font-medium text-[#4b2df1]"
              >
                Voir tous les décaissements
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[610px] text-left">
                <thead>
                  <tr className="bg-[#f7f8fc] text-[8px] text-[#25336b]">
                    <th className="rounded-l-lg px-3 py-2">Client</th>
                    <th className="px-2 py-2">Montant approuvé</th>
                    <th className="px-2 py-2">Compte courant</th>
                    <th className="px-2 py-2">Progression</th>
                    <th className="rounded-r-lg px-2 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.slice(0, 5).map((loan, index) => {
                    const complete = loan.workflowStatus === 'external_settlement_confirmed';
                    const progress = complete ? 100 : loan.complianceProgress;
                    return (
                      <tr key={loan.id} className="border-b border-[#edf0f5] text-[8px] text-[#0a154f]">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full ${index % 2 ? 'bg-[#eee8ff] text-[#4b2df1]' : 'bg-[#e1f7e8] text-[#0aae4f]'}`}>
                              <UserRound className="h-3 w-3" />
                            </span>
                            <span>Vers {loan.clientName}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 font-semibold">
                          {money(loan.approvedAmount || loan.requestedAmount, loan.currency)}
                        </td>
                        <td className="max-w-[160px] truncate px-2 py-2">{loan.disbursementAccount}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-[72px]"><ProgressBar value={progress} /></div>
                            <strong>{Math.round(progress)}%</strong>
                          </div>
                        </td>
                        <td className={`px-2 py-2 ${complete ? 'text-[#0aae4f]' : progress > 0 ? 'text-[#f07a17]' : 'text-[#69729f]'}`}>
                          <span className="flex items-center gap-1">
                            {complete ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                            {complete ? 'Transféré' : progress > 0 ? 'En cours' : 'En attente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loans.length && (
                <p className="py-9 text-center text-[10px] text-[#69729f]">Aucun décaissement prévu</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">File de validation</h2>
              <button
                type="button"
                onClick={() => setActiveTab('compliance')}
                className="text-[9px] font-medium text-[#4b2df1]"
              >
                Voir tout
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {[
                { label: 'Validation maker / checker', count: activeLoans.length, progress: 60, icon: Landmark, colors: 'bg-[#eee9ff] text-[#4b2df1]', status: 'En attente' },
                { label: 'Escalade hiérarchique', count: pendingKyc.length, progress: 40, icon: UserRound, colors: 'bg-[#f1edff] text-[#4b2df1]', status: 'En attente' },
                { label: 'Revue conformité', count: activeTransfers.length, progress: 75, icon: ShieldCheck, colors: 'bg-[#e2f8e9] text-[#09a849]', status: 'En cours' },
                { label: 'Autorisation finale', count: fundedLoans.length, progress: 25, icon: ShieldAlert, colors: 'bg-[#eee9ff] text-[#4b2df1]', status: 'En attente' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="grid grid-cols-[34px_1fr_40px_64px] items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${item.colors}`}>
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[9px] font-semibold text-[#0a154f]">{item.label}</strong>
                      <span className="mt-0.5 block text-[8px] text-[#69729f]">{item.count} en attente</span>
                      <div className="mt-2"><ProgressBar value={item.progress} /></div>
                    </div>
                    <strong className="text-[9px] text-[#0a154f]">{item.progress}%</strong>
                    <span className={`rounded-md px-2 py-1.5 text-center text-[7px] font-medium ${item.status === 'En cours' ? 'bg-[#e2f8e9] text-[#14954a]' : 'bg-[#fff0e1] text-[#f07a17]'}`}>
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">
                Contrôles de conformité et sécurité
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('compliance')}
                className="text-[9px] font-medium text-[#4b2df1]"
              >
                Voir détails
              </button>
            </div>
            <div className="mt-4 flex items-center gap-6">
              <ComplianceRing value={averageCompliance} />
              <p className="text-[10px] leading-5 text-[#69729f]">
                Cette application n’affiche que la progression. À 100 %, le virement est prêt pour
                sa finalisation sur le compte courant du client.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-7 gap-y-2">
              {[
                ['Double validation interne', trackedChecks.doubleValidation],
                ['Escalade hiérarchique', trackedChecks.escalade],
                ['Contrôle conformité', trackedChecks.controleConformite],
                ['Autorisation finale', trackedChecks.autorisationFinale],
              ].map(([label, status]) => (
                <div key={label} className="flex items-center justify-between gap-2 text-[8px]">
                  <span className="flex min-w-0 items-center gap-1.5 text-[#26316b]">
                    <span
                      className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${
                        status === 'termine'
                          ? 'border-[#0aae4f] text-[#0aae4f]'
                          : status === 'en_cours'
                            ? 'border-[#4b2df1] bg-[#4b2df1] text-white'
                            : 'border-[#7781a9] text-transparent'
                      }`}
                    >
                      <Check className="h-2 w-2" strokeWidth={3} />
                    </span>
                    <span className="truncate">{label}</span>
                  </span>
                  <span className={status === 'termine' ? 'text-[#0aae4f]' : status === 'en_cours' ? 'text-[#4b2df1]' : 'text-[#69729f]'}>
                    {status === 'termine' ? 'Terminé' : status === 'en_cours' ? 'En cours' : 'En attente'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">Activité récente</h2>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className="text-[9px] font-medium text-[#4b2df1]"
              >
                Voir toute l’activité
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {activityLogs.slice(0, 5).map((event) => (
                <div key={event.id} className="grid grid-cols-[36px_1fr_48px] items-center gap-2 text-[8px]">
                  <span className="text-[#536092]">{event.timestamp.split(' ').slice(-1)}</span>
                  <span className="truncate text-[#1d2a62]">{event.description}</span>
                  <span
                    className={`rounded px-2 py-1 text-center ${
                      event.type === 'alert'
                        ? 'bg-[#ffe9eb] text-[#ef334e]'
                        : event.type === 'success'
                          ? 'bg-[#e2f8e9] text-[#14954a]'
                          : 'bg-[#e9efff] text-[#315cf4]'
                    }`}
                  >
                    {event.type === 'alert' ? 'Alerte' : event.type === 'success' ? 'Succès' : 'Info'}
                  </span>
                </div>
              ))}
              {!activityLogs.length && (
                <p className="py-7 text-center text-[10px] text-[#69729f]">Aucune activité récente</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className="mt-4 w-full text-center text-[9px] font-medium text-[#4b2df1]"
            >
              Afficher plus d’activités ↓
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
