'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { Currency, Language } from '@/lib/types';
import { Save, Settings, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function UserSettingsView() {
  const {
    language,
    setLanguage,
    currency,
    setCurrency,
    isMaskedBalance,
    toggleMaskBalance,
    refreshData,
  } = useAppStore();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data, error: profileError } = await createClient()
        .from('profiles')
        .select('display_name,phone')
        .single();
      if (profileError) {
        setError(profileError.message);
        return;
      }
      setDisplayName(data.display_name ?? '');
      setPhone(data.phone ?? '');
    };
    void loadProfile();
  }, []);

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
      if (userError || !user) throw userError ?? new Error('Session expirée.');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          phone: phone.trim() || null,
          preferred_currency: currency,
        })
        .eq('user_id', user.id);
      if (updateError) throw updateError;
      await refreshData();
      setMessage('Préférences enregistrées.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Enregistrement impossible.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <Settings className="w-4 h-4" />
          <span>Préférences</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">Paramètres du compte KALY</h1>
      </header>

      <form onSubmit={save} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
        {error && <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">{error}</p>}
        {message && <p className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs">{message}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs font-bold text-slate-700">
            Nom affiché
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1.5 w-full p-3 border rounded-xl" />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Téléphone
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full p-3 border rounded-xl" />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Langue d&apos;interface
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="mt-1.5 w-full p-3 border rounded-xl">
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="es">Español</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">
            Devise de simulation préférée
            <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)} className="mt-1.5 w-full p-3 border rounded-xl">
              {['EUR', 'USD', 'CAD', 'CHF', 'GBP'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl">
          <span>
            <strong className="block text-xs text-slate-900">Masquer les montants</strong>
            <span className="text-[11px] text-slate-500">Préférence locale de confidentialité visuelle</span>
          </span>
          <input type="checkbox" checked={isMaskedBalance} onChange={toggleMaskBalance} />
        </label>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
          <p className="text-xs text-blue-900">
            La configuration Supabase est définie par le déploiement et ne peut pas
            être remplacée depuis le navigateur.
          </p>
        </div>

        <button disabled={isSaving} className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs disabled:opacity-50 flex items-center gap-2">
          <Save className="w-4 h-4" />
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
