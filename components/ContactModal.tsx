'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { X, Headphones, Send, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ContactModal() {
  const { language, isContactModalOpen, setIsContactModalOpen } = useAppStore();
  const t = translations[language] || translations.fr;

  const [step, setStep] = useState(1);
  const [subject, setSubject] = useState('Question sur un virement');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isContactModalOpen) return null;

  const clearError = (field: string) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const handleNextStep = () => {
    if (step === 1 && !message.trim()) {
      setErrors({
        message: language === 'fr' ? 'Veuillez rédiger un message.' : 'Please enter a message.',
      });
      return;
    }
    setErrors({});
    setStep(2);
  };

  const handlePrevStep = () => {
    setErrors({});
    setStep(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      handleNextStep();
      return;
    }
    if (!message.trim()) {
      setErrors({
        message: language === 'fr' ? 'Veuillez rédiger un message.' : 'Please enter a message.',
      });
      return;
    }
    setErrors({});
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setIsContactModalOpen(false);
      setMessage('');
      setStep(1);
    }, 1800);
  };

  const stepsLabels = {
    fr: ['Rédaction', 'Vérification'],
    en: ['Message', 'Verification'],
    es: ['Mensaje', 'Verificación'],
    de: ['Nachricht', 'Überprüfung'],
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
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">{t.needHelp}</h3>
                <p className="text-xs text-slate-400">Support client NovaBank 24/7</p>
              </div>
            </div>
            <button
              onClick={() => setIsContactModalOpen(false)}
              id="close-contact-modal-btn"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!sent && (
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

          {sent ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">Message envoyé avec succès !</h4>
              <p className="text-xs text-slate-600 font-medium">Un conseiller bancaire vous répondra sous 15 minutes.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
              {Object.keys(errors).length > 0 && (
                <div className="bg-rose-50 text-rose-800 border border-rose-200/60 p-3 rounded-2xl flex items-start space-x-2.5" id="contact-error-banner">
                  <span className="text-base">⚠️</span>
                  <div className="text-xs">
                    <p className="font-bold">
                      {language === 'fr' 
                        ? 'Veuillez remplir tous les champs obligatoires en rouge :' 
                        : 'Please fill all required fields in red :'}
                    </p>
                    <ul className="list-disc list-inside mt-1 font-medium">
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
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Sujet de votre demande</label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Question sur un virement" className="bg-white text-slate-900">Question sur un virement</option>
                        <option value="Suivi de demande de prêt" className="bg-white text-slate-900">Suivi de demande de prêt</option>
                        <option value="Contrôle de conformité" className="bg-white text-slate-900">Contrôle de conformité</option>
                        <option value="Assistance technique" className="bg-white text-slate-900">Assistance technique</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Votre message *</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Décrivez votre question ou problème..."
                        value={message}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          clearError('message');
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 font-bold text-slate-900 placeholder-slate-400 outline-none focus:ring-2 resize-none transition-colors ${
                          errors.message
                            ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/10'
                            : 'border-slate-200 focus:ring-blue-500'
                        }`}
                      />
                      {errors.message && (
                        <p className="text-rose-600 text-xs mt-1 font-bold">⚠️ {errors.message}</p>
                      )}
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
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-600">
                      <p className="font-bold text-slate-800">Résumé du message :</p>
                      <p>Sujet : <strong className="text-slate-900">{subject}</strong></p>
                      <p className="whitespace-pre-wrap mt-2 p-2 bg-white rounded-xl border border-slate-100 max-h-32 overflow-y-auto italic">
                        &quot;{message}&quot;
                      </p>
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
                    onClick={() => setIsContactModalOpen(false)}
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
                    type="submit"
                    id="send-support-message-btn"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs transition shadow-md flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer au support</span>
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
