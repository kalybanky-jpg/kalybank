'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Mail, Save, ShieldCheck } from 'lucide-react';
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_PASSWORD_MIN_LENGTH,
  AdminCredentialValidationError,
  parseAdminCredentialChange,
} from '@/lib/admin-credentials';
import { createClient } from '@/lib/supabase/client';
import PasswordField from '@/components/auth/PasswordField';

type Feedback = { type: 'success' | 'error'; message: string } | null;

async function responseBody(response: Response) {
  try {
    return (await response.json()) as { error?: string };
  } catch {
    return {};
  }
}

export default function AdminCredentialsSettings() {
  const [currentEmail, setCurrentEmail] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailFeedback, setEmailFeedback] = useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [savingKind, setSavingKind] = useState<'email' | 'password' | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/admin/credentials', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const body = (await response.json()) as { email?: string; error?: string };
        if (!response.ok || !body.email) {
          throw new Error(body.error || 'Adresse administrateur indisponible.');
        }
        if (active) {
          setCurrentEmail(body.email);
          setEmail(body.email);
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Adresse administrateur indisponible.',
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const saveChange = async (
    kind: 'email' | 'password',
    payload: Record<string, unknown>,
  ) => {
    const setFeedback = kind === 'email' ? setEmailFeedback : setPasswordFeedback;
    setFeedback(null);

    try {
      parseAdminCredentialChange(payload, currentEmail);
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof AdminCredentialValidationError
            ? error.message
            : 'Vérifiez les informations saisies.',
      });
      return;
    }

    setSavingKind(kind);
    try {
      const response = await fetch('/api/admin/credentials', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body.error || 'Modification impossible.');
      }

      setFeedback({
        type: 'success',
        message:
          kind === 'email'
            ? 'Adresse e-mail modifiée. Reconnexion en cours…'
            : 'Mot de passe modifié. Reconnexion en cours…',
      });
      await createClient().auth.signOut({ scope: 'local' });
      window.location.replace(`/admin-login?updated=${kind}`);
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Modification impossible.',
      });
    } finally {
      setEmailCurrentPassword('');
      setPasswordCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSavingKind(null);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 md:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-indigo-700">
            <ShieldCheck className="h-4 w-4" />
            Sécurité du compte
          </div>
          <h2 className="mt-2 text-lg font-extrabold text-slate-900">
            Identifiants administrateur
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Le mot de passe actuel est vérifié avant chaque modification. Une
            modification ferme toutes les sessions administrateur actives.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
          Vérification renforcée
        </span>
      </div>

      {loadError && (
        <p className="mt-5 rounded-xl bg-rose-50 p-3 text-xs text-rose-700" role="alert">
          {loadError}
        </p>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <form
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void saveChange('email', {
              kind: 'email',
              email,
              currentPassword: emailCurrentPassword,
            });
          }}
          aria-busy={savingKind === 'email'}
        >
          <Mail className="h-7 w-7 text-blue-600" />
          <h3 className="mt-3 text-sm font-extrabold text-slate-900">
            Modifier l’adresse e-mail
          </h3>
          <label className="mt-4 block text-xs font-bold text-slate-700" htmlFor="admin-credentials-email">
            Adresse e-mail de connexion
          </label>
          <input
            id="admin-credentials-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            disabled={isLoading || Boolean(loadError) || savingKind !== null}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailFeedback(null);
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm normal-case tracking-normal outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-4">
            <PasswordField
              id="admin-email-current-password"
              name="currentPassword"
              label="Mot de passe actuel"
              value={emailCurrentPassword}
              onChange={(event) => {
                setEmailCurrentPassword(event.target.value);
                setEmailFeedback(null);
              }}
              autoComplete="current-password"
              placeholder="Confirmez votre mot de passe actuel"
              showPasswordLabel="Afficher le mot de passe actuel"
              hidePasswordLabel="Masquer le mot de passe actuel"
              maxLength={ADMIN_PASSWORD_MAX_LENGTH}
              invalid={emailFeedback?.type === 'error'}
            />
          </div>
          {emailFeedback && (
            <p
              className={`mt-4 rounded-xl p-3 text-xs ${
                emailFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
              role={emailFeedback.type === 'error' ? 'alert' : 'status'}
            >
              {emailFeedback.message}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading || Boolean(loadError) || savingKind !== null}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingKind === 'email' ? 'Modification…' : 'Enregistrer la nouvelle adresse'}
          </button>
        </form>

        <form
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void saveChange('password', {
              kind: 'password',
              currentPassword: passwordCurrentPassword,
              newPassword,
              confirmPassword,
            });
          }}
          aria-busy={savingKind === 'password'}
        >
          <KeyRound className="h-7 w-7 text-indigo-600" />
          <h3 className="mt-3 text-sm font-extrabold text-slate-900">
            Modifier le mot de passe
          </h3>
          <div className="mt-4 space-y-4">
            <PasswordField
              id="admin-password-current"
              name="currentPassword"
              label="Mot de passe actuel"
              value={passwordCurrentPassword}
              onChange={(event) => {
                setPasswordCurrentPassword(event.target.value);
                setPasswordFeedback(null);
              }}
              autoComplete="current-password"
              placeholder="Confirmez votre mot de passe actuel"
              showPasswordLabel="Afficher le mot de passe actuel"
              hidePasswordLabel="Masquer le mot de passe actuel"
              maxLength={ADMIN_PASSWORD_MAX_LENGTH}
              invalid={passwordFeedback?.type === 'error'}
            />
            <PasswordField
              id="admin-password-new"
              name="newPassword"
              label="Nouveau mot de passe"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setPasswordFeedback(null);
              }}
              autoComplete="new-password"
              placeholder="Créez un nouveau mot de passe"
              showPasswordLabel="Afficher le nouveau mot de passe"
              hidePasswordLabel="Masquer le nouveau mot de passe"
              minLength={ADMIN_PASSWORD_MIN_LENGTH}
              maxLength={ADMIN_PASSWORD_MAX_LENGTH}
              helpText="16 à 72 caractères, avec minuscule, majuscule, chiffre et symbole, sans espace."
              helpTextId="admin-password-policy"
              invalid={passwordFeedback?.type === 'error'}
            />
            <PasswordField
              id="admin-password-confirm"
              name="confirmPassword"
              label="Confirmer le nouveau mot de passe"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setPasswordFeedback(null);
              }}
              autoComplete="new-password"
              placeholder="Répétez le nouveau mot de passe"
              showPasswordLabel="Afficher la confirmation"
              hidePasswordLabel="Masquer la confirmation"
              minLength={ADMIN_PASSWORD_MIN_LENGTH}
              maxLength={ADMIN_PASSWORD_MAX_LENGTH}
              invalid={passwordFeedback?.type === 'error'}
            />
          </div>
          {passwordFeedback && (
            <p
              className={`mt-4 rounded-xl p-3 text-xs ${
                passwordFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
              role={passwordFeedback.type === 'error' ? 'alert' : 'status'}
            >
              {passwordFeedback.message}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading || Boolean(loadError) || savingKind !== null}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingKind === 'password' ? 'Modification…' : 'Enregistrer le nouveau mot de passe'}
          </button>
        </form>
      </div>
    </section>
  );
}
