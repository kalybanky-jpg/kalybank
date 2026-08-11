'use client';

import React, { useEffect } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  FileText,
  SendHorizontal,
  ShieldAlert,
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
import { ADMIN_FEATURES, resolveAdminTab } from '@/lib/admin-features';

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

  const resolvedActiveTab = resolveAdminTab(activeTab);

  useEffect(() => {
    if (activeTab === resolvedActiveTab) return;

    setActiveTab(resolvedActiveTab);
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [activeTab, resolvedActiveTab, setActiveTab]);

  if (resolvedActiveTab === 'loanRequests') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminLoansView /></div>;
  }
  if (resolvedActiveTab === 'transfers') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminTransfersView /></div>;
  }
  if (resolvedActiveTab === 'compliance') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminKycManagement /></div>;
  }
  if (resolvedActiveTab === 'clients') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminClientsView /></div>;
  }
  if (resolvedActiveTab === 'accounts') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminAccountsView /></div>;
  }
  if (resolvedActiveTab === 'balanceAdjustment') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminBalanceAdjustmentView /></div>;
  }
  if (resolvedActiveTab === 'documents') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminDocumentsView /></div>;
  }
  if (resolvedActiveTab === 'reports') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminReportsView /></div>;
  }
  if (resolvedActiveTab === 'support') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminSupportMessagesView /></div>;
  }
  if (resolvedActiveTab === 'settings') {
    return <div className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-7 lg:px-10"><AdminSettingsView /></div>;
  }

  const activeTransfers = pendingTransfers.filter(
    (transfer) => !['valide', 'rejete'].includes(transfer.status),
  );
  const pendingApprovalLoans = loans.filter((loan) =>
    ['submitted', 'under_review'].includes(loan.workflowStatus ?? 'submitted'),
  );
  const loansToDisburse = loans.filter((loan) =>
    ['approved_for_external_funding', 'external_funding_recorded'].includes(
      loan.workflowStatus ?? '',
    ),
  );
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
  const progressSamples = activeTransfers.map((transfer) => transfer.complianceProgress);
  const averageCompliance = progressSamples.length
    ? progressSamples.reduce((sum, value) => sum + value, 0) / progressSamples.length
    : 0;
  const trackedCase = activeTransfers[0];
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
      value: pendingApprovalLoans.length + activeTransfers.length,
      trend: `${Math.max(0, pendingApprovalLoans.length)} vs hier`,
      icon: FileText,
      colors: 'bg-[#eee8ff] text-[#4b2df1]',
      target: 'loanRequests',
    },
    {
      label: 'Prêts à approuver',
      value: pendingApprovalLoans.length,
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

  const loanStages = [
    { label: 'Demande reçue', value: loans.length, color: '#4b2df1' },
    {
      label: 'À approuver',
      value: pendingApprovalLoans.length,
      color: '#2464e9',
    },
    {
      label: 'Approuvé',
      value: loansToDisburse.length,
      color: '#4b2df1',
    },
    {
      label: 'Décaissé',
      value: loans.filter((loan) => loan.workflowStatus === 'external_settlement_confirmed').length,
      color: '#0aae4f',
    },
  ];

  return (
    <div className="mx-auto min-w-0 max-w-[1320px] px-3 pb-7 sm:px-7 lg:px-10">
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
          className="min-h-11 w-full rounded-lg bg-[#4b2df1] px-4 py-2.5 text-[10px] font-semibold text-white sm:w-auto"
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
          <section className={`${cardClass} min-w-0 p-4 sm:p-5`}>
            <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">Suivi des demandes de prêt</h2>
              <button
                type="button"
                onClick={() => setActiveTab('loanRequests')}
                className="min-h-11 w-full rounded-md border border-[#d9d5f8] px-3 py-2 text-[9px] font-medium text-[#4b2df1] sm:w-auto"
              >
                Ouvrir les demandes
              </button>
            </div>
            <div className="mt-5 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-0">
              {loanStages.map((step, index) => (
                <div key={step.label} className="relative text-center">
                  {index < loanStages.length - 1 && (
                    <div className="absolute left-[62%] top-3 hidden w-[76%] items-center lg:flex">
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
            <div className="flex min-w-0 flex-col items-start gap-2 px-1 pb-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">Demandes prioritaires</h2>
              <button
                type="button"
                onClick={() => setActiveTab('loanRequests')}
                className="min-h-11 rounded-lg px-2 py-2 text-[9px] font-medium text-[#4b2df1]"
              >
                Voir toutes les demandes
              </button>
            </div>
            <div className="grid min-w-0 gap-3 md:hidden">
              {loans.slice(0, 5).map((loan) => {
                const workflowStatus = loan.workflowStatus ?? 'submitted';
                const pending = ['submitted', 'under_review'].includes(workflowStatus);
                const ready = [
                  'approved_for_external_funding',
                  'external_funding_recorded',
                ].includes(workflowStatus);
                const complete = workflowStatus === 'external_settlement_confirmed';
                const rejected = workflowStatus === 'rejected';
                return (
                  <article key={loan.id} className="min-w-0 rounded-xl border border-[#edf0f5] bg-[#f7f8fc] p-3 text-[10px] text-[#0a154f]">
                    <div className="flex min-w-0 flex-col gap-2 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-bold">{loan.clientName}</p>
                        <p className="mt-1 break-all font-mono text-[#69729f]">{loan.reference}</p>
                      </div>
                      <strong className="shrink-0">{money(loan.requestedAmount, loan.currency)}</strong>
                    </div>
                    <span className={`mt-3 inline-flex rounded px-2 py-1 ${complete ? 'bg-[#e1f7e8] text-[#158d47]' : rejected ? 'bg-[#ffe9eb] text-[#ef334e]' : ready ? 'bg-[#eee9ff] text-[#6543eb]' : 'bg-[#fff0e1] text-[#f07a17]'}`}>
                      {complete
                        ? 'Décaissé'
                        : rejected
                          ? 'Refusé'
                          : ready
                            ? 'À décaisser'
                            : 'À approuver'}
                    </span>
                    <button type="button" onClick={() => setActiveTab('loanRequests')} className={`mt-3 min-h-11 w-full rounded-md border px-3 py-2 font-medium ${ready ? 'border-[#4b2df1] bg-[#4b2df1] text-white' : 'border-[#9d8cff] text-[#4b2df1]'}`}>
                      {ready ? 'Décaisser' : pending ? 'Décider' : 'Voir'}
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f7f8fc] text-[8px] font-medium text-[#25336b]">
                    <th className="rounded-l-lg px-3 py-2">Client</th>
                    <th className="px-2 py-2">Référence</th>
                    <th className="px-2 py-2">Montant</th>
                    <th className="px-2 py-2">Statut</th>
                    <th className="rounded-r-lg px-2 py-2 text-center">Décision / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.slice(0, 5).map((loan, index) => {
                    const workflowStatus = loan.workflowStatus ?? 'submitted';
                    const pending = ['submitted', 'under_review'].includes(workflowStatus);
                    const ready = [
                      'approved_for_external_funding',
                      'external_funding_recorded',
                    ].includes(workflowStatus);
                    const complete = workflowStatus === 'external_settlement_confirmed';
                    const rejected = workflowStatus === 'rejected';
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
                          <span className={`rounded px-2 py-1 ${complete ? 'bg-[#e1f7e8] text-[#158d47]' : rejected ? 'bg-[#ffe9eb] text-[#ef334e]' : ready ? 'bg-[#eee9ff] text-[#6543eb]' : 'bg-[#fff0e1] text-[#f07a17]'}`}>
                            {complete
                              ? 'Décaissé'
                              : rejected
                                ? 'Refusé'
                                : ready
                                  ? 'À décaisser'
                                  : 'À approuver'}
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
                            {ready ? 'Décaisser' : pending ? 'Décider' : 'Voir'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loans.length && (
              <p className="py-10 text-center text-[10px] text-[#69729f]">Aucune demande prioritaire</p>
            )}
            <div className="flex items-center justify-between px-1 pt-3 text-[9px] text-[#5c6695]">
              <span>{loans.length} résultat{loans.length > 1 ? 's' : ''}</span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Page précédente" className="min-h-11 min-w-11 rounded bg-[#f4f5f9] px-2 py-1">‹</button>
                <span className="flex min-h-11 min-w-11 items-center justify-center rounded bg-[#4b2df1] px-2 py-1 text-white">1</span>
                <button type="button" aria-label="Page suivante" className="min-h-11 min-w-11 rounded bg-[#f4f5f9] px-2 py-1">›</button>
              </div>
            </div>
          </section>

          <section className={`${cardClass} p-4`}>
            <div className="flex min-w-0 flex-col items-start gap-2 px-1 pb-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">Décaissements du jour</h2>
              <button
                type="button"
                onClick={() => setActiveTab('transfers')}
                className="min-h-11 rounded-lg px-2 py-2 text-[9px] font-medium text-[#4b2df1]"
              >
                Voir tous les décaissements
              </button>
            </div>
            <div className="grid min-w-0 gap-3 md:hidden">
              {loans.slice(0, 5).map((loan) => {
                const workflowStatus = loan.workflowStatus ?? 'submitted';
                const complete = workflowStatus === 'external_settlement_confirmed';
                const ready = [
                  'approved_for_external_funding',
                  'external_funding_recorded',
                ].includes(workflowStatus);
                const rejected = workflowStatus === 'rejected';
                return (
                  <article key={loan.id} className="min-w-0 rounded-xl border border-[#edf0f5] bg-[#f7f8fc] p-3 text-[10px] text-[#0a154f]">
                    <div className="flex min-w-0 flex-col gap-2 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-bold">Vers {loan.clientName}</p>
                        <p className="mt-1 break-all font-mono text-[#69729f]">{loan.disbursementAccount || 'Compte à sélectionner'}</p>
                      </div>
                      <strong className="shrink-0">{money(loan.approvedAmount || loan.requestedAmount, loan.currency)}</strong>
                    </div>
                    <p className={`mt-3 flex items-center gap-1 ${complete ? 'text-[#0aae4f]' : rejected ? 'text-[#ef334e]' : ready ? 'text-[#f07a17]' : 'text-[#69729f]'}`}>
                      {complete ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                      {complete ? 'Décaissé' : rejected ? 'Refusé' : ready ? 'À décaisser' : 'À approuver'}
                    </p>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[610px] text-left">
                <thead>
                  <tr className="bg-[#f7f8fc] text-[8px] text-[#25336b]">
                    <th className="rounded-l-lg px-3 py-2">Client</th>
                    <th className="px-2 py-2">Montant approuvé</th>
                    <th className="px-2 py-2">Compte courant</th>
                    <th className="rounded-r-lg px-2 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.slice(0, 5).map((loan, index) => {
                    const complete = loan.workflowStatus === 'external_settlement_confirmed';
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
                        <td className={`px-2 py-2 ${complete ? 'text-[#0aae4f]' : 'text-[#f07a17]'}`}>
                          <span className="flex items-center gap-1">
                            {complete ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                            {complete ? 'Décaissé' : 'À décaisser'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loans.length && (
              <p className="py-9 text-center text-[10px] text-[#69729f]">Aucun décaissement prévu</p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className={`${cardClass} min-w-0 p-4 sm:p-5`}>
            <h2 className="text-[13px] font-semibold text-[#0a154f]">Actions à effectuer</h2>
            <div className="mt-4 space-y-2">
              {[
                { label: 'Prêts à approuver', count: pendingApprovalLoans.length, icon: FileText, colors: 'bg-[#eee9ff] text-[#4b2df1]', target: 'loanRequests' },
                { label: 'Prêts à décaisser', count: loansToDisburse.length, icon: WalletCards, colors: 'bg-[#e2f8e9] text-[#09a849]', target: 'loanRequests' },
                { label: 'Virements à traiter', count: activeTransfers.length, icon: SendHorizontal, colors: 'bg-[#e8efff] text-[#315cf4]', target: 'transfers' },
                { label: 'Dossiers KYC à revoir', count: pendingKyc.length, icon: UserRound, colors: 'bg-[#fff0e1] text-[#f07a17]', target: 'compliance' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveTab(item.target)}
                    className="grid min-h-11 w-full min-w-0 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[#f7f8fc]"
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${item.colors}`}>
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[9px] font-semibold text-[#0a154f]">{item.label}</strong>
                      <span className="mt-0.5 block text-[8px] text-[#69729f]">Ouvrir la liste</span>
                    </div>
                    <strong className="rounded-md bg-[#f3f1ff] px-2.5 py-1.5 text-[10px] text-[#4b2df1]">{item.count}</strong>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${cardClass} min-w-0 p-4 sm:p-5`}>
            <div className="flex min-w-0 flex-col items-start gap-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">
                Contrôles des virements
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('transfers')}
                className="min-h-11 rounded-lg px-2 py-2 text-[9px] font-medium text-[#4b2df1]"
              >
                Ouvrir les virements
              </button>
            </div>
            <div className="mt-4 flex min-w-0 flex-col items-start gap-4 min-[360px]:flex-row min-[360px]:items-center sm:gap-6">
              <ComplianceRing value={averageCompliance} />
              <p className="text-[10px] leading-5 text-[#69729f]">
                Cette progression concerne uniquement les virements. L’approbation des prêts reste
                une décision unique, suivie d’un décaissement séparé.
              </p>
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-x-7 gap-y-2 sm:grid-cols-2">
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
              {ADMIN_FEATURES.auditAndRegistry && (
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className="min-h-11 rounded-lg px-2 py-2 text-[9px] font-medium text-[#4b2df1]"
                >
                  Voir toute l’activité
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {activityLogs.slice(0, 5).map((event) => (
                <div key={event.id} className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)_48px] items-center gap-2 text-[8px]">
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
            {ADMIN_FEATURES.auditAndRegistry && (
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className="mt-4 min-h-11 w-full rounded-lg px-3 py-2 text-center text-[9px] font-medium text-[#4b2df1]"
              >
                Afficher plus d’activités ↓
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
