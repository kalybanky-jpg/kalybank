'use client';

import type { Language } from '@/lib/types';
import { publicMessages } from '@/lib/public-i18n';
import { useAppStore } from '@/lib/store';
import { useBranded } from '@/components/brand/BrandProvider';

const LANGUAGE_OPTIONS: Array<{ code: Language; label: string }> = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

interface LanguageSelectorProps {
  className?: string;
  compact?: boolean;
  dark?: boolean;
}

export default function LanguageSelector({
  className = '',
  compact = false,
  dark = false,
}: LanguageSelectorProps) {
  const { language, setLanguage } = useAppStore();
  const messages = useBranded(publicMessages[language]);

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      <span className={compact ? 'sr-only' : 'text-xs font-bold'}>
        {messages.languageSelector}
      </span>
      <select
        aria-label={messages.languageSelector}
        value={language}
        onChange={(event) => {
          void setLanguage(event.target.value as Language);
        }}
        className={`rounded-xl border px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          dark
            ? 'border-slate-700 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
