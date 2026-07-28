'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { configuredAppOrigin } from '@/lib/security/navigation';
import LanguageSelector from '@/components/LanguageSelector';
import { useAppStore } from '@/lib/store';
import { publicMessages } from '@/lib/public-i18n';
import { registrationLanguageMetadata } from '@/lib/language';

export default function RegisterPage() {
  const { language } = useAppStore();
  const copy = publicMessages[language].register;
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError(copy.passwordPolicyError);
      return;
    }
    if (password !== confirmPassword) {
      setError(copy.passwordMismatchError);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const origin = configuredAppOrigin();
      if (!origin) throw new Error('Invalid public application origin.');
      const callbackUrl = `${origin}/auth/callback?next=/onboarding`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: callbackUrl,
          data: registrationLanguageMetadata(displayName, language),
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        window.location.assign('/onboarding');
        return;
      }
      setSubmitted(true);
    } catch {
      setError(copy.genericError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center px-4 py-10">
      <LanguageSelector dark compact className="absolute right-4 top-4" />
      <section className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-7">
          <ShieldCheck className="w-11 h-11 text-blue-400 mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold">{copy.title}</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {copy.subtitle}
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold">{copy.checkEmailTitle}</h2>
            <p className="text-sm text-slate-300">
              {copy.checkEmailBody}
            </p>
            <Link href="/login" className="inline-block text-blue-400 font-bold hover:underline">
              {copy.backToLogin}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <label className="block text-xs font-bold text-slate-300">
              {copy.displayName}
              <input
                type="text"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block text-xs font-bold text-slate-300">
              {copy.email}
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block text-xs font-bold text-slate-300">
              {copy.password}
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block text-xs font-bold text-slate-300">
              {copy.confirmPassword}
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-extrabold text-sm"
            >
              {isLoading ? copy.submitting : copy.submit}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
