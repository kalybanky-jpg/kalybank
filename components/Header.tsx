'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, ChevronDown, Languages, LogOut, Menu } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { bankingMessages } from '@/lib/banking-i18n';
import { extraUserMessages, interpolate, localizedAppError } from '@/lib/user-i18n';
import LanguageSelector from './LanguageSelector';
import { useBrand, useBranded } from '@/components/brand/BrandProvider';
import { useSupport } from '@/components/support/SupportProvider';

interface HeaderProps {
  onToggleMobileMenu: () => void;
}

export default function Header({ onToggleMobileMenu }: HeaderProps) {
  const {
    language,
    role,
    currentUserDisplayName,
    notifications,
    setIsNotificationsDrawerOpen,
    lastError,
  } = useAppStore();
  const effectiveLanguage = role === 'admin' ? 'fr' : language;
  const { brand } = useBrand();
  const t = useBranded(bankingMessages[effectiveLanguage]);
  const userCopy = useBranded(extraUserMessages[effectiveLanguage]);
  const { signOut, isSigningOut } = useSupport();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const isAdmin = role === 'admin';
  const displayName = currentUserDisplayName || '';
  const initials = displayName
    ? displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
    : 'CL';
  const heading = isAdmin
    ? 'Tableau de bord administrateur'
    : displayName
      ? interpolate(userCopy.shell.greeting, { name: displayName })
      : userCopy.shell.greetingFallback;
  const subheading = isAdmin
    ? 'Superviser les prêts, virements et conformité en temps réel.'
    : userCopy.shell.welcome;

  return (
    <header className="relative z-20 pb-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-7 sm:pt-5 lg:px-10 lg:pb-4 lg:pt-7">
      <div className="flex items-center justify-between gap-3 sm:gap-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[#e1e5ef] bg-white p-2 text-[#0b164e] shadow-sm lg:hidden sm:p-2.5"
            aria-label={t.header.openMenu}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-[23px] font-bold tracking-[-0.035em] text-[#0a154f] sm:text-[28px]">
              {heading}
            </h1>
            <p className="mt-0.5 truncate text-[12px] text-[#59649a] sm:text-[13px]">
              {subheading}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-4">
          {!isAdmin && (
            <LanguageSelector
              compact
              className="md:hidden [&_select]:h-10 [&_select]:w-[82px] [&_select]:px-2 [&_select]:py-1.5"
            />
          )}

          {!isAdmin && (
            <div className="hidden items-center gap-2 rounded-xl border border-[#e1e5ef] bg-white/80 px-3 py-1.5 shadow-[0_4px_18px_rgba(31,42,94,0.02)] md:flex">
              <Languages aria-hidden="true" className="h-4 w-4 text-[#4f35f1]" />
              <LanguageSelector compact className="header-language" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsNotificationsDrawerOpen(true)}
            className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-[#0b1651] hover:bg-white"
            aria-label={t.header.notifications}
          >
            <Bell className="h-[21px] w-[21px]" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#4f35f1] px-1 text-[8px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((open) => !open)}
              className="flex min-h-11 items-center gap-3 rounded-xl p-1 text-left hover:bg-white/80 sm:p-1.5"
              aria-label={t.header.sessionMenu}
              aria-expanded={isProfileOpen}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#9f765e] to-[#31251f] text-[10px] font-bold text-white shadow-sm sm:h-10 sm:w-10 sm:text-[11px]">
                {isAdmin ? 'AM' : initials}
              </span>
              <span className="hidden leading-tight xl:block">
                <strong className="block text-[12px] text-[#0a154f]">
                  {isAdmin ? `Administration ${brand.bankName}` : displayName || t.header.userSession}
                </strong>
                {isAdmin && (
                  <span className="mt-0.5 block text-[10px] text-[#69729f]">Administrateur</span>
                )}
              </span>
              <ChevronDown className="hidden h-4 w-4 text-[#0a154f] xl:block" />
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-[#e1e5ef] bg-white p-2 shadow-xl"
                >
                  <p className="px-3 py-2 text-xs text-slate-500">
                    {isAdmin ? t.header.adminSession : t.header.userSession}
                  </p>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    disabled={isSigningOut}
                    aria-busy={isSigningOut}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.header.logout}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-3 min-w-0 sm:hidden">
        <h1 className="break-words text-[22px] font-bold leading-7 tracking-[-0.035em] text-[#0a154f]">
          {heading}
        </h1>
        <p className="mt-1 text-[12px] leading-5 text-[#59649a]">{subheading}</p>
      </div>

      {lastError && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">
          {isAdmin ? lastError : localizedAppError(language, 'UNKNOWN_ERROR')}
        </p>
      )}
    </header>
  );
}
