'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ShieldCheck, Mail, KeyRound, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ResetPinPage() {
  const router = useRouter();
  const { sendOtpEmail, setIsEmailDrawerOpen } = useAppStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState('thomas.martin@example.com');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  // Countdown timer for OTP
  const [countdown, setCountdown] = useState(60);
  const canResend = countdown === 0;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    setError('');
    const code = sendOtpEmail(email);
    setGeneratedOtp(code);
    setStep(2);
    setCountdown(60);
  };

  const handleResendOtp = () => {
    setError('');
    const code = sendOtpEmail(email);
    setGeneratedOtp(code);
    setCountdown(60);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // For demo convenience, allow generatedOtp or 123456
    if (enteredOtp !== generatedOtp && enteredOtp !== '123456') {
      setError('Code OTP incorrect. Consultez votre boîte e-mail ou utilisez le bouton "Voir E-mails".');
      return;
    }

    setStep(3);
  };

  const handleResetPin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPin.length < 4) {
      setError('Le code PIN doit comporter 4 chiffres.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('Les deux codes PIN ne correspondent pas.');
      return;
    }

    setStep(4);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="flex items-center justify-center space-x-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-white font-mono">NovaBank</span>
        </div>
        <h2 className="text-xl font-bold text-slate-200">Réinitialisation du code PIN</h2>
        <p className="mt-1 text-xs text-slate-400">Procédure de sécurité sécurisée par e-mail</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0"
      >
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl border border-slate-200 sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Enter email */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Saisissez votre e-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-sm transition shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2"
              >
                <span>Envoyer le code de vérification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: Enter OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                <p className="font-bold">Code OTP envoyé à {email}</p>
                <p className="text-blue-700">Consultez votre boîte e-mail transactionnelle ou le simulateur.</p>
                <button
                  type="button"
                  onClick={() => setIsEmailDrawerOpen(true)}
                  className="text-[11px] text-blue-600 font-extrabold underline pt-1 block"
                >
                  📨 Ouvrir le tiroir des e-mails envoyés
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Code à 6 chiffres
                  </label>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    ⏱️ {countdown > 0 ? `${countdown}s` : 'Expiré'}
                  </span>
                </div>

                <input
                  type="text"
                  maxLength={6}
                  required
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />

                <div className="mt-2 text-center">
                  <p className="text-[11px] text-amber-600 font-medium">💡 Astuce : Vérifiez aussi votre dossier Spams.</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={!canResend}
                  onClick={handleResendOtp}
                  className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-40 disabled:hover:no-underline flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Renvoyer le code</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs transition shadow-md"
                >
                  Vérifier
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Enter new PIN */}
          {step === 3 && (
            <form onSubmit={handleResetPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Nouveau code PIN (4 chiffres)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Confirmer le code PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-sm transition shadow-lg shadow-emerald-600/20"
              >
                Enregistrer le nouveau PIN
              </button>
            </form>
          )}

          {/* STEP 4: Success Confirmation */}
          {step === 4 && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">PIN réinitialisé !</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Votre nouveau code PIN a été mis à jour avec succès. Vous pouvez maintenant vous connecter à votre espace bancaire.
              </p>

              <button
                onClick={() => router.push('/login')}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs transition shadow-md"
              >
                Retour à la page de connexion
              </button>
            </div>
          )}

          {/* Bottom Link Back */}
          {step < 4 && (
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <Link href="/login" className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center justify-center space-x-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à la connexion</span>
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
