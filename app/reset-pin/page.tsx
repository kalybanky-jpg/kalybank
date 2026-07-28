'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { configuredAppOrigin } from '@/lib/security/navigation';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const isUpdateMode = searchParams.get('mode') === 'update';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(
    searchParams.get('error') === 'recovery_session'
      ? 'Le lien de récupération est invalide ou expiré. Demandez-en un nouveau.'
      : '',
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const supabase = createClient();
      const origin = configuredAppOrigin();
      if (!origin) throw new Error('Origine publique de l’application invalide.');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-pin?mode=update`,
      });
      if (resetError) throw resetError;
      setMessage(
        'Si cette adresse existe, un lien sécurisé a été envoyé. Il expirera selon la politique Supabase Auth.',
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Demande impossible.');
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
      setError(
        'Utilisez au moins 10 caractères avec une lettre et un chiffre, puis saisissez deux valeurs identiques.',
      );
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      window.location.replace('/login');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Mise à jour impossible.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8">
        <KeyRound className="w-10 h-10 text-blue-400 mx-auto mb-4" />
        <h1 className="text-xl font-extrabold text-center">
          {isUpdateMode ? 'Choisir un nouveau mot de passe' : 'Réinitialiser le mot de passe'}
        </h1>

        {error && <p role="alert" className="mt-5 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs">{error}</p>}
        {message && <p className="mt-5 p-3 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs">{message}</p>}

        <form onSubmit={isUpdateMode ? handleUpdate : handleRequest} className="mt-6 space-y-4">
          {isUpdateMode ? (
            <>
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                placeholder="Nouveau mot de passe"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl"
              />
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                placeholder="Confirmation"
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
              placeholder="Adresse e-mail"
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
            {isLoading ? 'Traitement…' : isUpdateMode ? 'Enregistrer' : 'Envoyer le lien sécurisé'}
          </button>
        </form>

        <Link href="/login" className="block mt-5 text-center text-xs text-blue-400 hover:underline">
          Retour à la connexion
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
