'use client';

import { usePathname, useRouter } from 'next/navigation';
import { isSupportedLanguage, LANGUAGE_COOKIE, LANGUAGE_OPTIONS } from '@/lib/language';
import type { Language } from '@/lib/types';

export default function LegalLanguageSelector({
  language,
  label,
}: {
  language: Language;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      aria-label={label}
      value={language}
      onChange={(event) => {
        const nextLanguage = event.target.value as Language;
        document.cookie = `${LANGUAGE_COOKIE}=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
        const segments = pathname.split('/').filter(Boolean);
        if (isSupportedLanguage(segments[0])) segments[0] = nextLanguage;
        else segments.unshift(nextLanguage);
        router.push(`/${segments.join('/')}`);
      }}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      {LANGUAGE_OPTIONS.map(({ code, label: optionLabel }) => (
        <option key={code} value={code}>{optionLabel}</option>
      ))}
    </select>
  );
}
