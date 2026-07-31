'use client';

import React, { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Database, Hash, Save, Settings, ShieldCheck } from 'lucide-react';
import { isPublicSupabaseConfigured } from '@/lib/supabase/config';

export default function AdminSettingsView() {
  const {
    rates,
    accountNumberConfiguration,
    updateAccountNumberPrefix,
  } = useAppStore();
  const configured = isPublicSupabaseConfigured();
  const [draftPrefix, setDraftPrefix] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const prefix = draftPrefix ?? accountNumberConfiguration?.prefix ?? '';

  const capacity = useMemo(
    () => (/^\d{5,9}$/.test(prefix) ? 10 ** (10 - prefix.length) : null),
    [prefix],
  );
  const example =
    capacity === null ? '—' : `${prefix}${'0'.repeat(10 - prefix.length)}`;

  const submitPrefix = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback('');
    setIsSaving(true);
    try {
      await updateAccountNumberPrefix(prefix);
      setDraftPrefix(null);
      setFeedback('Préfixe enregistré. Il sera utilisé pour les prochains comptes.');
    } catch (caughtError) {
      setFeedback(
        caughtError instanceof Error
          ? caughtError.message
          : 'Enregistrement impossible.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <Settings className="w-4 h-4" />
          <span>Configuration de déploiement</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">Paramètres techniques</h1>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <form
          onSubmit={submitPrefix}
          className="bg-white rounded-3xl border border-slate-200 p-6 md:col-span-2"
        >
          <Hash className="w-8 h-8 text-indigo-600" />
          <h2 className="font-extrabold text-slate-900 mt-4">
            Numéros de compte automatiques
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Les prochains numéros comporteront exactement 10 chiffres : ce préfixe,
            suivi d’un suffixe aléatoire unique.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <label className="text-xs font-bold text-slate-800">
              Préfixe global (5 à 9 chiffres)
              <input
                required
                inputMode="numeric"
                minLength={5}
                maxLength={9}
                pattern="[0-9]{5,9}"
                value={prefix}
                onChange={(event) =>
                  setDraftPrefix(event.target.value.replace(/\D/g, '').slice(0, 9))
                }
                className="mt-1 w-full rounded-xl border p-3 font-mono text-base tracking-widest"
                placeholder="12345"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] uppercase text-slate-500">Exemple</p>
                <p className="mt-2 font-mono font-bold text-slate-900">{example}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] uppercase text-slate-500">Capacité</p>
                <p className="mt-2 font-bold text-slate-900">
                  {capacity?.toLocaleString('fr-FR') ?? '—'} comptes
                </p>
              </div>
            </div>
          </div>
          {capacity !== null && capacity <= 100 && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              Ce préfixe ne permet que {capacity} numéros. Choisissez un préfixe
              plus court si davantage de comptes sont prévus.
            </p>
          )}
          {feedback && (
            <p className="mt-3 text-xs text-slate-700" role="status">
              {feedback}
            </p>
          )}
          <button
            disabled={isSaving || capacity === null}
            className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Enregistrement…' : 'Enregistrer le préfixe'}
          </button>
          {accountNumberConfiguration?.updatedAt && (
            <p className="mt-3 text-[10px] text-slate-400">
              Dernière modification :{' '}
              {new Date(accountNumberConfiguration.updatedAt).toLocaleString('fr-FR')}
            </p>
          )}
        </form>

        <article className="bg-white rounded-3xl border border-slate-200 p-6">
          <Database className={`w-8 h-8 ${configured ? 'text-emerald-600' : 'text-rose-600'}`} />
          <h2 className="font-extrabold text-slate-900 mt-4">Backend Supabase</h2>
          <p className="text-xs text-slate-500 mt-1">
            {configured ? 'Variables publiques configurées.' : 'Configuration absente.'}
          </p>
          <p className="text-[11px] text-slate-500 mt-3">
            Les clés sont définies par l&apos;environnement. Aucun utilisateur ne peut
            modifier l&apos;URL ou la clé depuis le navigateur.
          </p>
        </article>

        <article className="bg-white rounded-3xl border border-slate-200 p-6">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          <h2 className="font-extrabold text-slate-900 mt-4">Source des taux</h2>
          <p className="text-xs text-slate-500 mt-1">
            Baseline interne datée du {new Date(rates.updatedAt).toLocaleDateString('fr-FR')}.
          </p>
          <p className="text-[11px] text-slate-500 mt-3">
            Aucun service bancaire ou de marché n&apos;est appelé. Les conversions
            sont indicatives et leur taux est figé avec chaque instruction.
          </p>
        </article>
      </section>
    </div>
  );
}
