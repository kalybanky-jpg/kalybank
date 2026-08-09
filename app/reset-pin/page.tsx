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
import PasswordField from '@/components/auth/PasswordField';
import BrandLogo from '@/components/brand/BrandLogo';
import { useBranded } from '@/components/brand/BrandProvider';
import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/password-policy';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const { language } = useAppStore();
  const copy = useBranded(publicMessages[language].resetPassword);
  const isUpdateMode = searchParams.get('mode') === 'update';
  const requestedLogin =
    searchParams.get('next') === '/admin-login' ? '/admin-login' : '/login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const displayedError =
    error ||
    (searchParams.get('error') === 'recovery_session' ? copy.recoveryError : '');
  const passwordInvalid = error === copy.passwordError;

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
      !isStrongPassword(password) ||
      password !== confirmPassword
    ) {
      setError(copy.passwordError);
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: role, error: roleError } =
        await supabase.rpc('current_app_role');
      if (roleError) throw roleError;
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      window.location.replace(role === 'admin' ? '/admin-login' : '/login');
    } catch {
      setError(copy.updateError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-16 sm:py-10">
      <LanguageSelector dark compact className="absolute right-4 top-4" />
      <section className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl sm:p-8">
        <BrandLogo
          tone="reversed-white"
          priority
          className="mx-auto mb-5 h-auto w-[168px]"
        />
        <KeyRound className="w-10 h-10 text-blue-400 mx-auto mb-4" />
        <h1 className="text-xl font-extrabold text-center">
          {isUpdateMode ? copy.updateTitle : copy.requestTitle}
        </h1>

        {displayedError && <p id="reset-password-error" role="alert" className="mt-5 p-3 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-200 text-xs">{displayedError}</p>}
        {message && <p role="status" aria-live="polite" className="mt-5 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs">{message}</p>}

        <form onSubmit={isUpdateMode ? handleUpdate : handleRequest} className="mt-6 space-y-5" aria-busy={isLoading}>
          {isUpdateMode ? (
            <>
              <PasswordField
                id="reset-new-password"
                label={copy.password}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={copy.passwordPlaceholder}
                showPasswordLabel={copy.showPassword}
                hidePasswordLabel={copy.hidePassword}
                describedBy={passwordInvalid ? 'reset-password-error' : undefined}
                helpText={copy.passwordHint}
                helpTextId="reset-password-hint"
                invalid={passwordInvalid}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                dark
              />
              <PasswordField
                id="reset-confirm-password"
                name="confirmPassword"
                label={copy.confirmPassword}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={copy.confirmPasswordPlaceholder}
                showPasswordLabel={copy.showPassword}
                hidePasswordLabel={copy.hidePassword}
                describedBy={passwordInvalid ? 'reset-password-error' : undefined}
                invalid={passwordInvalid}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                dark
              />
            </>
          ) : (
            <div>
              <label htmlFor="reset-email" className="block text-xs font-bold text-slate-200">
                {copy.email}
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder={copy.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={displayedError ? 'reset-password-error' : undefined}
                aria-invalid={Boolean(displayedError)}
                className={`mt-1.5 w-full px-4 py-3 bg-slate-950 border rounded-xl text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 ${
                  displayedError ? 'border-rose-500' : 'border-slate-700'
                }`}
              />
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            {isLoading
              ? copy.submitting
              : isUpdateMode
                ? copy.updateSubmit
                : copy.requestSubmit}
          </button>
        </form>

        <Link href={requestedLogin} className="block mt-5 rounded text-center text-xs text-blue-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
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
