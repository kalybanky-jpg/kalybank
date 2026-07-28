'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { FileText, ShieldCheck } from 'lucide-react';

export default function AdminDocumentsView() {
  const { activityLogs } = useAppStore();

  return (
    <div className="space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <ShieldCheck className="w-4 h-4" />
          <span>Traçabilité</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">Journal d&apos;audit KALY</h1>
        <p className="text-xs text-slate-300 mt-2">
          Événements applicatifs immuables. KALY ne génère aucun document bancaire officiel.
        </p>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="space-y-3">
          {activityLogs.map((event) => (
            <article key={event.id} className="p-4 border rounded-2xl flex gap-3">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900">{event.description}</p>
                <p className="text-[10px] text-slate-500 mt-1">{event.timestamp}</p>
                <p className="font-mono text-[10px] text-slate-400">{event.id}</p>
              </div>
            </article>
          ))}
          {!activityLogs.length && (
            <p className="py-10 text-center text-sm text-slate-500">
              Aucun événement d&apos;audit accessible.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
