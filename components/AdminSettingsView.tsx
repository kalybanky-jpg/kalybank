'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { Database, Settings, ShieldCheck } from 'lucide-react';
import { isPublicSupabaseConfigured } from '@/lib/supabase/config';

export default function AdminSettingsView() {
  const { rates } = useAppStore();
  const configured = isPublicSupabaseConfigured();

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
