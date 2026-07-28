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
import PasswordField from '@/components/auth/PasswordField';

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
          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
            {error && (
              <div id="register-error" role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/50 text-rose-200 text-xs">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="register-display-name" className="block text-xs font-bold text-slate-200">
                {copy.displayName}
              </label>
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
                className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label htmlFor="register-email" className="block text-xs font-bold text-slate-200">
                {copy.email}
              </label>
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
                className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30"
              />
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
              dark
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
              dark
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:cursor-wait disabled:opacity-50 rounded-xl font-extrabold text-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              {isLoading ? copy.submitting : copy.submit}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
