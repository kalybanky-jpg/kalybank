'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { safeInternalPath } from '@/lib/security/navigation';

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  auth_callback: 'Le lien de connexion est invalide ou expiré.',
  auth_confirmation: 'Le lien de confirmation est invalide ou expiré.',
  configuration: 'La connexion Supabase doit être configurée par le déploiement.',
  session: 'Votre session a expiré ou a été révoquée. Reconnectez-vous.',
};

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    LOGIN_ERROR_MESSAGES[searchParams.get('error') ?? ''] ?? '',
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      const { data: kycRows } = await supabase
        .from('kyc_applications')
        .select('id')
        .limit(1);

      window.location.replace(
        safeInternalPath(searchParams.get('next'), kycRows?.length ? '/myaccount' : '/onboarding'),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Connexion impossible. Vérifiez vos identifiants.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="flex items-center justify-center space-x-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono">KALY</span>
        </div>
        <h1 className="text-xl font-bold text-slate-200">Connexion à votre espace</h1>
        <p className="mt-1 text-xs text-slate-400">
          KALY initie et suit vos instructions. Aucune banque n&apos;est connectée.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0"
      >
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl border border-slate-200 sm:px-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Adresse e-mail
              <span className="relative block mt-1.5">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm normal-case tracking-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </span>
            </label>

            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mot de passe
              <span className="relative block mt-1.5">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm normal-case tracking-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </span>
            </label>

            <div className="flex justify-end">
              <Link href="/reset-pin" className="text-xs font-bold text-blue-600 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-extrabold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>{isLoading ? 'Connexion…' : 'Se connecter'}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-slate-400">
          Nouveau sur KALY ?{' '}
          <Link href="/register" className="font-extrabold text-blue-400 hover:underline">
            Créer un compte applicatif
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-900" aria-busy="true" />}>
      <LoginContent />
    </Suspense>
  );
}
