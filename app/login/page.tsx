'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ShieldCheck, Lock, Mail, ArrowRight, UserCheck, KeyRound, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const { setRole } = useAppStore();
  const [email, setEmail] = useState('thomas.martin@example.com');
  const [pin, setPin] = useState('1234');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !pin) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    if (pin.length < 4) {
      setError('Le code PIN doit comporter 4 chiffres.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setRole('user');
      router.push('/myaccount');
    }, 600);
  };

  const handleQuickDemoFill = () => {
    setEmail('thomas.martin@example.com');
    setPin('1234');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="flex items-center justify-center space-x-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono">NovaBank</span>
        </div>
        <h2 className="text-xl font-bold text-slate-200">Connexion à votre espace client</h2>
        <p className="mt-1 text-xs text-slate-400">Accès sécurisé par authentification forte</p>
      </div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0"
      >
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl border border-slate-200 sm:px-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Adresse e-mail
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
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Code PIN (4 chiffres)
                </label>
                <Link
                  href="/reset-pin"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  PIN oublié ?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-mono tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-extrabold text-sm transition shadow-lg shadow-blue-600/25 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>Connexion en cours...</span>
              ) : (
                <>
                  <span>Accéder à mon compte</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fill helper */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleQuickDemoFill}
              type="button"
              className="text-xs text-slate-600 hover:text-blue-600 font-bold flex items-center space-x-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Remplir démo (Thomas Martin)</span>
            </button>
            <Link
              href="/admin-login"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center space-x-1 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Connexion Admin</span>
            </Link>
          </div>
        </div>

        {/* Footer Register Link */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-400">
            Vous n&apos;avez pas encore de compte bancaire ?{' '}
            <Link href="/register" className="font-extrabold text-blue-400 hover:text-blue-300 hover:underline">
              Ouvrir un compte (2 min) →
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
