'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { configuredAppOrigin } from '@/lib/security/navigation';
import LanguageSelector from '@/components/LanguageSelector';
import { useAppStore } from '@/lib/store';
import { publicMessages } from '@/lib/public-i18n';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const { language } = useAppStore();
  const copy = publicMessages[language].resetPassword;
  const isUpdateMode = searchParams.get('mode') === 'update';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const displayedError =
    error ||
    (searchParams.get('error') === 'recovery_session' ? copy.recoveryError : '');

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const supabase = createClient();
      const origin = configuredAppOrigin();
      if (!origin) throw new Error('Invalid public application origin.');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-pin?mode=update`,
      });
      if (resetError) throw resetError;
      setMessage(copy.requestSuccess);
    } catch {
      setError(copy.requestError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (
      password.length < 10 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      password !== confirmPassword
    ) {
      setError(copy.passwordError);
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      window.location.replace('/login');
    } catch {
      setError(copy.updateError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <LanguageSelector dark compact className="absolute right-4 top-4" />
      <section className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8">
        <KeyRound className="w-10 h-10 text-blue-400 mx-auto mb-4" />
        <h1 className="text-xl font-extrabold text-center">
          {isUpdateMode ? copy.updateTitle : copy.requestTitle}
        </h1>

        {displayedError && <p role="alert" className="mt-5 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs">{displayedError}</p>}
        {message && <p className="mt-5 p-3 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs">{message}</p>}

        <form onSubmit={isUpdateMode ? handleUpdate : handleRequest} className="mt-6 space-y-4">
          {isUpdateMode ? (
            <>
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                placeholder={copy.password}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl"
              />
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                placeholder={copy.confirmPassword}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl"
              />
            </>
          ) : (
            <input
              type="email"
              autoComplete="email"
              required
              placeholder={copy.email}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl"
            />
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 rounded-xl font-bold disabled:opacity-50"
          >
            {isLoading
              ? copy.submitting
              : isUpdateMode
                ? copy.updateSubmit
                : copy.requestSubmit}
          </button>
        </form>

        <Link href="/login" className="block mt-5 text-center text-xs text-blue-400 hover:underline">
          {copy.backToLogin}
        </Link>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" aria-busy="true" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
