'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency, formatDirectCurrency } from '@/lib/currency';
import {
  X,
  FileText,
  Building2,
  UploadCloud,
  CheckCircle2,
  Calculator,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LoanApplicationModal() {
  const {
    language,
    currency,
    rates,
    isLoanModalOpen,
    setIsLoanModalOpen,
    addLoanApplication,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  const [step, setStep] = useState(1);
  const [motive, setMotive] = useState('Prêt personnel');
  const [requestedAmount, setRequestedAmount] = useState(8000);
  const [durationMonths, setDurationMonths] = useState(36);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  // Simple monthly payment estimation (3.5% interest rate baseline)
  const annualRate = 0.035;
  const monthlyRate = annualRate / 12;
  const estimatedMonthlyPayment =
    (requestedAmount * monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) /
    (Math.pow(1 + monthlyRate, durationMonths) - 1);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const invalid = selectedFiles.find(
        (file) =>
          file.size > 10 * 1024 * 1024 ||
          !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type),
      );
      if (invalid) {
        setErrors((current) => ({
          ...current,
          uploadedFiles: 'PDF, PNG ou JPEG uniquement, 10 Mo maximum par fichier.',
        }));
        return;
      }
      setUploadedFiles((prev) => [...prev, ...selectedFiles]);
      clearError('uploadedFiles');
    }
  };

  const handleNextStep = () => {
    const newErrors: Record<string, string> = {};
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
    if (uploadedFiles.length === 0) {
      newErrors.uploadedFiles = language === 'fr'
        ? 'Veuillez télécharger au moins un document justificatif (pièce d\'identité, justificatif de domicile ou de revenu) pour valider votre demande.'
        : 'Please upload at least one supporting document (ID, proof of address, or income statement) to submit your application.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      setIsSubmitting(true);
      await addLoanApplication({
        clientName: '',
        clientEmail: '',
        requestedAmount,
        approvedAmount: 0,
        currency,
        durationMonths,
        monthlyPayment: Math.round(estimatedMonthlyPayment),
        motive,
        disbursementAccount: 'Destination externe non connectée',
        nextDueDate: 'Non applicable avant contractualisation externe',
        evidenceFiles: uploadedFiles,
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsLoanModalOpen(false);
        setUploadedFiles([]);
        setStep(1);
      }, 2500);
    } catch (caughtError) {
      setErrors({
        submission:
          caughtError instanceof Error
            ? caughtError.message
            : 'La demande n’a pas pu être déposée.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoanModalOpen) return null;

  // Visual translations for step labels
  const stepsLabels = {
    fr: ['Informations', 'Simulation', 'Justificatifs'],
    en: ['Profile', 'Simulation', 'Documents'],
    es: ['Información', 'Simulación', 'Documentos'],
    de: ['Informationen', 'Simulation', 'Unterlagen'],
  };

  const stepNames = stepsLabels[language] || stepsLabels.fr;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
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
                <h3 className="text-base sm:text-lg font-extrabold">{t.loanApplicationTitle}</h3>
                <p className="text-[11px] sm:text-xs text-slate-400">Simulation en temps réel et dépôt de dossier</p>
              </div>
            </div>
            <button
              onClick={() => setIsLoanModalOpen(false)}
              id="close-loan-modal-btn"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
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
                PP-2024-DOSSIER
              </p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Votre demande est enregistrée pour étude. La simulation ne constitue
                ni une offre de crédit, ni une approbation, ni une promesse de versement.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs sm:text-sm">
              {Object.keys(errors).length > 0 && (
                <div className="bg-rose-50 text-rose-800 border border-rose-200/60 p-3.5 rounded-2xl flex items-start space-x-2.5" id="loan-error-banner">
                  <span className="text-base">⚠️</span>
                  <div className="text-xs">
                    <p className="font-bold">
                      {language === 'fr' 
                        ? 'Veuillez remplir tous les champs obligatoires en rouge :' 
                        : 'Please fill all required fields in red :'}
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
                      Le demandeur est identifié par la session Supabase Auth. Aucun
                      nom ou e-mail libre ne peut remplacer cette identité.
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t.loanMotive}</label>
                      <select
                        value={motive}
                        onChange={(e) => setMotive(e.target.value)}
                        id="loan-motive-select"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="Prêt personnel" className="bg-white text-slate-900">Prêt personnel</option>
                        <option value="Projet immobilier" className="bg-white text-slate-900">Projet immobilier</option>
                        <option value="Achat véhicule / Auto" className="bg-white text-slate-900">Achat véhicule / Auto</option>
                        <option value="Travaux / Rénovation" className="bg-white text-slate-900">Travaux / Rénovation</option>
                        <option value="Trésorerie entreprise" className="bg-white text-slate-900">Trésorerie entreprise</option>
                      </select>
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
                    {/* Amount Slider */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{t.requestedAmount}</span>
                        <span className="text-base font-extrabold text-emerald-700">
                          {formatDirectCurrency(requestedAmount, currency, language)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1000"
                        max="50000"
                        step="500"
                        value={requestedAmount}
                        onChange={(e) => setRequestedAmount(Number(e.target.value))}
                        id="loan-amount-slider"
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                        <span>{formatDirectCurrency(1000, currency, language)}</span>
                        <span>{formatDirectCurrency(25000, currency, language)}</span>
                        <span>{formatDirectCurrency(50000, currency, language)}</span>
                      </div>
                    </div>

                    {/* Duration Slider */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{t.durationLabel}</span>
                        <span className="text-base font-extrabold text-blue-700">
                          {durationMonths} mois ({Math.round(durationMonths / 12)} ans)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="84"
                        step="6"
                        value={durationMonths}
                        onChange={(e) => setDurationMonths(Number(e.target.value))}
                        id="loan-duration-slider"
                        className="w-full accent-blue-600 cursor-pointer"
                      />
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
                            {formatDirectCurrency(Math.round(estimatedMonthlyPayment), currency, language)} / mois
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-800 px-2.5 py-1 rounded-full text-emerald-100 font-mono font-bold">
                        Hypothèse indicative 3,5 %
                      </span>
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
                    {/* Upload Justificatif Dropzone */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">{t.uploadDocs} *</label>
                      <div className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
                        errors.uploadedFiles
                          ? 'border-rose-500 hover:border-rose-600 bg-rose-50/10'
                          : 'border-slate-300 hover:border-emerald-500 bg-slate-50'
                      }`}>
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                          id="loan-doc-upload-input"
                        />
                        <label htmlFor="loan-doc-upload-input" className="cursor-pointer space-y-1 block">
                          <UploadCloud className="w-7 h-7 text-emerald-600 mx-auto" />
                          <p className="text-xs font-bold text-slate-800">{t.dropzoneText}</p>
                          <p className="text-[10px] text-slate-500 font-medium">PDF, PNG, JPG (max 10MB)</p>
                        </label>
                      </div>
                      {errors.uploadedFiles && (
                        <p className="text-rose-600 text-xs mt-1.5 font-bold">⚠️ {errors.uploadedFiles}</p>
                      )}
                      {uploadedFiles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {uploadedFiles.map((file, idx) => (
                            <span key={idx} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                              ✓ {file.name}
                            </span>
                          ))}
                        </div>
                      )}
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
                    <span>{language === 'fr' ? 'Retour' : 'Back'}</span>
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

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold transition text-xs flex items-center space-x-1"
                  >
                    <span>{language === 'fr' ? 'Continuer' : 'Next'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    id="submit-loan-application-btn"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold transition shadow-md text-xs flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isSubmitting ? 'Dépôt…' : t.submitLoan}</span>
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
