'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, ChevronDown, LogOut, Menu } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { bankingMessages } from '@/lib/banking-i18n';
import LanguageSelector from './LanguageSelector';

interface HeaderProps {
  onToggleMobileMenu: () => void;
}

export default function Header({ onToggleMobileMenu }: HeaderProps) {
  const {
    language,
    role,
    notifications,
    setIsNotificationsDrawerOpen,
    lastError,
  } = useAppStore();
  const t = bankingMessages[language];
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const isAdmin = role === 'admin';

  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.replace('/login');
  };

  return (
    <header className="relative z-20 px-4 pb-3 pt-5 sm:px-7 lg:px-10 lg:pb-4 lg:pt-7">
      <div className="flex items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="rounded-xl border border-[#e1e5ef] bg-white p-2.5 text-[#0b164e] shadow-sm lg:hidden"
            aria-label={t.header.openMenu}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[23px] font-bold tracking-[-0.035em] text-[#0a154f] sm:text-[28px]">
              {isAdmin ? 'Tableau de bord administrateur' : 'Bonjour, Thomas 👋'}
            </h1>
            <p className="mt-0.5 truncate text-[12px] text-[#59649a] sm:text-[13px]">
              {isAdmin
                ? 'Superviser les prêts, virements et conformité en temps réel.'
                : 'Bienvenue sur votre espace bancaire en ligne.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-2 rounded-xl border border-[#e1e5ef] bg-white/80 px-3 py-1.5 shadow-[0_4px_18px_rgba(31,42,94,0.02)] sm:flex">
            <span aria-hidden="true" className="text-lg">🇫🇷</span>
            <LanguageSelector compact className="header-language" />
          </div>

          <button
            type="button"
            onClick={() => setIsNotificationsDrawerOpen(true)}
            className="relative rounded-xl p-2 text-[#0b1651] hover:bg-white"
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
              className="flex items-center gap-3 rounded-xl p-1.5 text-left hover:bg-white/80"
              aria-label={t.header.sessionMenu}
              aria-expanded={isProfileOpen}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#9f765e] to-[#31251f] text-[11px] font-bold text-white shadow-sm">
                {isAdmin ? 'AM' : 'TM'}
              </span>
              <span className="hidden leading-tight xl:block">
                <strong className="block text-[12px] text-[#0a154f]">
                  {isAdmin ? 'Admin Martin' : 'Thomas Martin'}
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
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
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

      {lastError && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">
          {lastError}
        </p>
      )}
    </header>
  );
}
