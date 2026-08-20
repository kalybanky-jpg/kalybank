'use client';

import { useRouter } from 'next/navigation';
import { LANGUAGE_COOKIE, LANGUAGE_OPTIONS } from '@/lib/language';
import type { Language } from '@/lib/types';

export default function LegalLanguageSelector({
  language,
  label,
}: {
  language: Language;
  label: string;
}) {
  const router = useRouter();

  return (
    <select
      aria-label={label}
      value={language}
      onChange={(event) => {
        document.cookie = `${LANGUAGE_COOKIE}=${event.target.value}; Path=/; Max-Age=31536000; SameSite=Lax`;
        router.refresh();
      }}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      {LANGUAGE_OPTIONS.map(({ code, label: optionLabel }) => (
        <option key={code} value={code}>{optionLabel}</option>
      ))}
    </select>
  );
}
