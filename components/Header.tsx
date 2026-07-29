'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Bell, LogOut, Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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

  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.replace('/login');
  };

  return (
    <header className="sticky top-0 z-20 bg-[#f4f6fa]/95 backdrop-blur-xl border-b border-slate-200 px-4 sm:px-6 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-xl border border-slate-200"
            aria-label={t.header.openMenu}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
              {role === 'admin' ? t.header.adminTitle : t.header.userTitle}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              {t.header.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSelector compact />

          <button
            type="button"
            onClick={() => setIsNotificationsDrawerOpen(true)}
            className="relative p-2 bg-white border border-slate-200 rounded-xl"
            aria-label={t.header.notifications}
          >
            <Bell className="w-5 h-5 text-slate-700" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((open) => !open)}
              className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-extrabold"
              aria-label={t.header.sessionMenu}
            >
              {role === 'admin' ? 'CA' : 'M'}
            </button>
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-2"
                >
                  <p className="px-3 py-2 text-xs text-slate-500">
                    {role === 'admin' ? t.header.adminSession : t.header.userSession}
                  </p>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.header.logout}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {lastError && (
        <p role="alert" className="mt-2 text-[11px] text-rose-700 bg-rose-50 rounded-lg px-3 py-1.5">
          {lastError}
        </p>
      )}
    </header>
  );
}
