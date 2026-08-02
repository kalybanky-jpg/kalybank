'use client';

import React from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  Lightbulb,
  SendHorizontal,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import { formatLocalizedDate, formatLocalizedPercent } from '@/lib/language';
import {
  accountTypeLabel,
  extraUserMessages,
  ledgerEntryLabel,
  loanMotiveLabel,
  userMessages,
} from '@/lib/user-i18n';
import UserTransfersView from './UserTransfersView';
import UserLoansView from './UserLoansView';
import UserDocumentsView from './UserDocumentsView';
import UserSettingsView from './UserSettingsView';
import UserKycStatusView from './UserKycStatusView';
import UserAccountsView from './UserAccountsView';
import { useBranded } from '@/components/brand/BrandProvider';

const cardClass =
  'rounded-[14px] border border-[#e4e7f0] bg-white shadow-[0_8px_30px_rgba(25,34,80,0.025)]';

function ComplianceRing({ value, label, language }: { value: number; label: string; language: 'fr' | 'en' | 'de' | 'es' }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="relative flex h-[112px] w-[112px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(#4a2bf4 ${safeValue * 3.6}deg, #e8ebf4 0deg)`,
      }}
      aria-label={`${label}: ${formatLocalizedPercent(safeValue, language)}`}
    >
      <div className="flex h-[98px] w-[98px] flex-col items-center justify-center rounded-full bg-white">
        <strong className="text-[25px] leading-none text-[#0a154f]">{formatLocalizedPercent(safeValue, language)}</strong>
        <span className="mt-1 text-[9px] text-[#69729f]">{label}</span>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const {
    language,
    activeTab,
    setActiveTab,
    accounts,
    transactions,
    pendingTransfers,
    loans,
    isMaskedBalance,
    toggleMaskBalance,
    setIsTransferModalOpen,
    setIsLoanModalOpen,
    setIsStatementsModalOpen,
  } = useAppStore();
  const messages = useBranded(userMessages[language]);
  const t = messages.app;
  const banking = messages.banking;
  const extra = useBranded(extraUserMessages[language]);

  if (activeTab === 'transfers') return <UserTransfersView />;
  if (activeTab === 'accounts') return <UserAccountsView />;
  if (activeTab === 'loan') return <UserLoansView />;
  if (activeTab === 'documents') return <UserDocumentsView />;
  if (activeTab === 'kyc') return <UserKycStatusView />;
  if (activeTab === 'settings') return <UserSettingsView />;

  const currentAccounts = accounts.filter((account) => account.type === 'courant');
  const currentAccount = currentAccounts[0];
  const currency = currentAccount?.currency ?? 'EUR';
  const totalBalance = currentAccounts.reduce((sum, account) => sum + account.balance, 0);
  const monthlyCredits = transactions
    .filter((transaction) => transaction.type === 'credit')
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const activeLoan = loans.find((loan) => !['refuse', 'decaisse'].includes(loan.status)) ?? loans[0];
  const trackedTransfer =
    pendingTransfers.find((transfer) => !['valide', 'rejete'].includes(transfer.status)) ??
    pendingTransfers[0];
  const complianceProgress =
    trackedTransfer?.complianceProgress ?? activeLoan?.complianceProgress ?? 0;
  const complianceChecks =
    trackedTransfer?.complianceChecks ??
    activeLoan?.complianceChecks ?? {
      doubleValidation: 'en_attente' as const,
      escalade: 'en_attente' as const,
      controleConformite: 'en_attente' as const,
      autorisationFinale: 'en_attente' as const,
    };

  const money = (amount: number, moneyCurrency = currency) =>
    formatDirectCurrency(amount, moneyCurrency, language);

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-7 sm:px-7 lg:px-10">
      <div className="grid items-start gap-5 xl:grid-cols-[1.28fr_1fr]">
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-[14px] bg-gradient-to-br from-[#061348] via-[#071653] to-[#0b1459] px-6 py-6 text-white shadow-[0_16px_42px_rgba(5,18,71,0.16)]">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#301bb8]/25 blur-3xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold text-white/90">
                  <span>{t.totalBalance}</span>
                  <button
                    type="button"
                    onClick={toggleMaskBalance}
                    className="rounded p-0.5 text-white/78 hover:text-white"
                    aria-label={isMaskedBalance ? banking.dashboard.showBalances : banking.dashboard.hideBalances}
                    aria-pressed={!isMaskedBalance}
                  >
                    {isMaskedBalance ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <strong className="mt-3 block text-[35px] font-semibold leading-none tracking-wide">
                  {isMaskedBalance ? '••••••' : money(totalBalance)}
                </strong>
                <p className="mt-3 text-[12px]">
                  <span className="font-semibold text-[#26d871]">+ {money(monthlyCredits)}</span>
                  <span className="ml-5 text-white/72">{t.thisMonth}</span>
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
                <CircleDollarSign className="h-5 w-5 text-white/90" strokeWidth={1.7} />
              </span>
            </div>

            <svg
              aria-hidden="true"
              viewBox="0 0 360 110"
              className="absolute right-3 top-[70px] hidden h-[102px] w-[55%] opacity-90 sm:block"
            >
              <defs>
                <linearGradient id="lineGlow" x1="0" x2="1">
                  <stop stopColor="#5939ff" />
                  <stop offset="1" stopColor="#bb50ff" />
                </linearGradient>
              </defs>
              <path
                d="M2 83 C55 84,58 58,103 54 S149 77,185 54 S215 10,253 19 S281 79,320 49 S348 42,360 37"
                fill="none"
                stroke="url(#lineGlow)"
                strokeWidth="2"
              />
              <path
                d="M2 70 C55 74,70 42,112 44 S164 59,201 35 S259 44,302 32 S338 29,360 21"
                fill="none"
                stroke="#402bd0"
                strokeOpacity=".52"
              />
              <circle cx="103" cy="54" r="3" fill="#9e54ff" />
              <circle cx="253" cy="19" r="3" fill="#9e54ff" />
            </svg>

            <div className="relative mt-10">
              <h2 className="mb-3 text-[13px] font-semibold">{t.myAccounts}</h2>
              <div className="overflow-hidden rounded-[11px] border border-white/15 bg-black/5 px-3">
                {currentAccount && (
                  <div className="flex w-full items-center gap-4 py-3.5 text-left">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7048ff] to-[#4026e9]"
                    >
                      <Landmark className="h-6 w-6" strokeWidth={1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px] font-semibold">
                        {accountTypeLabel(language, currentAccount.accountType)}
                      </strong>
                      <span className="mt-1 block truncate text-[11px] text-white/65">
                        {currentAccount.accountNumber || banking.dashboard.accountNumberPending}
                      </span>
                    </span>
                    <strong className="text-[13px] font-semibold">
                      {isMaskedBalance
                        ? '••••••'
                        : money(currentAccount.balance, currentAccount.currency)}
                    </strong>
                  </div>
                )}
                {!currentAccount && (
                  <div className="flex min-h-[72px] items-center justify-center text-[11px] text-white/60">
                    {banking.dashboard.noAccounts}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ddf8e5] text-[#0aab4c]">
                  <Landmark className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[14px] font-semibold text-[#0a154f]">
                      {activeLoan ? loanMotiveLabel(language, activeLoan.motiveCode) : t.personalLoan}
                    </h2>
                    {activeLoan && (
                      <span className="rounded bg-[#e2f8e9] px-2 py-1 text-[9px] font-medium text-[#14954a]">
                        {t.inProgress}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('loan')}
                className="text-[10px] font-medium text-[#4b2df1]"
              >
                {t.seeAll}
              </button>
            </div>

            {activeLoan ? (
              <>
                <div className="relative mt-5 grid grid-cols-4">
                  <div className="absolute left-[10%] right-[10%] top-3 h-px bg-gradient-to-r from-[#11aa50] via-[#11aa50] to-[#e0e4ed]" />
                  {[
                    [t.stepReceived, 1],
                    [t.stepAnalysis, 2],
                    [t.stepValidation, 3],
                    [t.stepDisbursement, 4],
                  ].map(([label, step]) => {
                    const stepNumber = Number(step);
                    const normalizedStep = Math.min(4, Math.max(1, activeLoan.currentStep));
                    const complete = stepNumber < normalizedStep;
                    const current = stepNumber === normalizedStep;
                    return (
                      <div key={String(label)} className="relative z-10 text-center">
                        <span
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
                            complete
                              ? 'bg-[#0aae4f]'
                              : current
                                ? 'bg-[#5134ef]'
                                : 'bg-[#dce0ea] text-[#56607c]'
                          }`}
                        >
                          {stepNumber}
                        </span>
                        <span className="mt-2 block text-[9px] font-medium text-[#0a154f]">
                          {label}
                        </span>
                        <span
                          className={`mt-1 block text-[8px] ${
                            complete ? 'text-[#0aae4f]' : current ? 'text-[#4b2df1]' : 'text-[#69729f]'
                          }`}
                        >
                          {complete ? `${t.completed} ✓` : current ? t.inProgress : t.pendingStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-5 border-b border-[#eef0f5] pb-5 lg:grid-cols-[1fr_1fr]">
                  <dl className="grid grid-cols-[125px_1fr] gap-y-3 text-[10px]">
                    <dt className="text-[#69729f]">{t.dossierRef}</dt>
                    <dd className="font-semibold text-[#0a154f]">{activeLoan.reference}</dd>
                    <dt className="text-[#69729f]">{t.requestDate}</dt>
                    <dd className="font-semibold text-[#0a154f]">{formatLocalizedDate(activeLoan.requestDate, language)}</dd>
                    <dt className="text-[#69729f]">{t.requestedAmount}</dt>
                    <dd className="font-semibold text-[#0a154f]">
                      {money(activeLoan.requestedAmount, activeLoan.currency)}
                    </dd>
                    <dt className="text-[#69729f]">{t.approvedAmount}</dt>
                    <dd className="font-semibold text-[#0a154f]">
                      {money(activeLoan.approvedAmount, activeLoan.currency)}
                    </dd>
                    <dt className="text-[#69729f]">{t.disbursementMode}</dt>
                    <dd className="font-semibold text-[#0a154f]">
                      {activeLoan.creditedPositionId ? t.directDeposit : extra.common.unavailable}
                    </dd>
                  </dl>
                  <div className="flex items-center gap-3 rounded-xl bg-[#f4f1ff] px-4 py-3 text-[10px] leading-4 text-[#2f2971]">
                    <Lightbulb className="h-5 w-5 shrink-0 text-[#5a39f4]" strokeWidth={1.8} />
                    <p>{t.fundsDisbursementNotice}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-[13px] font-semibold text-[#0a154f]">{t.repayment}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: t.borrowedAmount,
                        value: money(activeLoan.approvedAmount || activeLoan.requestedAmount, activeLoan.currency),
                        icon: CircleDollarSign,
                        colors: 'bg-[#ddf8e5] text-[#0aa74a]',
                      },
                      {
                        label: t.remainingToRepay,
                        value: money(
                          Math.max(
                            0,
                            (activeLoan.approvedAmount || activeLoan.requestedAmount) -
                              activeLoan.repaidAmount,
                          ),
                          activeLoan.currency,
                        ),
                        icon: WalletCards,
                        colors: 'bg-[#fff0e2] text-[#ff7a1a]',
                      },
                      {
                        label: t.nextDueDate,
                        value: activeLoan.nextDueDate
                          ? formatLocalizedDate(activeLoan.nextDueDate, language)
                          : extra.common.unavailable,
                        icon: CalendarDays,
                        colors: 'bg-[#e8edff] text-[#315cf4]',
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-3 border-r border-[#edf0f5] pr-2 last:border-r-0">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.colors}`}>
                            <Icon className="h-5 w-5" strokeWidth={1.8} />
                          </span>
                          <div className="min-w-0">
                            <span className="block text-[9px] text-[#69729f]">{item.label}</span>
                            <strong className="mt-1 block truncate text-[12px] text-[#0a154f]">{item.value}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('loan')}
                      className="rounded-lg border border-[#a99bff] px-10 py-2.5 text-[11px] font-medium text-[#4b2df1]"
                    >
                      {t.loanDetailsBtn}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                <FileText className="h-9 w-9 text-[#b9bfd2]" strokeWidth={1.5} />
                <p className="mt-3 text-[12px] font-medium text-[#0a154f]">{banking.loans.noLoans}</p>
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(true)}
                  className="mt-4 rounded-lg bg-[#4b2df1] px-5 py-2.5 text-[10px] font-semibold text-white"
                >
                  {t.applyLoan}
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className={`${cardClass} p-5`}>
            <h2 className="text-[13px] font-semibold text-[#0a154f]">{t.quickActions}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                {
                  label: t.makeTransfer,
                  icon: SendHorizontal,
                  action: () => setIsTransferModalOpen(true),
                  colors: 'bg-[#eee9ff] text-[#4b2df1]',
                },
                {
                  label: t.applyLoan,
                  icon: FileText,
                  action: () => setIsLoanModalOpen(true),
                  colors: 'bg-[#fff0e5] text-[#ff7416]',
                },
                {
                  label: t.myStatements,
                  icon: Download,
                  action: () => setIsStatementsModalOpen(true),
                  colors: 'bg-[#e9edff] text-[#315cf4]',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="group flex flex-col items-center text-center"
                  >
                    <span className={`flex h-14 w-14 items-center justify-center rounded-full ${item.colors}`}>
                      <Icon className="h-7 w-7 transition-transform group-hover:scale-105" strokeWidth={1.8} />
                    </span>
                    <span className="mt-3 max-w-[92px] text-[11px] font-semibold leading-[17px] text-[#0a154f]">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">{t.recentTransactions}</h2>
              <button
                type="button"
                onClick={() => setIsStatementsModalOpen(true)}
                className="text-[10px] font-medium text-[#4b2df1]"
              >
                {banking.accounts.downloadStatement}
              </button>
            </div>
            <div className="mt-3 space-y-1.5">
              {transactions.slice(0, 6).map((transaction) => {
                const positive = transaction.type === 'credit';
                const Icon =
                  transaction.category === 'salary'
                    ? ArrowDown
                    : transaction.category === 'transfer'
                      ? ArrowUpRight
                      : WalletCards;
                return (
                  <div key={transaction.id} className="flex items-center gap-3 py-1">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        positive ? 'bg-[#e4f8ea] text-[#09a849]' : 'bg-[#f2f3f7] text-[#0a154f]'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[10px] font-semibold text-[#0a154f]">
                        {ledgerEntryLabel(language, transaction.entryKind, transaction.metadata)}
                      </strong>
                      <span className="block truncate text-[8px] text-[#69729f]">{formatLocalizedDate(transaction.date, language)}</span>
                    </span>
                    <strong
                      className={`text-[10px] ${
                        positive ? 'text-[#0aae4f]' : 'text-[#0a154f]'
                      }`}
                    >
                      {positive ? '+' : '-'} {money(Math.abs(transaction.amount), transaction.currency ?? currency)}
                    </strong>
                    <ChevronRight className="h-3.5 w-3.5 text-[#263773]" />
                  </div>
                );
              })}
              {!transactions.length && (
                <p className="py-8 text-center text-[10px] text-[#69729f]">
                  {banking.dashboard.noTransactions}
                </p>
              )}
            </div>
          </section>

          <section className={`${cardClass} border-[#6c4bff] p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">{t.pendingTransfers}</h2>
              <button
                type="button"
                onClick={() => setActiveTab('transfers')}
                className="text-[10px] font-medium text-[#4b2df1]"
              >
                {t.seeEverything}
              </button>
            </div>
            <div className="mt-2 divide-y divide-[#eef0f5]">
              {pendingTransfers.slice(0, 2).map((transfer) => (
                <button
                  type="button"
                  key={transfer.id}
                  onClick={() => setActiveTab('transfers')}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0e4] text-[#ff7416]">
                    <FileText className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[10px] font-semibold text-[#0a154f]">
                      {transfer.recipientName}
                    </strong>
                    <span className="block truncate text-[8px] text-[#69729f]">
                      {transfer.recipientAccount}
                    </span>
                  </span>
                  <strong className="text-[10px] text-[#0a154f]">
                    {money(transfer.amount, transfer.currency)}
                  </strong>
                  <span className="flex items-center gap-1 text-[8px] font-medium text-[#f27a1a]">
                    <Clock3 className="h-3 w-3" />
                    {t.pendingStatus}
                  </span>
                </button>
              ))}
              {!pendingTransfers.length && (
                <p className="py-6 text-center text-[10px] text-[#69729f]">
                  {banking.dashboard.noTransfers}
                </p>
              )}
            </div>
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">
                {t.securityCompliance}
              </h2>
              <span className={`shrink-0 rounded px-2 py-1 text-[8px] font-medium ${
                complianceProgress >= 100
                  ? 'bg-[#e2f8e9] text-[#14954a]'
                  : trackedTransfer?.status === 'rejete'
                    ? 'bg-[#ffe7e7] text-[#c52d2d]'
                    : 'bg-[#e2f8e9] text-[#14954a]'
              }`}>
                {complianceProgress >= 100
                  ? t.completed
                  : trackedTransfer?.status === 'rejete'
                    ? banking.transfers.statuses.rejected
                    : t.inProgress}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-5">
              <ComplianceRing value={complianceProgress} label={t.progress} language={language} />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] leading-4 text-[#69729f]">
                  {t.complianceNoticeUser}
                </p>
                <div className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  {[
                    [t.doubleInternalValidation, complianceChecks.doubleValidation],
                    [t.hierarchicalEscalation, complianceChecks.escalade],
                    [t.complianceCheck, complianceChecks.controleConformite],
                    [t.finalAuthorization, complianceChecks.autorisationFinale],
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
                        {status === 'termine' ? t.completed : status === 'en_cours' ? t.inProgress : t.pendingStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
