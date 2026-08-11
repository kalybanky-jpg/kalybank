'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  BadgePercent,
  Database,
  Hash,
  Save,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { isPublicSupabaseConfigured } from '@/lib/supabase/config';
import BrandSettingsEditor from '@/components/brand/BrandSettingsEditor';
import type { ExchangeRateSnapshot } from '@/lib/currency';
import AdminCredentialsSettings from '@/components/AdminCredentialsSettings';

const LOAN_CURRENCIES = ['EUR', 'USD', 'CAD', 'CHF', 'GBP'] as const;
type LoanCurrency = (typeof LOAN_CURRENCIES)[number];

interface LoanSettingsDraft {
  currency: LoanCurrency;
  minimumAmount: number;
  maximumAmount: number;
  minimumDurationMonths: number;
  maximumDurationMonths: number;
  durationStepMonths: number;
  fixedAnnualRatePercent: number;
  referencePrefix: string;
  isActive: boolean;
}

const defaultLoanDraft = (currency: LoanCurrency): LoanSettingsDraft => ({
  currency,
  minimumAmount: 1_000,
  maximumAmount: 50_000,
  minimumDurationMonths: 12,
  maximumDurationMonths: 84,
  durationStepMonths: 6,
  fixedAnnualRatePercent: 3.5,
  referencePrefix: 'Monalyz-',
  isActive: true,
});

const loanReferenceDate = () => {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');
};

