'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatDirectCurrency } from '@/lib/currency';
import { calculateLoanMonthlyPayment } from '@/lib/domain/financial';
import { formatLocalizedMonths, languageLocale } from '@/lib/language';
import { extraUserMessages, loanMotiveLabel, localizedAppError } from '@/lib/user-i18n';
import type { LoanMotiveCode } from '@/lib/types';
import {
  X,
  FileText,
  Building2,
  CheckCircle2,
  Calculator,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useBranded } from '@/components/brand/BrandProvider';
import { Dialog, DialogBackdrop, DialogPanel } from '@/components/ui/Dialog';

function alignDurationToSettings(
  value: number,
  minimumDurationMonths: number,
  maximumDurationMonths: number,
  durationStepMonths: number,
) {
  const clampedValue = Math.min(maximumDurationMonths, Math.max(minimumDurationMonths, value));
  const alignedValue =
    minimumDurationMonths +
    Math.round((clampedValue - minimumDurationMonths) / durationStepMonths) * durationStepMonths;

  return Math.min(maximumDurationMonths, Math.max(minimumDurationMonths, alignedValue));
}

export default function LoanApplicationModal() {
  const {
    language,
    baseCurrency,
    loanProductSettings,
    isLoanModalOpen,
    setIsLoanModalOpen,
    addLoanApplication,
  } = useAppStore();

  const t = useBranded(translations[language] || translations.fr);
  const copy = useBranded(extraUserMessages[language]);

  const [step, setStep] = useState(1);
  const [motiveCode, setMotiveCode] = useState<LoanMotiveCode>('personal');
  const [requestedAmountSelection, setRequestedAmountSelection] = useState(8000);
  const [durationSelectionMonths, setDurationSelectionMonths] = useState(36);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedReference, setSubmittedReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loanSettings = loanProductSettings.find(
    (settings) => settings.currency === baseCurrency,
  );
  const isLoanAvailable = loanSettings?.isActive === true;
  const minimumAmount = loanSettings?.minimumAmount ?? 0;
  const maximumAmount = loanSettings?.maximumAmount ?? 0;
  const minimumDurationMonths = loanSettings?.minimumDurationMonths ?? 1;
  const maximumDurationMonths = loanSettings?.maximumDurationMonths ?? 1;
  const durationStepMonths = Math.max(1, loanSettings?.durationStepMonths ?? 1);
  const annualRate = loanSettings?.fixedAnnualRate ?? 0;
  const requestedAmount = isLoanAvailable
    ? Math.min(maximumAmount, Math.max(minimumAmount, requestedAmountSelection))
    : requestedAmountSelection;
  const durationMonths = isLoanAvailable
    ? alignDurationToSettings(
        durationSelectionMonths,
        minimumDurationMonths,
        maximumDurationMonths,
        durationStepMonths,
      )
    : durationSelectionMonths;
  const configurationUnavailableMessage = copy.loanModal.productUnavailable;
  const formattedAnnualRate = new Intl.NumberFormat(languageLocale(language), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(annualRate);

  const estimatedMonthlyPayment = isLoanAvailable
    ? calculateLoanMonthlyPayment(requestedAmount, annualRate, durationMonths, baseCurrency)
    : 0;

  const handleNextStep = () => {
    const newErrors: Record<string, string> = {};
    if (!isLoanAvailable) {
      newErrors.configuration = configurationUnavailableMessage;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setStep((prev) => Math.min(prev + 1, 2));
  };

  const handlePrevStep = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      handleNextStep();
      return;
    }

    if (!isLoanAvailable) {
      setErrors({ configuration: configurationUnavailableMessage });
      return;
    }

    setErrors({});

    try {
      setIsSubmitting(true);
      const reference = await addLoanApplication({
        clientName: '',
        clientEmail: '',
        requestedAmount,
        approvedAmount: 0,
        currency: baseCurrency,
        durationMonths,
        monthlyPayment: estimatedMonthlyPayment,
        motive: loanMotiveLabel('fr', motiveCode),
        motiveCode,
      });
      setSubmittedReference(reference);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setSubmittedReference('');
        setIsLoanModalOpen(false);
        setStep(1);
      }, 2500);
    } catch {
      setErrors({
        submission: localizedAppError(language, 'SAVE_FAILED'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoanModalOpen) return null;

  // Visual translations for step labels
  const stepNames = [copy.loanModal.stepInformation, copy.loanModal.stepSimulation];

  return (
    <AnimatePresence>
      <Dialog
        open={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        ariaLabelledBy="loan-application-modal-title"
      >
        <DialogBackdrop className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/60 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
          <DialogPanel
            as={motion.div}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative flex max-h-dvh min-h-0 w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
          >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 p-4 text-white sm:p-6">
            <div className="flex min-w-0 items-center space-x-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/20 text-emerald-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="loan-application-modal-title"
                  className="break-words text-base font-extrabold sm:text-lg"
                >
                  {t.loanApplicationTitle}
                </h3>
                <p className="break-words text-[11px] text-slate-400 sm:text-xs">{copy.loanModal.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLoanModalOpen(false)}
              id="close-loan-modal-btn"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label={copy.common.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!isSuccess && (
            /* Multi-step indicator bar */
            <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-6 sm:py-4">
              {stepNames.map((name, index) => {
                const stepNum = index + 1;
                const isActive = step === stepNum;
                const isCompleted = step > stepNum;
                return (
                  <React.Fragment key={stepNum}>
                    <div className="flex min-w-0 flex-col items-center gap-1 text-center sm:flex-row sm:space-x-2 sm:text-left">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isActive
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isCompleted ? '✓' : stepNum}
                      </span>
                      <span
                        className={`min-w-0 break-words text-[10px] font-bold leading-tight transition-colors sm:text-xs ${
                          isActive ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {name}
                      </span>
                    </div>
                    {index < stepNames.length - 1 && (
                      <div className="flex-1 mx-4 h-0.5 bg-slate-200 transition-colors hidden sm:block" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {isSuccess ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center sm:p-12">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="break-words text-xl font-extrabold text-slate-900">{t.loanSubmittedSuccess}</h3>
              <p className="inline-block max-w-full break-all rounded-xl border border-indigo-200 bg-indigo-50 p-2 font-mono text-sm font-bold text-indigo-700">
                {submittedReference}
              </p>
              <p className="mx-auto max-w-md break-words text-xs text-slate-600">
                {copy.loanModal.disclaimer}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col text-xs sm:text-sm">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {!isLoanAvailable && (
                <div
                  className="bg-amber-50 text-amber-900 border border-amber-200 p-3.5 rounded-2xl flex items-start space-x-2.5"
                  role="alert"
                  id="loan-configuration-unavailable-banner"
                >
                  <span className="text-base" aria-hidden="true">⚠️</span>
                  <p className="min-w-0 break-words text-xs font-bold">{configurationUnavailableMessage}</p>
                </div>
              )}
              {Object.keys(errors).length > 0 && (
                <div className="bg-rose-50 text-rose-800 border border-rose-200/60 p-3.5 rounded-2xl flex items-start space-x-2.5" id="loan-error-banner">
                  <span className="text-base">⚠️</span>
                  <div className="min-w-0 break-words text-xs">
                    <p className="font-bold">
                      {copy.loanModal.errorIntro}
                    </p>
                    <ul className="list-disc list-inside mt-1 font-medium space-y-0.5">
                      {Object.values(errors).filter(Boolean).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                      {copy.loanModal.identityNotice}
                    </div>

                    <div>
                      <label htmlFor="loan-motive-select" className="block font-bold text-slate-700 mb-1">{t.loanMotive}</label>
                      <select
                        value={motiveCode}
                        onChange={(e) => setMotiveCode(e.target.value as LoanMotiveCode)}
                        disabled={!isLoanAvailable}
                        id="loan-motive-select"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {(['personal', 'real_estate', 'vehicle', 'renovation', 'business_cashflow', 'other'] as LoanMotiveCode[]).map((code) => (
                          <option key={code} value={code} className="bg-white text-slate-900">
                            {loanMotiveLabel(language, code)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                )}

                {step === 2 && isLoanAvailable && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Amount Slider */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-bold text-slate-800">{t.requestedAmount}</span>
                        <span className="break-words text-base font-extrabold text-emerald-700 sm:text-right">
                          {formatDirectCurrency(requestedAmount, baseCurrency, language)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={minimumAmount}
                        max={maximumAmount}
                        step={1}
                        value={requestedAmount}
                        onChange={(e) =>
                          setRequestedAmountSelection(
                            Math.min(maximumAmount, Math.max(minimumAmount, Number(e.target.value))),
                          )
                        }
                        id="loan-amount-slider"
                        aria-label={t.requestedAmount}
                        aria-valuetext={formatDirectCurrency(requestedAmount, baseCurrency, language)}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 sm:grid-cols-3">
                        <span className="min-w-0 break-words text-left">{formatDirectCurrency(minimumAmount, baseCurrency, language)}</span>
                        <span className="hidden min-w-0 break-words text-center sm:block">
                          {formatDirectCurrency(
                            minimumAmount + (maximumAmount - minimumAmount) / 2,
                            baseCurrency,
                            language,
                          )}
                        </span>
                        <span className="min-w-0 break-words text-right">{formatDirectCurrency(maximumAmount, baseCurrency, language)}</span>
                      </div>
                    </div>

                    {/* Duration Slider */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-bold text-slate-800">{t.durationLabel}</span>
                        <span className="break-words text-base font-extrabold text-blue-700 sm:text-right">
                          {formatLocalizedMonths(durationMonths, language)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={minimumDurationMonths}
                        max={maximumDurationMonths}
                        step={durationStepMonths}
                        value={durationMonths}
                        onChange={(e) =>
                          setDurationSelectionMonths(
                            alignDurationToSettings(
                              Number(e.target.value),
                              minimumDurationMonths,
                              maximumDurationMonths,
                              durationStepMonths,
                            ),
                          )
                        }
                        id="loan-duration-slider"
                        aria-label={t.durationLabel}
                        aria-valuetext={formatLocalizedMonths(durationMonths, language)}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500">
                        <span className="min-w-0 break-words text-left">{formatLocalizedMonths(minimumDurationMonths, language)}</span>
                        <span className="min-w-0 break-words text-right">{formatLocalizedMonths(maximumDurationMonths, language)}</span>
                      </div>
                    </div>

                    {/* Monthly Payment Preview Banner */}
                    <div className="flex flex-col items-start gap-3 rounded-2xl bg-emerald-900 p-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center space-x-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-800/80 text-emerald-300">
                          <Calculator className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-[10px] font-bold text-emerald-200 sm:text-xs">{t.monthlyPaymentEstimated}</p>
                          <p className="break-words text-base font-extrabold text-emerald-300 sm:text-lg">
                            {formatDirectCurrency(estimatedMonthlyPayment, baseCurrency, language)} {copy.loanModal.perMonth}
                          </p>
                        </div>
                      </div>
                      <span className="max-w-full break-words rounded-full bg-emerald-800 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-100">
                        {copy.loanModal.fixedAnnualRate} {formattedAnnualRate}
                      </span>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="flex min-h-11 w-full items-center justify-center space-x-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:w-auto"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{copy.common.back}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsLoanModalOpen(false)}
                    className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50 sm:w-auto"
                  >
                    {t.close}
                  </button>
                )}

                {step < 2 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!isLoanAvailable}
                    className="flex min-h-11 w-full items-center justify-center space-x-1 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <span className="whitespace-normal text-center leading-tight">{copy.common.next}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || !isLoanAvailable}
                    id="submit-loan-application-btn"
                    className="flex min-h-11 w-full items-center justify-center space-x-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="whitespace-normal text-center leading-tight">{isSubmitting ? copy.common.submitting : t.submitLoan}</span>
                  </button>
                )}
              </div>
            </form>
          )}
          </DialogPanel>
        </DialogBackdrop>
      </Dialog>
    </AnimatePresence>
  );
}
