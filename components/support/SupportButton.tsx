'use client';

import React from 'react';
import { Headphones, LoaderCircle } from 'lucide-react';
import { useBranded } from '@/components/brand/BrandProvider';
import { useAppStore } from '@/lib/store';
import { extraUserMessages } from '@/lib/user-i18n';
import { useSupport } from './SupportProvider';

type SupportButtonVariant = 'sidebar' | 'icon' | 'primary';

interface SupportButtonProps {
  variant?: SupportButtonVariant;
  className?: string;
  id?: string;
}

const variantClasses: Record<SupportButtonVariant, string> = {
  sidebar:
    'inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#6044ff] to-[#4128ef] px-4 py-2.5 text-[11px] font-semibold text-white shadow-lg shadow-indigo-950/30 hover:brightness-110',
  icon:
    'relative rounded-xl p-2 text-[#0b1651] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f35f1]',
  primary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4b2df1] px-5 py-3 text-xs font-bold text-white shadow-[0_8px_22px_rgba(75,45,241,0.2)] transition hover:bg-[#3f25db] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4b2df1]/25',
};

export default function SupportButton({
  variant = 'primary',
  className = '',
  id,
}: SupportButtonProps) {
  const { language, role } = useAppStore();
  const effectiveLanguage = role === 'admin' ? 'fr' : language;
  const copy = useBranded(extraUserMessages[effectiveLanguage].support);
  const { openSupport, tawkStatus } = useSupport();
  const unavailable = tawkStatus === 'unavailable';
  const loading = tawkStatus === 'loading';
  const label = unavailable ? copy.unavailable : copy.openChat;

  return (
    <button
      id={id}
      type="button"
      onClick={() => void openSupport()}
      disabled={unavailable}
      aria-label={label}
      aria-busy={loading}
      title={variant === 'icon' ? label : undefined}
      className={`${variantClasses[variant]} ${className} disabled:cursor-not-allowed disabled:opacity-55`}
    >
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className={`${variant === 'icon' ? 'h-[21px] w-[21px]' : 'h-4 w-4'} animate-spin`}
        />
      ) : (
        <Headphones
          aria-hidden="true"
          className={variant === 'icon' ? 'h-[21px] w-[21px]' : 'h-4 w-4'}
          strokeWidth={1.8}
        />
      )}
      {variant !== 'icon' && <span>{label}</span>}
    </button>
  );
}
