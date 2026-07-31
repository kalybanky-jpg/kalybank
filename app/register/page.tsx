'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { configuredAppOrigin } from '@/lib/security/navigation';
import LanguageSelector from '@/components/LanguageSelector';
import { useAppStore } from '@/lib/store';
import { publicMessages } from '@/lib/public-i18n';
import { registrationLanguageMetadata } from '@/lib/language';
import PasswordField from '@/components/auth/PasswordField';
import BrandLogo from '@/components/brand/BrandLogo';

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
  const passwordPolicyInvalid = error === copy.passwordPolicyError;
  const confirmationInvalid = error === copy.passwordMismatchError;

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
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-slate-900 px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/15 blur-3xl" />
      <LanguageSelector dark compact className="absolute right-4 top-4 z-20" />

      <div className="z-10 text-center sm:mx-auto sm:w-full sm:max-w-lg">
        <BrandLogo
          tone="reversed-white"
          priority
          className="mx-auto mb-3 h-auto w-[196px]"
        />
        <h1 className="text-xl font-bold text-slate-200">{copy.title}</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {copy.subtitle}
        </p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 mt-8 w-full sm:mx-auto sm:max-w-lg"
      >
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-2xl sm:px-10">
          {submitted ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">{copy.checkEmailTitle}</h2>
              <p className="text-sm text-slate-600">
                {copy.checkEmailBody}
              </p>
              <Link
                href="/login"
                className="inline-block rounded font-bold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {copy.backToLogin}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
              {error && (
                <div id="register-error" role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs font-medium text-rose-800">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="register-display-name" className="block text-xs font-bold text-slate-700">
                  {copy.displayName}
                </label>
                <span className="relative mt-1.5 block">
                  <UserRound aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    id="register-display-name"
                    name="displayName"
                    type="text"
                    autoComplete="name"
                    required
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder={copy.displayNamePlaceholder}
                    aria-invalid={false}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
                  />
                </span>
              </div>
              <div>
                <label htmlFor="register-email" className="block text-xs font-bold text-slate-700">
                  {copy.email}
                </label>
                <span className="relative mt-1.5 block">
                  <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    id="register-email"
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
                    aria-describedby={error === copy.genericError ? 'register-error' : undefined}
                    aria-invalid={false}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm normal-case tracking-normal text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
                  />
                </span>
              </div>
              <PasswordField
                id="register-password"
                label={copy.password}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={copy.passwordPlaceholder}
                showPasswordLabel={copy.showPassword}
                hidePasswordLabel={copy.hidePassword}
                describedBy={passwordPolicyInvalid ? 'register-error' : undefined}
                helpText={copy.passwordHint}
                helpTextId="register-password-hint"
                invalid={passwordPolicyInvalid}
                minLength={10}
              />
              <PasswordField
                id="register-confirm-password"
                name="confirmPassword"
                label={copy.confirmPassword}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={copy.confirmPasswordPlaceholder}
                showPasswordLabel={copy.showPassword}
                hidePasswordLabel={copy.hidePassword}
                describedBy={confirmationInvalid ? 'register-error' : undefined}
                invalid={confirmationInvalid}
                minLength={10}
              />

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-extrabold text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2"
              >
                <span>{isLoading ? copy.submitting : copy.submit}</span>
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}
        </div>
      </motion.section>
    </main>
  );
}
