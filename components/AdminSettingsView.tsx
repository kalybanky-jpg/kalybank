'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { CurrencyRates } from '@/lib/types';
import {
  Settings,
  Database,
  Globe,
  Shield,
  CheckCircle2,
  RefreshCw,
  Building2,
  Key,
} from 'lucide-react';

export default function AdminSettingsView() {
  const {
    language,
    rates,
    setRates,
    setIsSupabaseModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const [editedRates, setEditedRates] = useState<CurrencyRates>({ ...rates });
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    setRates(editedRates);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" />
            <span>Paramètres Système Globaux</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Configuration de l&apos;Établissement Bancaire
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Ajustez les taux de change en direct, gérez les clés d&apos;API et supervisez la synchronisation de la base de données.
          </p>
        </div>

        <button
          onClick={() => setIsSupabaseModalOpen(true)}
          id="admin-settings-supabase-btn"
          className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center space-x-2 backdrop-blur-md transition border border-white/10 shadow-sm shrink-0"
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Statut BDD / Supabase</span>
        </button>
      </div>

      {savedMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Taux de change appliqués immédiatement à l&apos;ensemble du système.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Exchange Rate Overrides Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <Globe className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Surcharge des Taux de Change (Base EUR)</h2>
              <p className="text-xs text-slate-500">Mise à jour instantanée des conversions pour les clients</p>
            </div>
          </div>

          <form onSubmit={handleSaveRates} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">EUR / USD</label>
                <input
                  type="number"
                  step="0.0001"
                  value={editedRates.rates.USD || 1.08}
                  onChange={(e) => setEditedRates({ ...editedRates, rates: { ...editedRates.rates, USD: Number(e.target.value) } })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">EUR / GBP</label>
                <input
                  type="number"
                  step="0.0001"
                  value={editedRates.rates.GBP || 0.85}
                  onChange={(e) => setEditedRates({ ...editedRates, rates: { ...editedRates.rates, GBP: Number(e.target.value) } })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">EUR / CHF</label>
                <input
                  type="number"
                  step="0.0001"
                  value={editedRates.rates.CHF || 0.96}
                  onChange={(e) => setEditedRates({ ...editedRates, rates: { ...editedRates.rates, CHF: Number(e.target.value) } })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">EUR / CAD</label>
                <input
                  type="number"
                  step="0.0001"
                  value={editedRates.rates.CAD || 1.48}
                  onChange={(e) => setEditedRates({ ...editedRates, rates: { ...editedRates.rates, CAD: Number(e.target.value) } })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
            >
              Enregistrer les taux de change
            </button>
          </form>
        </div>

        {/* Security & System Info */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-sm text-slate-900">Paramètres de l&apos;Établissement</h3>
            </div>

            <div className="space-y-3 text-xs font-medium">
              <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500">Code BIC Principal :</span>
                <strong className="font-mono text-slate-900">NOVABFRPPXXX</strong>
              </div>

              <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500">Seuil Validation Double :</span>
                <strong className="font-mono text-slate-900">10 000.00 €</strong>
              </div>

              <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500">Mode Environnement :</span>
                <strong className="text-emerald-600 font-extrabold">Production Safe</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
