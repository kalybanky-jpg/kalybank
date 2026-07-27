'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency, formatDirectCurrency } from '@/lib/currency';
import { X, Download, FileSpreadsheet, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AccountStatementsModal() {
  const {
    language,
    currency,
    rates,
    accounts,
    isStatementsModalOpen,
    setIsStatementsModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  const [step, setStep] = useState(1);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || 'acc_1');
  const [period, setPeriod] = useState('2024-05');
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [isGenerated, setIsGenerated] = useState(false);

  if (!isStatementsModalOpen) return null;

  const handleNextStep = () => {
    if (step === 1 && !period) {
      alert(language === 'fr' ? 'Veuillez sélectionner une période.' : 'Please select a period.');
      return;
    }
    setStep(2);
  };

  const handlePrevStep = () => {
    setStep(1);
  };

  const handleDownload = () => {
    setIsGenerated(true);
    setTimeout(() => {
      setIsGenerated(false);
      setIsStatementsModalOpen(false);
      setStep(1);
    }, 1500);
  };

  const activeAccount = accounts.find((acc) => acc.id === selectedAccountId) || accounts[0];

  const stepsLabels = {
    fr: ['Compte & Période', 'Format & Téléchargement'],
    en: ['Account & Period', 'Format & Download'],
    es: ['Cuenta y Período', 'Formato y Descarga'],
    de: ['Konto & Zeitraum', 'Format & Herunterladen'],
  };

  const stepNames = stepsLabels[language] || stepsLabels.fr;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold">{t.myStatements}</h3>
            </div>
            <button
              onClick={() => setIsStatementsModalOpen(false)}
              id="close-statements-modal-btn"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!isGenerated && (
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
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
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

          {isGenerated ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">
                {language === 'fr' ? 'Relevé généré avec succès !' : 'Statement generated successfully!'}
              </h4>
              <p className="text-xs text-slate-600 font-medium">
                {language === 'fr' ? 'Le fichier a été préparé pour le téléchargement.' : 'The file has been prepared for download.'}
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-4 text-xs sm:text-sm">
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
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Sélectionner le compte</label>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id} className="bg-white text-slate-900">
                            {acc.name} ({formatDirectCurrency(acc.balance, acc.currency, language)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Période du relevé</label>
                      <input
                        type="month"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      />
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
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Format de fichier</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setFormat('pdf')}
                          className={`p-3 rounded-2xl border text-center font-bold flex flex-col items-center justify-center space-y-1 transition ${
                            format === 'pdf' ? 'border-blue-600 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Download className="w-4 h-4 text-blue-600" />
                          <span className="text-xs">Format PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormat('csv')}
                          className={`p-3 rounded-2xl border text-center font-bold flex flex-col items-center justify-center space-y-1 transition ${
                            format === 'csv' ? 'border-blue-600 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                          <span className="text-xs">Format CSV</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-[11px] leading-relaxed">
                      <p className="font-bold text-slate-800 mb-1">Résumé du document :</p>
                      <p>Type : <strong>Relevé mensuel officiel</strong></p>
                      <p>Compte : <strong>{activeAccount?.name || 'Compte courant'}</strong></p>
                      <p>Période : <strong>{period}</strong></p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{language === 'fr' ? 'Retour' : 'Back'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsStatementsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50"
                  >
                    {t.close}
                  </button>
                )}

                {step < 2 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center space-x-1"
                  >
                    <span>{language === 'fr' ? 'Continuer' : 'Next'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleDownload}
                    id="confirm-download-statement-btn"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs transition shadow-md flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{language === 'fr' ? 'Télécharger' : 'Download'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
