'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { Language } from '@/lib/types';
import {
  convertAnyAmount,
  formatDirectCurrency,
  sumConvertedAmounts,
} from '@/lib/currency';
import { formatLocalizedDate, formatLocalizedPercent } from '@/lib/language';
import {
  accountTypeLabel,
  extraUserMessages,
  ledgerEntryLabel,
  loanMotiveLabel,
  notificationCopy,
  userMessages,
} from '@/lib/user-i18n';
import {
  consumeKycSubmissionFlash,
  type KycSubmissionFlash,
} from '@/lib/kyc-submission-flash';
import UserTransfersView from './UserTransfersView';
import UserLoansView from './UserLoansView';
import UserDocumentsView from './UserDocumentsView';
import UserSettingsView from './UserSettingsView';
import UserKycStatusView from './UserKycStatusView';
import UserAccountsView from './UserAccountsView';
import { useBranded } from '@/components/brand/BrandProvider';

const cardClass =
  'min-w-0 rounded-[14px] border border-[#e4e7f0] bg-white shadow-[0_8px_30px_rgba(25,34,80,0.025)]';

const KYC_FLASH_DURATION_MS = 10_000;

function KycSubmissionNotice({
  closeLabel,
  ctaLabel,
  message,
  onDismiss,
  title,
}: {
  closeLabel: string;
  ctaLabel: string;
  message: string;
  onDismiss: () => void;
  title: string;
}) {
  const remainingRef = useRef(KYC_FLASH_DURATION_MS);
  const startedAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pauseReasonsRef = useRef(new Set<'hover' | 'focus'>());

  const pauseTimer = useCallback(() => {
    if (startedAtRef.current !== null) {
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
      startedAtRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timeoutRef.current !== null || pauseReasonsRef.current.size > 0) return;
    if (remainingRef.current <= 0) {
      onDismiss();
      return;
    }
    startedAtRef.current = Date.now();
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      startedAtRef.current = null;
      remainingRef.current = 0;
      onDismiss();
    }, remainingRef.current);
  }, [onDismiss]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      startedAtRef.current = null;
    };
  }, [startTimer]);

  const pauseFor = (reason: 'hover' | 'focus') => {
    pauseReasonsRef.current.add(reason);
    pauseTimer();
  };
  const resumeAfter = (reason: 'hover' | 'focus') => {
    pauseReasonsRef.current.delete(reason);
    startTimer();
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => pauseFor('hover')}
      onMouseLeave={() => resumeAfter('hover')}
      onFocusCapture={() => pauseFor('focus')}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resumeAfter('focus');
      }}
      className="mb-4 flex min-w-0 flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm sm:mb-5 sm:flex-row sm:items-center"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check aria-hidden="true" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-emerald-900">{message}</p>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:shrink-0">
        <a
          href="/myaccount?tab=kyc"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-center text-sm font-bold text-white sm:flex-none"
        >
          {ctaLabel}
        </a>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={closeLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-emerald-800 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}

