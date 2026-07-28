'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, KeyRound, Mail, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { safeInternalPath } from '@/lib/security/navigation';
import LanguageSelector from '@/components/LanguageSelector';
import { useAppStore } from '@/lib/store';
import { publicMessages } from '@/lib/public-i18n';

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
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-extrabold text-white font-mono">Monalyz</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{copy.restricted}</span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900 py-8 px-6 shadow-2xl rounded-3xl border border-slate-800 sm:px-10">
          <form className="space-y-5" onSubmit={handleAdminLogin}>
            {displayedError && (
              <div role="alert" className="p-3.5 rounded-xl bg-rose-950 border border-rose-500/40 text-rose-200 text-xs">
                {displayedError}
              </div>
            )}

            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              {copy.email}
              <span className="relative block mt-1.5">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </span>
            </label>

            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              {copy.password}
              <span className="relative block mt-1.5">
                <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition disabled:opacity-50"
            >
              {isLoading ? copy.submitting : copy.submit}
            </button>
          </form>
        </div>
        <p className="text-center mt-6 text-xs text-slate-500">
          <Link href="/login" className="hover:text-white">{copy.backToUser}</Link>
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
