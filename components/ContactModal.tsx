'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { Headphones, X } from 'lucide-react';

export default function ContactModal() {
  const { isContactModalOpen, setIsContactModalOpen } = useAppStore();
  if (!isContactModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
      <section className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
        <header className="flex justify-between items-start">
          <div className="flex gap-3">
            <Headphones className="w-7 h-7 text-blue-600" />
            <div>
              <h2 className="font-extrabold text-slate-900">Assistance KALY</h2>
              <p className="text-xs text-slate-500">Canal non configuré</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsContactModalOpen(false)} aria-label="Fermer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>
        <p className="text-sm text-slate-700">
          Aucun service de messagerie ou centre d&apos;assistance n&apos;est relié à
          cette version. Aucun message saisi ici ne serait transmis ; le formulaire
          simulé a donc été retiré.
        </p>
        <button type="button" onClick={() => setIsContactModalOpen(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs">
          Fermer
        </button>
      </section>
    </div>
  );
}
