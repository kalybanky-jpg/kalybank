'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { bankingMessages } from '@/lib/banking-i18n';
import { TransferType, Currency } from '@/lib/types';
import { formatCurrency, convertAmount, convertAnyAmount, formatDirectCurrency } from '@/lib/currency';
import {
  X,
  Send,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function WireTransferModal() {
  const {
    language,
    currency,
    rates,
    accounts,
    isTransferModalOpen,
    setIsTransferModalOpen,
    addTransfer,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const banking = bankingMessages[language];

  const [step, setStep] = useState(1);
  const [transferType, setTransferType] = useState<TransferType>('canada');
  const [sourceAccountId, setSourceAccountId] = useState<string>(accounts[0]?.id || 'acc_1');
  const [recipientName, setRecipientName] = useState('');
  const [amountInput, setAmountInput] = useState('1000');
  const [motive, setMotive] = useState('');

  // Canada fields
  const [transitNumber, setTransitNumber] = useState('');
  const [institutionNumber, setInstitutionNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [interacEmail, setInteracEmail] = useState('');

  // Eurozone fields
  const [iban, setIban] = useState('');
  const [bicSwift, setBICSwift] = useState('');

  // USA fields
  const [routingNumber, setRoutingNumber] = useState('');
  const [wireMethod, setWireMethod] = useState<'ach' | 'domestic'>('ach');

  // Swiss fields
  const [swissIban, setSwissIban] = useState('');
  const [clearingNumber, setClearingNumber] = useState('');

  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [targetCurrOverride, setTargetCurrOverride] = useState<string | null>(null);

  const clearError = (field: string) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const getTargetCurrency = (type: TransferType): string => {
    if (type === 'canada') return 'CAD';
    if (type === 'eurozone') return 'EUR';
    if (type === 'usa') return 'USD';
    if (type === 'swiss') return 'CHF';
    if (type === 'uk') return 'GBP';
    if (type === 'latam') return targetCurrOverride || 'BRL';
    if (type === 'africa') return targetCurrOverride || 'XOF';
    return 'EUR';
  };

  const targetCurr = getTargetCurrency(transferType);
  const numericAmount = parseFloat(amountInput) || 0;
  const sourceAccount = accounts.find((a) => a.id === sourceAccountId) || accounts[0];

  // Convert amount from source account currency to target currency using convertAnyAmount
  const convertedTargetAmount = convertAnyAmount(numericAmount, sourceAccount?.currency, targetCurr, rates);

  const handleNextStep = () => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!recipientName.trim()) {
        newErrors.recipientName = language === 'fr' ? 'Le nom du bénéficiaire est obligatoire.' : 'Recipient name is required.';
      }
    } else if (step === 2) {
      if (transferType === 'eurozone') {
        if (!iban.trim()) {
          newErrors.iban = language === 'fr' ? "L'IBAN est obligatoire." : 'IBAN is required.';
        }
        if (!bicSwift.trim()) {
          newErrors.bicSwift = language === 'fr' ? 'Le code BIC/SWIFT est obligatoire.' : 'BIC/SWIFT code is required.';
        }
      } else if (transferType === 'usa') {
        if (!routingNumber.trim()) {
          newErrors.routingNumber = language === 'fr' ? "Le numéro d'acheminement (Routing Number) est obligatoire." : 'Routing number is required.';
        }
        if (!accountNumber.trim()) {
          newErrors.accountNumber = language === 'fr' ? 'Le numéro de compte est obligatoire.' : 'Account number is required.';
        }
      } else if (transferType === 'swiss') {
        if (!swissIban.trim()) {
          newErrors.swissIban = language === 'fr' ? "L'IBAN suisse est obligatoire." : 'Swiss IBAN is required.';
        }
        if (!clearingNumber.trim()) {
          newErrors.clearingNumber = language === 'fr' ? 'Le numéro Clearing est obligatoire.' : 'Clearing number is required.';
        }
      } else if (transferType === 'uk') {
        if (!routingNumber.trim()) {
          newErrors.routingNumber = language === 'fr' ? 'Le Sort Code (Code de tri) est obligatoire.' : 'Sort Code is required.';
        }
        if (!accountNumber.trim()) {
          newErrors.accountNumber = language === 'fr' ? 'Le numéro de compte est obligatoire.' : 'Account number is required.';
        }
      } else if (transferType === 'latam') {
        if (!accountNumber.trim()) {
          newErrors.accountNumber = language === 'fr' ? 'Le numéro de compte / CLABE est obligatoire.' : 'Account number or CLABE is required.';
        }
        if (!iban.trim()) {
          newErrors.iban = language === 'fr' ? 'Le nom de la banque est obligatoire.' : 'Bank name is required.';
        }
      } else if (transferType === 'africa') {
        if (!accountNumber.trim()) {
          newErrors.accountNumber = language === 'fr' ? 'Le numéro de compte ou RIB est obligatoire.' : 'Account number or RIB is required.';
        }
        if (!bicSwift.trim()) {
          newErrors.bicSwift = language === 'fr' ? 'Le code BIC / SWIFT / Banque est obligatoire.' : 'BIC / SWIFT or Bank code is required.';
        }
      } else if (transferType === 'canada') {
        const hasTransit = !!transitNumber.trim();
        const hasInst = !!institutionNumber.trim();
        const hasAcc = !!accountNumber.trim();
        const hasInterac = !!interacEmail.trim();

        const isDirectDepositAttempt = hasTransit || hasInst || hasAcc;
        const isInteracAttempt = hasInterac;

        if (!isDirectDepositAttempt && !isInteracAttempt) {
          newErrors.canadaSelection = language === 'fr'
            ? 'Veuillez remplir soit le courriel Interac, soit les coordonnées de dépôt direct (Transit, Institution et Compte).'
            : 'Please fill either Interac email or direct deposit details (Transit, Institution, and Account).';
          newErrors.interacEmail = ' ';
          newErrors.transitNumber = ' ';
          newErrors.institutionNumber = ' ';
          newErrors.accountNumber = ' ';
        } else if (isDirectDepositAttempt) {
          if (!transitNumber.trim()) {
            newErrors.transitNumber = language === 'fr' ? 'Le numéro de transit est requis.' : 'Transit number is required.';
          }
          if (!institutionNumber.trim()) {
            newErrors.institutionNumber = language === 'fr' ? "Le numéro d'institution est requis." : 'Institution number is required.';
          }
          if (!accountNumber.trim()) {
            newErrors.accountNumber = language === 'fr' ? 'Le numéro de compte est requis.' : 'Account number is required.';
          }
        } else if (isInteracAttempt) {
          if (!interacEmail.trim()) {
            newErrors.interacEmail = language === 'fr' ? 'Le courriel Interac est requis.' : 'Interac email is required.';
          } else if (!interacEmail.includes('@')) {
            newErrors.interacEmail = language === 'fr' ? 'Veuillez saisir un courriel valide.' : 'Please enter a valid email.';
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handlePrevStep = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNextStep();
      return;
    }

    const newErrors: Record<string, string> = {};
    if (!recipientName.trim()) {
      newErrors.recipientName = language === 'fr' ? 'Le nom du bénéficiaire est obligatoire.' : 'Recipient name is required.';
    }
    if (numericAmount <= 0) {
      newErrors.amountInput = language === 'fr' ? 'Le montant doit être supérieur à 0.' : 'Amount must be greater than 0.';
    }

    const availableBalance = sourceAccount?.availableBalance ?? sourceAccount?.balance ?? 0;
    if (numericAmount > availableBalance) {
      newErrors.amountInput = `${t.amountToSend}: ${formatDirectCurrency(
        numericAmount,
        sourceAccount?.currency,
        language,
      )}. ${banking.accounts.availableBalance}: ${formatDirectCurrency(
        availableBalance,
        sourceAccount?.currency,
        language,
      )}.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    let recipientAccountStr = '';
    if (transferType === 'canada') {
      recipientAccountStr = interacEmail
        ? `Interac: ${interacEmail}`
        : `Inst: ${institutionNumber} | Transit: ${transitNumber} | Acc: ${accountNumber}`;
    } else if (transferType === 'eurozone') {
      recipientAccountStr = iban;
    } else if (transferType === 'usa') {
      recipientAccountStr = `ABA: ${routingNumber} | Acc: ${accountNumber}`;
    } else if (transferType === 'swiss') {
      recipientAccountStr = swissIban;
    } else if (transferType === 'uk') {
      recipientAccountStr = `Sort: ${routingNumber} | Acc: ${accountNumber}`;
    } else if (transferType === 'latam') {
      recipientAccountStr = `CLABE/CPF: ${accountNumber} | Banque: ${iban}`;
    } else if (transferType === 'africa') {
      recipientAccountStr = `RIB/Acc: ${accountNumber} | BIC: ${bicSwift}`;
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');
      await addTransfer({
        sourceAccountId,
        recipientName,
        recipientAccount: recipientAccountStr,
        transferType,
        amount: numericAmount,
        currency: sourceAccount?.currency,
        convertedAmount: convertedTargetAmount,
        targetCurrency: targetCurr,
        details: {
          institutionNumber,
          transitNumber,
          routingNumber,
          interacEmail,
          bicSwift,
          clearingNumber,
          motive,
        },
      });
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        setIsTransferModalOpen(false);
        setRecipientName('');
        setStep(1);
      }, 2500);
    } catch (caughtError) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : 'L’instruction n’a pas pu être enregistrée.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isTransferModalOpen) return null;

  const stepsLabels = {
    fr: ['Destinataire', 'Coordonnées externes', 'Montant'],
    en: ['Recipient', 'External details', 'Amount'],
    es: ['Destinatario', 'Datos externos', 'Monto'],
    de: ['Empfänger', 'Externe Daten', 'Betrag'],
  };

  const stepNames = stepsLabels[language] || stepsLabels.fr;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8"
        >
          {/* Header */}
          <div className="bg-slate-900 p-6 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold">{t.newTransferTitle}</h3>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Instruction préparée dans Monalyz — exécution hors application
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsTransferModalOpen(false)}
              id="close-transfer-modal-btn"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!isSuccess && (
            /* Steps tracker */
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
                            ? 'bg-blue-600 text-white'
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
              <h3 className="text-xl font-extrabold text-slate-900">{t.transferSuccessMsg}</h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                {banking.common.internalOperationsNotice}{' '}
                {banking.transfers.progressHint}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs sm:text-sm">
              {(submitError || Object.values(errors).some((err) => err && err.trim() !== '')) && (
                <div className="bg-rose-50 text-rose-800 border border-rose-200/60 p-3.5 rounded-2xl flex items-start space-x-2.5" id="wire-error-banner">
                  <span className="text-base">⚠️</span>
                  <div className="text-xs">
                    <p className="font-bold">
                      {language === 'fr' 
                        ? 'Veuillez remplir tous les champs obligatoires en rouge :' 
                        : 'Please fill all required fields in red :'}
                    </p>
                    <ul className="list-disc list-inside mt-1 font-medium space-y-0.5">
                      {submitError && <li>{submitError}</li>}
                      {Object.values(errors).filter((err) => err && err.trim() !== '').map((err, idx) => (
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
                    className="space-y-5"
                  >
                    {/* Destination Selector */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-800">{t.destinationType}</label>
                      <select
                        value={transferType}
                        onChange={(e) => {
                          setTransferType(e.target.value as TransferType);
                          setTargetCurrOverride(null);
                          setErrors({});
                        }}
                        id="select-transfer-destination"
                        className="w-full px-3.5 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer text-sm"
                      >
                        <option value="canada">🇨🇦 CANADA (CAD)</option>
                        <option value="eurozone">🇪🇺 ZONE EURO (EUR)</option>
                        <option value="usa">🇺🇸 ÉTATS-UNIS (USD)</option>
                        <option value="swiss">🇨🇭 SUISSE (CHF)</option>
                        <option value="uk">🇬🇧 ROYAUME-UNI (GBP)</option>
                        <option value="latam">🌎 AMÉR. LATINE</option>
                        <option value="africa">🌍 AFRIQUE</option>
                      </select>
                    </div>

                    {/* Source Account & Recipient Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">{t.sourceAccount}</label>
                        <select
                          value={sourceAccountId}
                          onChange={(e) => setSourceAccountId(e.target.value)}
                          id="wire-source-account-select"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id} className="bg-white text-slate-900">
                              {acc.name} — {banking.accounts.availableBalance}:{' '}
                              {formatDirectCurrency(
                                acc.availableBalance ?? acc.balance,
                                acc.currency,
                                language,
                              )}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">{t.recipientName} *</label>
                        <input
                          type="text"
                          required
                          placeholder="ex: Claire Dupont"
                          value={recipientName}
                          onChange={(e) => {
                            setRecipientName(e.target.value);
                            clearError('recipientName');
                          }}
                          id="wire-recipient-name-input"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400 font-bold focus:ring-2 outline-none transition-colors ${
                            errors.recipientName
                              ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                              : 'border-slate-200 focus:ring-blue-500'
                          }`}
                        />
                        {errors.recipientName && (
                          <p className="text-rose-600 text-xs mt-1.5 font-bold flex items-center" id="error-recipientName">
                            <span className="mr-1">⚠️</span> {errors.recipientName}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Dynamic Country-Specific Form Fields */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                      {transferType === 'canada' && (
                        <div className="space-y-3">
                          {errors.canadaSelection && (
                            <p className="text-rose-600 text-xs font-bold bg-rose-50 p-2 rounded-lg border border-rose-100 flex items-center">
                              <span className="mr-1.5">⚠️</span> {errors.canadaSelection}
                            </p>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">{t.transitNumber} *</label>
                              <input
                                type="text"
                                maxLength={5}
                                value={transitNumber}
                                placeholder="12345"
                                onChange={(e) => {
                                  setTransitNumber(e.target.value.replace(/\D/g, ''));
                                  clearError('transitNumber');
                                  clearError('canadaSelection');
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                  errors.transitNumber
                                    ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                              />
                              {errors.transitNumber && errors.transitNumber.trim() !== '' && (
                                <p className="text-rose-600 text-[10px] mt-1 font-bold">⚠️ {errors.transitNumber}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">{t.institutionNumber} *</label>
                              <input
                                type="text"
                                maxLength={3}
                                value={institutionNumber}
                                placeholder="003"
                                onChange={(e) => {
                                  setInstitutionNumber(e.target.value.replace(/\D/g, ''));
                                  clearError('institutionNumber');
                                  clearError('canadaSelection');
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                  errors.institutionNumber
                                    ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                              />
                              {errors.institutionNumber && errors.institutionNumber.trim() !== '' && (
                                <p className="text-rose-600 text-[10px] mt-1 font-bold">⚠️ {errors.institutionNumber}</p>
                              )}
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <label className="block text-xs font-bold text-slate-700 mb-1">{t.accountNumber} *</label>
                              <input
                                type="text"
                                value={accountNumber}
                                placeholder="1234567"
                                onChange={(e) => {
                                  setAccountNumber(e.target.value.replace(/\D/g, ''));
                                  clearError('accountNumber');
                                  clearError('canadaSelection');
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                  errors.accountNumber
                                    ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                              />
                              {errors.accountNumber && errors.accountNumber.trim() !== '' && (
                                <p className="text-rose-600 text-[10px] mt-1 font-bold">⚠️ {errors.accountNumber}</p>
                              )}
                            </div>
                          </div>
                          <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase">OU</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">{t.interacEmail} *</label>
                            <input
                              type="email"
                              placeholder="virement.interac@exemple.ca"
                              value={interacEmail}
                              onChange={(e) => {
                                  setInteracEmail(e.target.value);
                                  clearError('interacEmail');
                                  clearError('canadaSelection');
                                }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 placeholder-slate-400 text-xs focus:ring-2 outline-none transition-colors ${
                                errors.interacEmail
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.interacEmail && errors.interacEmail.trim() !== '' && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.interacEmail}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {transferType === 'eurozone' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">{t.ibanLabel} *</label>
                            <input
                              type="text"
                              value={iban}
                              placeholder="FR76 3000 4012 3456 7890 1234 567"
                              onChange={(e) => {
                                setIban(e.target.value);
                                clearError('iban');
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                errors.iban
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.iban && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.iban}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">{t.bicSwiftLabel} *</label>
                            <input
                              type="text"
                              value={bicSwift}
                              placeholder="BNPAFRPPXXX"
                              onChange={(e) => {
                                setBICSwift(e.target.value);
                                clearError('bicSwift');
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                errors.bicSwift
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.bicSwift && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.bicSwift}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {transferType === 'usa' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">{t.routingNumberLabel} *</label>
                            <input
                              type="text"
                              maxLength={9}
                              value={routingNumber}
                              placeholder="123456789"
                              onChange={(e) => {
                                setRoutingNumber(e.target.value.replace(/\D/g, ''));
                                clearError('routingNumber');
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                errors.routingNumber
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.routingNumber && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.routingNumber}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">{t.accountNumber} *</label>
                            <input
                              type="text"
                              value={accountNumber}
                              placeholder="123456789012"
                              onChange={(e) => {
                                setAccountNumber(e.target.value.replace(/\D/g, ''));
                                clearError('accountNumber');
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                errors.accountNumber
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.accountNumber && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.accountNumber}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">{t.transferMethod} *</label>
                            <select
                              value={wireMethod}
                              onChange={(e) => setWireMethod(e.target.value as 'ach' | 'domestic')}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                              <option value="ach" className="bg-white text-slate-900">{t.wireTypeAch}</option>
                              <option value="domestic" className="bg-white text-slate-900">{t.wireTypeDomestic}</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {transferType === 'swiss' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">IBAN / QR-IBAN Suisse *</label>
                            <input
                              type="text"
                              value={swissIban}
                              placeholder="CH93 0023 0230 1234 5678 9"
                              onChange={(e) => {
                                setSwissIban(e.target.value);
                                clearError('swissIban');
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                errors.swissIban
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.swissIban && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.swissIban}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">No Clearing *</label>
                            <input
                              type="text"
                              value={clearingNumber}
                              placeholder="230"
                              onChange={(e) => {
                                setClearingNumber(e.target.value.replace(/\D/g, ''));
                                clearError('clearingNumber');
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                errors.clearingNumber
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.clearingNumber && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.clearingNumber}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {transferType === 'uk' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Sort Code (Code de tri) *</label>
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="ex: 200415"
                              value={routingNumber}
                              onChange={(e) => {
                                setRoutingNumber(e.target.value.replace(/\D/g, ''));
                                clearError('routingNumber');
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                errors.routingNumber
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.routingNumber && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.routingNumber}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Numéro de compte (Account Number) *</label>
                            <input
                              type="text"
                              maxLength={8}
                              placeholder="ex: 12345678"
                              value={accountNumber}
                              onChange={(e) => {
                                setAccountNumber(e.target.value.replace(/\D/g, ''));
                                clearError('accountNumber');
                              }}
                              className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                errors.accountNumber
                                  ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                  : 'border-slate-200 focus:ring-blue-500'
                              }`}
                            />
                            {errors.accountNumber && (
                              <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.accountNumber}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {transferType === 'latam' && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="block text-xs font-bold text-slate-700">Sélectionnez la devise de réception *</label>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {[
                                { code: 'BRL', flag: '🇧🇷', label: 'BRL (Brésil)' },
                                { code: 'MXN', flag: '🇲🇽', label: 'MXN (Mexique)' },
                                { code: 'COP', flag: '🇨🇴', label: 'COP (Colombie)' },
                                { code: 'ARS', flag: '🇦🇷', label: 'ARS (Argentine)' },
                              ].map((item) => (
                                <button
                                  key={item.code}
                                  type="button"
                                  onClick={() => setTargetCurrOverride(item.code)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 ${
                                    targetCurr === item.code
                                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>{item.flag}</span>
                                  <span>{item.code}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Numéro de compte / CLABE / CPF *</label>
                              <input
                                type="text"
                                placeholder="ex: 13870001000100 ou CLABE"
                                value={accountNumber}
                                onChange={(e) => {
                                  setAccountNumber(e.target.value.replace(/\D/g, ''));
                                  clearError('accountNumber');
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                  errors.accountNumber
                                    ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                              />
                              {errors.accountNumber && (
                                <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.accountNumber}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Établissement destinataire déclaré *</label>
                              <input
                                type="text"
                                placeholder="ex: Banco do Brasil, Banamex"
                                value={iban}
                                onChange={(e) => {
                                  setIban(e.target.value);
                                  clearError('iban');
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 text-xs focus:ring-2 outline-none transition-colors ${
                                  errors.iban
                                    ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                              />
                              {errors.iban && (
                                <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.iban}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {transferType === 'africa' && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="block text-xs font-bold text-slate-700">Sélectionnez la devise de réception *</label>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {[
                                { code: 'XOF', flag: '🇸🇳', label: 'Franc CFA (BCEAO)' },
                                { code: 'MAD', flag: '🇲🇦', label: 'MAD (Maroc)' },
                                { code: 'ZAR', flag: '🇿🇦', label: 'ZAR (Afrique du Sud)' },
                                { code: 'EGP', flag: '🇪🇬', label: 'EGP (Égypte)' },
                                { code: 'NGN', flag: '🇳🇬', label: 'NGN (Nigeria)' },
                              ].map((item) => (
                                <button
                                  key={item.code}
                                  type="button"
                                  onClick={() => setTargetCurrOverride(item.code)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 ${
                                    targetCurr === item.code
                                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>{item.flag}</span>
                                  <span>{item.code}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Numéro de compte / RIB *</label>
                              <input
                                type="text"
                                placeholder="Numéro de compte ou RIB"
                                value={accountNumber}
                                onChange={(e) => {
                                  setAccountNumber(e.target.value.replace(/\D/g, ''));
                                  clearError('accountNumber');
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                  errors.accountNumber
                                    ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                              />
                              {errors.accountNumber && (
                                <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.accountNumber}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Code externe BIC / SWIFT / établissement *</label>
                              <input
                                type="text"
                                placeholder="ex: SGABSNDAKAR, Attijariwafa"
                                value={bicSwift}
                                onChange={(e) => {
                                  setBICSwift(e.target.value);
                                  clearError('bicSwift');
                                }}
                                className={`w-full px-3 py-2 rounded-xl border bg-white text-slate-900 font-mono text-xs focus:ring-2 outline-none transition-colors ${
                                  errors.bicSwift
                                    ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                              />
                              {errors.bicSwift && (
                                <p className="text-rose-600 text-[11px] mt-1 font-bold">⚠️ {errors.bicSwift}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Motif du virement (optionnel)</label>
                      <input
                        type="text"
                        placeholder="ex: Facture #4029"
                        value={motive}
                        onChange={(e) => setMotive(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Amount & Real-Time Exchange Rate Conversion Box */}
                    <div className="bg-blue-900 text-white p-4 rounded-2xl space-y-3 border border-blue-800 shadow-md">
                      <div className="flex items-center justify-end">
                        <span className="text-[10px] text-emerald-300 font-mono font-bold">
                          1 {sourceAccount?.currency} = {convertAnyAmount(1, sourceAccount?.currency, targetCurr, rates).toFixed(4)} {targetCurr}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="block text-xs text-blue-100 mb-1 font-bold">{t.amountToSend} ({sourceAccount?.currency})</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={amountInput}
                            onChange={(e) => {
                              setAmountInput(e.target.value);
                              clearError('amountInput');
                            }}
                            id="wire-amount-input"
                            className={`w-full px-3.5 py-2 rounded-xl bg-white/10 text-white font-extrabold text-lg border outline-none focus:ring-2 transition-colors ${
                              errors.amountInput
                                ? 'border-rose-400 focus:ring-rose-500 bg-rose-950/40 text-rose-100'
                                : 'border-white/20 focus:ring-white'
                            }`}
                          />
                          {errors.amountInput && (
                            <p className="text-rose-200 text-xs mt-1 font-semibold">⚠️ {errors.amountInput}</p>
                          )}
                        </div>

                        <div className="bg-blue-950/80 p-3 rounded-xl border border-blue-700">
                          <p className="text-[11px] text-blue-200 mb-0.5 font-bold">{t.amountToReceive} ({targetCurr})</p>
                          <p className="text-lg sm:text-xl font-extrabold text-emerald-300">
                            {formatDirectCurrency(convertedTargetAmount, targetCurr, language)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-blue-100 pt-2 border-t border-blue-800/80">
                        <span>Frais externes : <strong className="text-amber-200">non connus par Monalyz</strong></span>
                        <span>Taux indicatif au {new Date(rates.updatedAt).toLocaleString(language)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 text-xs space-y-1">
                      <p className="font-bold text-slate-800">{t.newTransferTitle}</p>
                      <p>Bénéficiaire : <strong className="text-slate-900">{recipientName}</strong></p>
                      <p>{t.sourceAccount}: <strong className="text-slate-900">{sourceAccount?.name}</strong></p>
                      {motive && <p>Motif : <strong className="text-slate-900">{motive}</strong></p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {step > 1 ? (
                  <button
                    key="back-btn"
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition text-xs flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{language === 'fr' ? 'Retour' : 'Back'}</span>
                  </button>
                ) : (
                  <button
                    key="close-btn"
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition text-xs"
                  >
                    {t.close}
                  </button>
                )}

                {step < 3 ? (
                  <button
                    key="next-btn"
                    type="button"
                    onClick={handleNextStep}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold transition text-xs flex items-center space-x-1"
                  >
                    <span>{language === 'fr' ? 'Continuer' : 'Next'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    key="submit-btn"
                    type="submit"
                    disabled={isSubmitting}
                    id="submit-wire-transfer-btn"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold transition shadow-md text-xs flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Enregistrement…' : 'Enregistrer l’instruction'}</span>
                  </button>
                )}
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
