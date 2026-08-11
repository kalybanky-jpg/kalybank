'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { Currency, Language } from '@/lib/types';
import { LANGUAGE_OPTIONS } from '@/lib/language';
import { Save, Settings, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { extraUserMessages, localizedAppError } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { translations } from '@/lib/i18n';
import WebPushSettings from '@/components/support/WebPushSettings';

export default function UserSettingsView() {
  const {
    language,
    setLanguage,
    baseCurrency,
    currency,
    setCurrency,
    isMaskedBalance,
    toggleMaskBalance,
    refreshData,
  } = useAppStore();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [draftCurrency, setDraftCurrency] = useState<Currency>(currency);
  const [isCurrencySaving, setIsCurrencySaving] = useState(false);
  const [currencyMessage, setCurrencyMessage] = useState('');
  const [currencyError, setCurrencyError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const currencySaveInFlightRef = useRef(false);
  const t = useBranded(extraUserMessages[language]);
  const currencyCopy = translations[language];

  useEffect(() => {
    if (!currencySaveInFlightRef.current) {
      setDraftCurrency(currency);
    }
  }, [currency]);

  useEffect(() => {
    const loadProfile = async () => {
      const { data, error: profileError } = await createClient()
        .from('profiles')
        .select('display_name,phone')
        .single();
      if (profileError) {
        setError(localizedAppError(language, 'NETWORK_ERROR'));
        return;
      }
      setDisplayName(data.display_name ?? '');
      setPhone(data.phone ?? '');
    };
    void loadProfile();
  }, [language]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('AUTH_REQUIRED');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          phone: phone.trim() || null,
        })
        .eq('user_id', user.id);
      if (updateError) throw updateError;
      await refreshData();
      setMessage(t.settings.saved);
    } catch {
      setError(localizedAppError(language, 'SAVE_FAILED'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveDisplayCurrency = async (nextCurrency: Currency) => {
    if (currencySaveInFlightRef.current || nextCurrency === currency) return;

    currencySaveInFlightRef.current = true;
    setDraftCurrency(nextCurrency);
    setCurrencyMessage('');
    setCurrencyError('');
    setIsCurrencySaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('AUTH_REQUIRED');

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ preferred_currency: nextCurrency })
        .eq('user_id', user.id)
        .select('preferred_currency')
        .single();
      if (updateError || updatedProfile?.preferred_currency !== nextCurrency) {
        throw updateError ?? new Error('DISPLAY_CURRENCY_SAVE_MISMATCH');
      }

      setCurrency(nextCurrency);
      setCurrencyMessage(currencyCopy.displayCurrencySaved);
    } catch {
      setDraftCurrency(currency);
      setCurrencyError(currencyCopy.displayCurrencySaveError);
    } finally {
      currencySaveInFlightRef.current = false;
      setIsCurrencySaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl min-w-0 space-y-4 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="min-w-0 rounded-3xl bg-slate-900 p-4 text-white sm:p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <Settings className="w-4 h-4" />
          <span>{t.settings.eyebrow}</span>
        </div>
        <h1 className="mt-1 break-words text-xl font-extrabold sm:text-2xl">{t.settings.title}</h1>
      </header>

      <form onSubmit={save} className="min-w-0 space-y-5 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        {error && <p role="alert" className="break-words rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        {message && <p className="break-words rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">{message}</p>}

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-xs font-bold text-slate-700">
            {t.settings.displayName}
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1.5 w-full min-w-0 rounded-xl border p-3" />
          </label>
          <label className="min-w-0 text-xs font-bold text-slate-700">
            {t.settings.phone}
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full min-w-0 rounded-xl border p-3" />
          </label>
          <label className="min-w-0 text-xs font-bold text-slate-700">
            {t.settings.interfaceLanguage}
            <select
              value={language}
              onChange={(event) => {
                void setLanguage(event.target.value as Language).catch(() => {
                  setError(t.settings.languageFailed);
                });
              }}
              className="mt-1.5 w-full min-w-0 rounded-xl border p-3"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs font-bold text-slate-700">
            {currencyCopy.baseCurrency}
            <input
              type="text"
              value={baseCurrency}
              readOnly
              aria-readonly="true"
              className="mt-1.5 w-full min-w-0 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-600"
            />
            <span className="mt-1.5 block text-[11px] font-normal leading-relaxed text-slate-500">
              {currencyCopy.baseCurrencyHint}
            </span>
          </label>
          <label className="min-w-0 text-xs font-bold text-slate-700">
            {currencyCopy.currencySelector}
            <select
              value={draftCurrency}
              onChange={(event) => void saveDisplayCurrency(event.target.value as Currency)}
              disabled={isCurrencySaving || isSaving}
              aria-busy={isCurrencySaving}
              aria-describedby="display-currency-hint display-currency-status"
              className="mt-1.5 w-full min-w-0 rounded-xl border p-3 disabled:cursor-wait disabled:opacity-60"
            >
              {SUPPORTED_CURRENCIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <span id="display-currency-hint" className="mt-1.5 block text-[11px] font-normal leading-relaxed text-slate-500">
              {currencyCopy.displayCurrencyHint}
            </span>
            <span
              id="display-currency-status"
              role={currencyError ? 'alert' : 'status'}
              aria-live="polite"
              className={`mt-1.5 block min-h-4 text-[11px] font-semibold ${
                currencyError ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {isCurrencySaving
                ? currencyCopy.displayCurrencySaving
                : currencyError || currencyMessage}
            </span>
          </label>
        </div>

        <label className="flex min-w-0 flex-col items-start gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="min-w-0">
            <strong className="block text-xs text-slate-900">{t.settings.hideAmounts}</strong>
            <span className="text-[11px] text-slate-500">{t.settings.hideAmountsHint}</span>
          </span>
          <input className="shrink-0" type="checkbox" checked={isMaskedBalance} onChange={toggleMaskBalance} />
        </label>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
          <p className="text-xs text-blue-900">
            {t.settings.deploymentNotice}
          </p>
        </div>

        <WebPushSettings />

        <button disabled={isSaving || isCurrencySaving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-50 sm:w-auto">
          <Save className="w-4 h-4" />
          {isSaving ? t.common.saving : t.common.save}
        </button>
      </form>
    </div>
  );
}
