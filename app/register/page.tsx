'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { configuredAppOrigin } from '@/lib/security/navigation';

export default function RegisterPage() {
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
      setError(
        'Le mot de passe doit comporter au moins 10 caractères, dont une lettre et un chiffre.',
      );
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const origin = configuredAppOrigin();
      if (!origin) throw new Error('Origine publique de l’application invalide.');
      const callbackUrl = `${origin}/auth/callback?next=/onboarding`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: callbackUrl,
          data: { display_name: displayName.trim() },
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        window.location.assign('/onboarding');
        return;
      }
      setSubmitted(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Création du compte impossible.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-7">
          <ShieldCheck className="w-11 h-11 text-blue-400 mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold">Créer un compte KALY</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Ce compte donne accès à un outil d&apos;instruction et de suivi. Il ne crée
            ni compte bancaire, ni IBAN, ni connexion à une banque.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold">Vérifiez votre adresse e-mail</h2>
            <p className="text-sm text-slate-300">
              Le lien sécurisé vous ramènera vers le dépôt de votre dossier d&apos;identité.
            </p>
            <Link href="/login" className="inline-block text-blue-400 font-bold hover:underline">
              Revenir à la connexion
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
              Nom affiché
              <input
                type="text"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1.5 w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block text-xs font-bold text-slate-300">
              Adresse e-mail
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
              Mot de passe (10 caractères minimum, avec lettre et chiffre)
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
              Confirmation du mot de passe
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
              {isLoading ? 'Création…' : 'Créer mon compte applicatif'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
