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
        <DialogBackdrop className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <DialogPanel
            as={motion.div}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8"
          >
          {/* Header */}
          <div className="bg-slate-900 p-6 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="loan-application-modal-title"
                  className="text-base sm:text-lg font-extrabold"
                >
                  {t.loanApplicationTitle}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400">{copy.loanModal.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLoanModalOpen(false)}
              id="close-loan-modal-btn"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              aria-label={copy.common.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!isSuccess && (
            /* Multi-step indicator bar */
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              {stepNames.map((name, index) => {
                const stepNum = index + 1;
                const isActive = step === stepNum;
                const isCompleted = step > stepNum;
                return (
                  <React.Fragment key={stepNum}>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
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
                        className={`text-xs font-bold transition-colors ${
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
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">{t.loanSubmittedSuccess}</h3>
              <p className="text-sm font-mono text-indigo-700 font-bold bg-indigo-50 p-2 rounded-xl border border-indigo-200 inline-block">
                {submittedReference}
              </p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                {copy.loanModal.disclaimer}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs sm:text-sm">
              {!isLoanAvailable && (
                <div
                  className="bg-amber-50 text-amber-900 border border-amber-200 p-3.5 rounded-2xl flex items-start space-x-2.5"
                  role="alert"
                  id="loan-configuration-unavailable-banner"
                >
                  <span className="text-base" aria-hidden="true">⚠️</span>
                  <p className="text-xs font-bold">{configurationUnavailableMessage}</p>
                </div>
              )}
              {Object.keys(errors).length > 0 && (
                <div className="bg-rose-50 text-rose-800 border border-rose-200/60 p-3.5 rounded-2xl flex items-start space-x-2.5" id="loan-error-banner">
                  <span className="text-base">⚠️</span>
                  <div className="text-xs">
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
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{t.requestedAmount}</span>
                        <span className="text-base font-extrabold text-emerald-700">
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
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                        <span>{formatDirectCurrency(minimumAmount, baseCurrency, language)}</span>
                        <span>
                          {formatDirectCurrency(
                            minimumAmount + (maximumAmount - minimumAmount) / 2,
                            baseCurrency,
                            language,
                          )}
                        </span>
                        <span>{formatDirectCurrency(maximumAmount, baseCurrency, language)}</span>
                      </div>
                    </div>

                    {/* Duration Slider */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{t.durationLabel}</span>
                        <span className="text-base font-extrabold text-blue-700">
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
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                        <span>{formatLocalizedMonths(minimumDurationMonths, language)}</span>
                        <span>{formatLocalizedMonths(maximumDurationMonths, language)}</span>
                      </div>
                    </div>

                    {/* Monthly Payment Preview Banner */}
                    <div className="bg-emerald-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-800/80 text-emerald-300 flex items-center justify-center">
                          <Calculator className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-emerald-200 font-bold">{t.monthlyPaymentEstimated}</p>
                          <p className="text-base sm:text-lg font-extrabold text-emerald-300">
                            {formatDirectCurrency(estimatedMonthlyPayment, baseCurrency, language)} {copy.loanModal.perMonth}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-800 px-2.5 py-1 rounded-full text-emerald-100 font-mono font-bold">
                        {copy.loanModal.fixedAnnualRate} {formattedAnnualRate}
                      </span>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition text-xs flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{copy.common.back}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsLoanModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition text-xs"
                  >
                    {t.close}
                  </button>
                )}

                {step < 2 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!isLoanAvailable}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold transition text-xs flex items-center space-x-1"
                  >
                    <span>{copy.common.next}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || !isLoanAvailable}
                    id="submit-loan-application-btn"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold transition shadow-md text-xs flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isSubmitting ? copy.common.submitting : t.submitLoan}</span>
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