export default function AdminSettingsView() {
  const {
    rates,
    accountNumberConfiguration,
    updateAccountNumberPrefix,
    loanProductSettings,
    updateLoanProductSettings,
  } = useAppStore();
  const configured = isPublicSupabaseConfigured();
  const [draftPrefix, setDraftPrefix] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedLoanCurrency, setSelectedLoanCurrency] =
    useState<LoanCurrency>('EUR');
  const [loanDraft, setLoanDraft] = useState<LoanSettingsDraft>(() =>
    defaultLoanDraft('EUR'),
  );
  const [isSavingLoan, setIsSavingLoan] = useState(false);
  const [loanFeedback, setLoanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const prefix = draftPrefix ?? accountNumberConfiguration?.prefix ?? '';
  const rateSnapshot = rates as typeof rates & Partial<ExchangeRateSnapshot>;
  const rateProvider = rateSnapshot.provider ?? 'Source non renseignée';
  const rateDate = rateSnapshot.date ?? rates.updatedAt.slice(0, 10);

  const selectedLoanSettings = useMemo(
    () =>
      loanProductSettings.find(
        (settings) => settings.currency === selectedLoanCurrency,
      ),
    [loanProductSettings, selectedLoanCurrency],
  );

  useEffect(() => {
    const nextDraft = selectedLoanSettings
      ? {
          currency: selectedLoanCurrency,
          minimumAmount: Number(selectedLoanSettings.minimumAmount),
          maximumAmount: Number(selectedLoanSettings.maximumAmount),
          minimumDurationMonths: selectedLoanSettings.minimumDurationMonths,
          maximumDurationMonths: selectedLoanSettings.maximumDurationMonths,
          durationStepMonths: selectedLoanSettings.durationStepMonths,
          fixedAnnualRatePercent: Number(selectedLoanSettings.fixedAnnualRate) * 100,
          referencePrefix: selectedLoanSettings.referencePrefix,
          isActive: selectedLoanSettings.isActive,
        }
      : defaultLoanDraft(selectedLoanCurrency);
    const synchronizationTimer = window.setTimeout(() => setLoanDraft(nextDraft), 0);
    return () => window.clearTimeout(synchronizationTimer);
  }, [selectedLoanCurrency, selectedLoanSettings]);

  const capacity = useMemo(
    () => (/^\d{5,9}$/.test(prefix) ? 10 ** (10 - prefix.length) : null),
    [prefix],
  );
  const example =
    capacity === null ? '—' : `${prefix}${'0'.repeat(10 - prefix.length)}`;

  const loanErrors = useMemo(() => {
    const errors: Partial<Record<keyof LoanSettingsDraft, string>> = {};
    if (!Number.isFinite(loanDraft.minimumAmount) || loanDraft.minimumAmount <= 0) {
      errors.minimumAmount = 'Le montant minimum doit être strictement positif.';
    }
    if (
      !Number.isFinite(loanDraft.maximumAmount) ||
      loanDraft.maximumAmount <= loanDraft.minimumAmount
    ) {
      errors.maximumAmount = 'Le montant maximum doit dépasser le minimum.';
    }
    if (
      !Number.isInteger(loanDraft.minimumDurationMonths) ||
      loanDraft.minimumDurationMonths < 1
    ) {
      errors.minimumDurationMonths =
        'La durée minimum doit être un nombre entier positif.';
    }
    if (
      !Number.isInteger(loanDraft.maximumDurationMonths) ||
      loanDraft.maximumDurationMonths < loanDraft.minimumDurationMonths ||
      loanDraft.maximumDurationMonths > 600
    ) {
      errors.maximumDurationMonths =
        'La durée maximum doit être comprise entre la durée minimum et 600 mois.';
    }
    if (
      !Number.isInteger(loanDraft.durationStepMonths) ||
      loanDraft.durationStepMonths < 1
    ) {
      errors.durationStepMonths = 'Le pas doit être un nombre entier positif.';
    } else if (
      loanDraft.maximumDurationMonths > loanDraft.minimumDurationMonths &&
      (loanDraft.maximumDurationMonths - loanDraft.minimumDurationMonths) %
        loanDraft.durationStepMonths !==
        0
    ) {
      errors.durationStepMonths =
        'Le pas doit diviser exactement l’intervalle des durées.';
    }
    if (
      !Number.isFinite(loanDraft.fixedAnnualRatePercent) ||
      loanDraft.fixedAnnualRatePercent < 0 ||
      loanDraft.fixedAnnualRatePercent > 100
    ) {
      errors.fixedAnnualRatePercent = 'Le TAEG doit être compris entre 0 et 100 %.';
    }
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(loanDraft.referencePrefix.trim())) {
      errors.referencePrefix =
        'Utilisez 1 à 24 lettres, chiffres, tirets ou underscores.';
    }
    return errors;
  }, [loanDraft]);

  const updateLoanDraft = <Key extends keyof LoanSettingsDraft>(
    key: Key,
    value: LoanSettingsDraft[Key],
  ) => {
    setLoanDraft((current) => ({ ...current, [key]: value }));
    setLoanFeedback(null);
  };

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

  const submitLoanSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoanFeedback(null);

    if (Object.keys(loanErrors).length > 0) {
      setLoanFeedback({
        type: 'error',
        message: 'Corrigez les champs signalés avant d’enregistrer.',
      });
      return;
    }

    setIsSavingLoan(true);
    try {
      await updateLoanProductSettings({
        currency: loanDraft.currency,
        minimumAmount: loanDraft.minimumAmount,
        maximumAmount: loanDraft.maximumAmount,
        minimumDurationMonths: loanDraft.minimumDurationMonths,
        maximumDurationMonths: loanDraft.maximumDurationMonths,
        durationStepMonths: loanDraft.durationStepMonths,
        fixedAnnualRate: loanDraft.fixedAnnualRatePercent / 100,
        referencePrefix: loanDraft.referencePrefix.trim(),
        isActive: loanDraft.isActive,
      });
      setLoanFeedback({
        type: 'success',
        message: `Paramètres du prêt ${loanDraft.currency} enregistrés.`,
      });
    } catch (caughtError) {
      setLoanFeedback({
        type: 'error',
        message:
          caughtError instanceof Error
            ? caughtError.message
            : 'Enregistrement des paramètres du prêt impossible.',
      });
    } finally {
      setIsSavingLoan(false);
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
        <BrandSettingsEditor />
        <AdminCredentialsSettings />
        <form
          onSubmit={submitLoanSettings}
          className="bg-white rounded-3xl border border-slate-200 p-6 md:col-span-2"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <BadgePercent className="h-8 w-8 text-blue-600" />
              <h2 className="mt-4 font-extrabold text-slate-900">
                Paramètres du prêt
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-slate-500">
                Définissez les limites du simulateur, le TAEG fixe et le format
                des prochaines références pour chaque devise.
              </p>
            </div>
            <label className="text-xs font-bold text-slate-800 sm:min-w-40">
              Devise
              <select
                value={selectedLoanCurrency}
                onChange={(event) => {
                  const currency = event.target.value as LoanCurrency;
                  setSelectedLoanCurrency(currency);
                  setLoanFeedback(null);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900"
              >
                {LOAN_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <fieldset className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <legend className="px-2 text-xs font-extrabold uppercase tracking-wide text-slate-700">
                Montants
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-800">
                  Montant minimum ({loanDraft.currency})
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={loanDraft.minimumAmount}
                    onChange={(event) =>
                      updateLoanDraft('minimumAmount', Number(event.target.value))
                    }
                    aria-invalid={Boolean(loanErrors.minimumAmount)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  />
                  {loanErrors.minimumAmount && (
                    <span className="mt-1 block text-[11px] font-medium text-rose-600">
                      {loanErrors.minimumAmount}
                    </span>
                  )}
                </label>
                <label className="text-xs font-bold text-slate-800">
                  Montant maximum ({loanDraft.currency})
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={loanDraft.maximumAmount}
                    onChange={(event) =>
                      updateLoanDraft('maximumAmount', Number(event.target.value))
                    }
                    aria-invalid={Boolean(loanErrors.maximumAmount)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  />
                  {loanErrors.maximumAmount && (
                    <span className="mt-1 block text-[11px] font-medium text-rose-600">
                      {loanErrors.maximumAmount}
                    </span>
                  )}
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <legend className="px-2 text-xs font-extrabold uppercase tracking-wide text-slate-700">
                Durées
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-xs font-bold text-slate-800">
                  Minimum (mois)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={loanDraft.minimumDurationMonths}
                    onChange={(event) =>
                      updateLoanDraft(
                        'minimumDurationMonths',
                        Number(event.target.value),
                      )
                    }
                    aria-invalid={Boolean(loanErrors.minimumDurationMonths)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  />
                  {loanErrors.minimumDurationMonths && (
                    <span className="mt-1 block text-[11px] font-medium text-rose-600">
                      {loanErrors.minimumDurationMonths}
                    </span>
                  )}
                </label>
                <label className="text-xs font-bold text-slate-800">
                  Maximum (mois)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={loanDraft.maximumDurationMonths}
                    onChange={(event) =>
                      updateLoanDraft(
                        'maximumDurationMonths',
                        Number(event.target.value),
                      )
                    }
                    aria-invalid={Boolean(loanErrors.maximumDurationMonths)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  />
                  {loanErrors.maximumDurationMonths && (
                    <span className="mt-1 block text-[11px] font-medium text-rose-600">
                      {loanErrors.maximumDurationMonths}
                    </span>
                  )}
                </label>
                <label className="text-xs font-bold text-slate-800">
                  Pas (mois)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={loanDraft.durationStepMonths}
                    onChange={(event) =>
                      updateLoanDraft('durationStepMonths', Number(event.target.value))
                    }
                    aria-invalid={Boolean(loanErrors.durationStepMonths)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  />
                  {loanErrors.durationStepMonths && (
                    <span className="mt-1 block text-[11px] font-medium text-rose-600">
                      {loanErrors.durationStepMonths}
                    </span>
                  )}
                </label>
              </div>
            </fieldset>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <label className="text-xs font-bold text-slate-800">
                TAEG fixe (%)
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={loanDraft.fixedAnnualRatePercent}
                    onChange={(event) =>
                      updateLoanDraft(
                        'fixedAnnualRatePercent',
                        Number(event.target.value),
                      )
                    }
                    aria-invalid={Boolean(loanErrors.fixedAnnualRatePercent)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 pr-10 text-sm"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-bold text-slate-400">
                    %
                  </span>
                </div>
                {loanErrors.fixedAnnualRatePercent && (
                  <span className="mt-1 block text-[11px] font-medium text-rose-600">
                    {loanErrors.fixedAnnualRatePercent}
                  </span>
                )}
                <span className="mt-1 block text-[11px] font-normal text-slate-500">
                  Ce taux sera converti et enregistré sous forme décimale.
                </span>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <label className="text-xs font-bold text-slate-800">
                Préfixe de référence
                <input
                  type="text"
                  maxLength={24}
                  value={loanDraft.referencePrefix}
                  onChange={(event) =>
                    updateLoanDraft('referencePrefix', event.target.value)
                  }
                  aria-invalid={Boolean(loanErrors.referencePrefix)}
                  placeholder="Monalyz-"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm"
                />
                {loanErrors.referencePrefix && (
                  <span className="mt-1 block text-[11px] font-medium text-rose-600">
                    {loanErrors.referencePrefix}
                  </span>
                )}
              </label>
              <div className="mt-3 rounded-xl bg-white p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Aperçu d’une prochaine référence
                </p>
                <p className="mt-1 break-all font-mono text-sm font-bold text-slate-900">
                  {loanErrors.referencePrefix
                    ? '—'
                    : `${loanDraft.referencePrefix.trim()}${loanReferenceDate()}-<identifiant unique>`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold text-slate-900">
                Disponibilité du produit
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Un produit inactif ne peut plus recevoir de nouvelles demandes.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={loanDraft.isActive}
              onClick={() => updateLoanDraft('isActive', !loanDraft.isActive)}
              className={`inline-flex min-w-28 items-center justify-center rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                loanDraft.isActive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {loanDraft.isActive ? 'Actif' : 'Inactif'}
            </button>
          </div>

          {loanFeedback && (
            <p
              className={`mt-4 rounded-xl p-3 text-xs font-medium ${
                loanFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-rose-50 text-rose-700'
              }`}
              role={loanFeedback.type === 'error' ? 'alert' : 'status'}
            >
              {loanFeedback.message}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={isSavingLoan || Object.keys(loanErrors).length > 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSavingLoan ? 'Enregistrement…' : 'Enregistrer les paramètres du prêt'}
            </button>
            {selectedLoanSettings?.updatedAt && (
              <p className="text-[10px] text-slate-400">
                Dernière modification :{' '}
                {new Date(selectedLoanSettings.updatedAt).toLocaleString('fr-FR')}
              </p>
            )}
          </div>
        </form>

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
            {rateProvider} · taux du{' '}
            {new Date(`${rateDate}T00:00:00.000Z`).toLocaleDateString('fr-FR', {
              timeZone: 'UTC',
            })}.
          </p>
          <p
            className={`mt-3 text-[11px] ${
              rateSnapshot.fallback ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            {rateSnapshot.fallback
              ? `Mode de secours actif. ${
                  rateSnapshot.fallbackReason ??
                  'Les taux embarqués sont utilisés temporairement.'
                }`
              : 'Taux de référence quotidiens récupérés côté serveur et mis en cache pendant une heure.'}
          </p>
          <a
            href="https://frankfurter.dev/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-[11px] font-bold text-blue-600 hover:text-blue-800"
          >
            Documentation officielle Frankfurter
          </a>
        </article>
      </section>
    </div>
  );
}
