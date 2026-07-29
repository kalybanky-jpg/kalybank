'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { safeInternalPath } from '@/lib/security/navigation';
import LanguageSelector from '@/components/LanguageSelector';
import { useAppStore } from '@/lib/store';
import { publicMessages } from '@/lib/public-i18n';
import PasswordField from '@/components/auth/PasswordField';
import BrandLogo from '@/components/brand/BrandLogo';

function AdminLoginContent() {
  const searchParams = useSearchParams();
  const { language } = useAppStore();
  const copy = publicMessages[language].adminLogin;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const displayedError =
    error || copy.errors[searchParams.get('error') ?? ''] || '';

  const handleAdminLogin = async (event: React.FormEvent) => {
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

      const { data: role, error: roleError } = await supabase.rpc('current_app_role');
      if (roleError) throw roleError;
      if (role !== 'admin') {
        await supabase.auth.signOut();
        setError(copy.forbidden);
        return;
      }

      const requestedPath = safeInternalPath(searchParams.get('next'), '/admin');
      window.location.replace(requestedPath.startsWith('/admin') ? requestedPath : '/admin');
    } catch {
      setError(copy.genericError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <LanguageSelector dark compact className="absolute right-4 top-4" />
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandLogo
          tone="reversed-white"
          priority
          className="mx-auto mb-3 h-auto w-[196px]"
        />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{copy.restricted}</span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900 py-8 px-6 shadow-2xl rounded-3xl border border-slate-800 sm:px-10">
          <form className="space-y-5" onSubmit={handleAdminLogin} aria-busy={isLoading}>
            {displayedError && (
              <div id="admin-login-error" role="alert" className="p-3.5 rounded-xl bg-rose-950 border border-rose-500/60 text-rose-100 text-xs">
                {displayedError}
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="block text-xs font-bold text-slate-200">
                {copy.email}
              </label>
              <span className="relative block mt-1.5">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  id="admin-email"
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
                  aria-describedby={displayedError ? 'admin-login-error' : undefined}
                  aria-invalid={Boolean(displayedError)}
                  className={`w-full pl-10 pr-4 py-3 bg-slate-950 border rounded-xl text-sm normal-case tracking-normal text-white placeholder:text-slate-500 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-400/35 ${
                    displayedError ? 'border-rose-500' : 'border-slate-700'
                  }`}
                />
              </span>
            </div>

            <PasswordField
              id="admin-password"
              label={copy.password}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder={copy.passwordPlaceholder}
              showPasswordLabel={copy.showPassword}
              hidePasswordLabel={copy.hidePassword}
              describedBy={displayedError ? 'admin-login-error' : undefined}
              invalid={Boolean(displayedError)}
              dark
              accent="amber"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm rounded-xl transition disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              {isLoading ? copy.submitting : copy.submit}
            </button>
          </form>
        </div>
        <p className="text-center mt-6 text-xs text-slate-500">
          <Link href="/login" className="rounded text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">{copy.backToUser}</Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" aria-busy="true" />}>
      <AdminLoginContent />
    </Suspense>
  );
}