function ComplianceRing({ value, label, language }: { value: number; label: string; language: Language }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="relative flex h-[112px] w-[112px] shrink-0 self-center items-center justify-center rounded-full sm:self-auto"
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
    currency,
    rates,
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
  const [kycSubmissionFlash, setKycSubmissionFlash] = useState<KycSubmissionFlash | null>(null);

  const dismissKycSubmissionFlash = useCallback(() => setKycSubmissionFlash(null), []);

  useEffect(() => {
    const consumed = consumeKycSubmissionFlash(window.location.href);
    if (!consumed) return;
    const timeout = window.setTimeout(() => {
      setKycSubmissionFlash(consumed.flash);
      window.history.replaceState(window.history.state, '', consumed.nextPath);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (activeTab === 'transfers') return <UserTransfersView />;
  if (activeTab === 'accounts') return <UserAccountsView />;
  if (activeTab === 'loan') return <UserLoansView />;
  if (activeTab === 'documents') return <UserDocumentsView />;
  if (activeTab === 'kyc') return <UserKycStatusView />;
  if (activeTab === 'settings') return <UserSettingsView />;

  const currentAccounts = accounts.filter((account) => account.type === 'courant');
  const currentAccount = currentAccounts[0];
  const totalBalance = sumConvertedAmounts(
    currentAccounts.map((account) => ({
      amount: account.balance,
      currency: account.currency,
    })),
    currency,
    rates,
  );
  const monthlyCredits = sumConvertedAmounts(
    transactions
      .filter((transaction) => transaction.type === 'credit')
      .map((transaction) => ({
        amount: Math.abs(transaction.amount),
        currency: transaction.currency ?? currency,
      })),
    currency,
    rates,
  );
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

  const money = (amount: number, sourceCurrency = currency) =>
    formatDirectCurrency(
      convertAnyAmount(amount, sourceCurrency, currency, rates),
      currency,
      language,
    );
  const kycFlashCopy = kycSubmissionFlash
    ? notificationCopy(language, kycSubmissionFlash)
    : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1320px] px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-7 sm:pb-10 lg:px-10 lg:pb-8">
      {kycFlashCopy && (
        <KycSubmissionNotice
          closeLabel={extra.common.close}
          ctaLabel={extra.notifications.openItem}
          message={kycFlashCopy.message}
          onDismiss={dismissKycSubmissionFlash}
          title={kycFlashCopy.title}
        />
      )}
      <div className="grid min-w-0 items-start gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <section className="relative min-w-0 overflow-hidden rounded-[14px] bg-gradient-to-br from-[#061348] via-[#071653] to-[#0b1459] px-4 py-5 text-white shadow-[0_16px_42px_rgba(5,18,71,0.16)] sm:px-6 sm:py-6">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#301bb8]/25 blur-3xl" />
            <div className="relative flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
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
                <strong className="mt-3 block break-words text-[clamp(1.75rem,9vw,2.1875rem)] font-semibold leading-none tracking-tight tabular-nums sm:tracking-wide">
                  {isMaskedBalance ? '••••••' : money(totalBalance)}
                </strong>
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                  <span className="font-semibold text-[#26d871]">+ {money(monthlyCredits)}</span>
                  <span className="text-white/72">{t.thisMonth}</span>
                </p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 sm:h-11 sm:w-11">
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

            <div className="relative mt-8 sm:mt-10">
              <h2 className="mb-3 text-[13px] font-semibold">{t.myAccounts}</h2>
              <div className="overflow-hidden rounded-[11px] border border-white/15 bg-black/5 px-3">
                {currentAccount && (
                  <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-3 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:py-3.5">
                    <span
                      className="row-span-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7048ff] to-[#4026e9] sm:row-span-1"
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
                    <strong className="col-start-2 min-w-0 break-words text-[12px] font-semibold tabular-nums sm:col-start-auto sm:text-[13px]">
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

          <section className={`${cardClass} p-4 sm:p-5`}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ddf8e5] text-[#0aab4c] sm:h-11 sm:w-11">
                  <Landmark className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
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
                className="min-h-10 shrink-0 rounded-lg px-2 text-[10px] font-medium text-[#4b2df1]"
              >
                {t.seeAll}
              </button>
            </div>

            {activeLoan ? (
              <>
                <div className="relative mt-5 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-0">
                  <div className="absolute left-[10%] right-[10%] top-3 hidden h-px bg-gradient-to-r from-[#11aa50] via-[#11aa50] to-[#e0e4ed] sm:block" />
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
                      <div key={String(label)} className="relative z-10 min-w-0 rounded-xl bg-[#f8f9fc] px-2 py-3 text-center sm:rounded-none sm:bg-transparent sm:px-1 sm:py-0">
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
                        <span className="mt-2 block break-words text-[9px] font-medium leading-3 text-[#0a154f]">
                          {label}
                        </span>
                        <span
                          className={`mt-1 block break-words text-[8px] ${
                            complete ? 'text-[#0aae4f]' : current ? 'text-[#4b2df1]' : 'text-[#69729f]'
                          }`}
                        >
                          {complete ? `${t.completed} ✓` : current ? t.inProgress : t.pendingStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 grid min-w-0 gap-5 border-b border-[#eef0f5] pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <dl className="grid min-w-0 grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-x-3 gap-y-3 text-[10px]">
                    <dt className="text-[#69729f]">{t.dossierRef}</dt>
                    <dd className="min-w-0 break-all text-right font-semibold text-[#0a154f] sm:text-left">{activeLoan.reference}</dd>
                    <dt className="text-[#69729f]">{t.requestDate}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-[#0a154f] sm:text-left">{formatLocalizedDate(activeLoan.requestDate, language)}</dd>
                    <dt className="text-[#69729f]">{t.requestedAmount}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-[#0a154f] sm:text-left">
                      {money(activeLoan.requestedAmount, activeLoan.currency)}
                    </dd>
                    <dt className="text-[#69729f]">{t.approvedAmount}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-[#0a154f] sm:text-left">
                      {money(activeLoan.approvedAmount, activeLoan.currency)}
                    </dd>
                    <dt className="text-[#69729f]">{t.disbursementMode}</dt>
                    <dd className="min-w-0 break-words text-right font-semibold text-[#0a154f] sm:text-left">
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
                        <div key={item.label} className="flex min-w-0 items-center gap-3 border-b border-[#edf0f5] pb-3 last:border-b-0 last:pb-0 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-2 sm:last:border-r-0">
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
                      className="min-h-11 w-full rounded-lg border border-[#a99bff] px-5 py-2.5 text-[11px] font-medium text-[#4b2df1] sm:w-auto sm:px-10"
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

        <div className="min-w-0 space-y-4">
          <section className={`${cardClass} p-4 sm:p-5`}>
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
                    className="group flex min-h-24 min-w-0 flex-col items-center rounded-xl px-1 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b2df1]"
                  >
                    <span className={`flex h-14 w-14 items-center justify-center rounded-full ${item.colors}`}>
                      <Icon className="h-7 w-7 transition-transform group-hover:scale-105" strokeWidth={1.8} />
                    </span>
                    <span className="mt-3 max-w-full break-words text-[10px] font-semibold leading-[15px] text-[#0a154f] sm:max-w-[92px] sm:text-[11px] sm:leading-[17px]">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${cardClass} p-4 sm:p-5`}>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">{t.recentTransactions}</h2>
              <button
                type="button"
                onClick={() => setIsStatementsModalOpen(true)}
                className="min-h-10 rounded-lg py-2 text-left text-[10px] font-medium text-[#4b2df1] sm:px-2 sm:text-right"
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
                  <div key={transaction.id} className="flex min-w-0 items-center gap-2.5 py-2 sm:gap-3 sm:py-1">
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
                      className={`shrink-0 text-right text-[9px] tabular-nums sm:text-[10px] ${
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

          <section className={`${cardClass} border-[#6c4bff] p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-[#0a154f]">{t.pendingTransfers}</h2>
              <button
                type="button"
                onClick={() => setActiveTab('transfers')}
                className="min-h-10 shrink-0 rounded-lg px-2 text-[10px] font-medium text-[#4b2df1]"
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
                  className="flex w-full min-w-0 items-center gap-3 py-3 text-left"
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
                  <span className="shrink-0 text-right">
                    <strong className="block text-[9px] text-[#0a154f] tabular-nums sm:text-[10px]">
                      {money(transfer.amount, transfer.currency)}
                    </strong>
                    <span className="mt-1 flex items-center justify-end gap-1 text-[8px] font-medium text-[#f27a1a]">
                      <Clock3 className="h-3 w-3" />
                      {t.pendingStatus}
                    </span>
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

          <section className={`${cardClass} p-4 sm:p-5`}>
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
            <div className="mt-4 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-5">
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
