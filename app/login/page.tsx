'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { safeInternalPath } from '@/lib/security/navigation';
import LanguageSelector from '@/components/LanguageSelector';
import { useAppStore } from '@/lib/store';
import { publicMessages } from '@/lib/public-i18n';
import PasswordField from '@/components/auth/PasswordField';
import BrandLogo from '@/components/brand/BrandLogo';

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
        <BrandLogo
          tone="reversed-white"
          priority
          className="mx-auto mb-3 h-auto w-[196px]"
        />
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
          <form className="space-y-5" onSubmit={handleLogin} aria-busy={isLoading}>
            {displayedError && (
              <div id="login-error" role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium">
                {displayedError}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-slate-700">
                {copy.email}
              </label>
              <span className="relative block mt-1.5">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={copy.emailPlaceholder}
                  aria-describedby={displayedError ? 'login-error' : undefined}
                  aria-invalid={Boolean(displayedError)}
                  className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl text-sm normal-case tracking-normal text-slate-950 placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 ${
                    displayedError ? 'border-rose-500' : 'border-slate-300'
                  }`}
                />
              </span>
            </div>

            <PasswordField
              id="login-password"
              label={copy.password}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder={copy.passwordPlaceholder}
              showPasswordLabel={copy.showPassword}
              hidePasswordLabel={copy.hidePassword}
              describedBy={displayedError ? 'login-error' : undefined}
              invalid={Boolean(displayedError)}
            />

            <div className="flex justify-end">
              <Link href="/reset-pin" className="rounded text-xs font-bold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                {copy.forgotPassword}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-extrabold text-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-wait disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2"
            >
              <span>{isLoading ? copy.submitting : copy.submit}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-slate-400">
          {copy.newUser}{' '}
          <Link href="/register" className="rounded font-extrabold text-blue-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
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
