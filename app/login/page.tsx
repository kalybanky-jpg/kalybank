'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { safeInternalPath } from '@/lib/security/navigation';
import LanguageSelector from '@/components/LanguageSelector';
import { useAppStore } from '@/lib/store';
import { publicMessages } from '@/lib/public-i18n';

function LoginContent() {
  const searchParams = useSearchParams();
  const { language } = useAppStore();
  const copy = publicMessages[language].login;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const displayedError =
    error || copy.errors[searchParams.get('error') ?? ''] || '';

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
    } catch {
      setError(copy.genericError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <LanguageSelector
        dark
        compact
        className="absolute right-4 top-4 z-20"
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="flex items-center justify-center space-x-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono">Monalyz</span>
        </div>
        <h1 className="text-xl font-bold text-slate-200">{copy.title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          {copy.subtitle}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0"
      >
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl border border-slate-200 sm:px-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {displayedError && (
              <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {displayedError}
              </div>
            )}

            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {copy.email}
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
              {copy.password}
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
                {copy.forgotPassword}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-extrabold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>{isLoading ? copy.submitting : copy.submit}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-slate-400">
          {copy.newUser}{' '}
          <Link href="/register" className="font-extrabold text-blue-400 hover:underline">
            {copy.register}
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
