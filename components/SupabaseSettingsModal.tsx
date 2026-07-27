'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import { X, Database, RefreshCw, CheckCircle2, ShieldCheck, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SupabaseSettingsModal() {
  const {
    language,
    isSupabaseModalOpen,
    setIsSupabaseModalOpen,
    resetToDefaults,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [saved, setSaved] = useState(false);

  if (!isSupabaseModalOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      if (supabaseUrl) localStorage.setItem('novabank_supabase_url', supabaseUrl);
      if (supabaseAnonKey) localStorage.setItem('novabank_supabase_anon_key', supabaseAnonKey);
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setIsSupabaseModalOpen(false);
    }, 1500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        >
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">{t.supabaseConfig}</h3>
                <p className="text-xs text-slate-400">Gestion de la persistance et réinitialisation</p>
              </div>
            </div>
            <button
              onClick={() => setIsSupabaseModalOpen(false)}
              id="close-supabase-modal-btn"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5 text-xs sm:text-sm">
            {/* Status indicator */}
            <div className="p-4 rounded-2xl border flex items-center justify-between bg-slate-50 border-slate-200">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-blue-600 animate-pulse'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">{t.supabaseStatus}</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {isConfigured ? t.connected : t.offlineLocal}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                Auto-Sync
              </span>
            </div>

            {/* Supabase Custom Credentials Form */}
            <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Clés Supabase (Optionnel)</h4>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">SUPABASE_URL</label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">SUPABASE_ANON_KEY</label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  id="save-supabase-keys-btn"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs transition shadow-md"
                >
                  Enregistrer les identifiants Supabase
                </button>
              </div>
            </form>

            {/* Reset Demo Data Button */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">Données de démonstration</p>
                <p className="text-[11px] text-slate-500 font-medium">Rétablir les comptes, virements et prêts initiaux</p>
              </div>

              <button
                onClick={() => {
                  resetToDefaults();
                  alert('Données réinitialisées aux valeurs de démo !');
                }}
                id="reset-demo-data-btn"
                className="px-4 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs transition flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.resetMockData}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
