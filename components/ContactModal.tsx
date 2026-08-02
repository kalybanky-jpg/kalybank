'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { Headphones, X } from 'lucide-react';
import { extraUserMessages } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';

export default function ContactModal() {
  const { language, role, isContactModalOpen, setIsContactModalOpen } = useAppStore();
  const effectiveLanguage = role === 'admin' ? 'fr' : language;
  const t = useBranded(extraUserMessages[effectiveLanguage]);
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';

  if (!isContactModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
      <section className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
        <header className="flex justify-between items-start">
          <div className="flex gap-3">
            <Headphones className="w-7 h-7 text-blue-600" />
            <div>
              <h2 className="font-extrabold text-slate-900">{t.contact.title}</h2>
              <p className="text-xs text-slate-500">{t.contact.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsContactModalOpen(false)} aria-label={t.common.close}>
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>
        <p className="text-sm text-slate-700">
          {t.contact.description}
        </p>
        <a
          href={`mailto:${supportEmail}`}
          className="block w-full py-3 bg-blue-600 text-center text-white rounded-xl font-bold text-sm hover:bg-blue-700"
        >
          {supportEmail}
        </a>
      </section>
    </div>
  );
}
