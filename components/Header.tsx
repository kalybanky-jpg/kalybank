'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { Language, Currency } from '@/lib/types';
import {
  Menu,
  Bell,
  Mail,
  ChevronDown,
  Globe,
  Coins,
  Search,
  Database,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  onToggleMobileMenu: () => void;
}

export default function Header({ onToggleMobileMenu }: HeaderProps) {
  const {
    language,
    setLanguage,
    role,
    currency,
    setCurrency,
    notifications,
    emails,
    setIsEmailDrawerOpen,
    setIsNotificationsDrawerOpen,
    setIsSupabaseModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isCurrOpen, setIsCurrOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];

  const currencies: Currency[] = ['EUR', 'CAD', 'USD', 'CHF', 'GBP'];

  return (
    <header className="sticky top-0 z-20 bg-[#f4f6fa]/90 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between transition-all">
      {/* Left Title & Mobile Menu Button */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileMenu}
          id="mobile-menu-toggle-btn"
          className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition border border-slate-200"
          aria-label="Toggle menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            {role === 'user' ? (
              <>
                <span>Bonjour, Thomas</span>
                <span className="text-xl">👋</span>
              </>
            ) : (
              t.adminDashboardTitle
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 hidden sm:block font-medium">
            {role === 'user' ? t.userWelcome : t.adminSubtitle}
          </p>
        </div>
      </div>

      {/* Right Controls & User Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Currency Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsCurrOpen(!isCurrOpen);
              setIsLangOpen(false);
              setIsProfileOpen(false);
            }}
            id="currency-selector-btn"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold shadow-sm transition"
          >
            <Coins className="w-4 h-4 text-emerald-600" />
            <span>{currency}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {isCurrOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 overflow-hidden"
              >
                {currencies.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCurrency(c);
                      setIsCurrOpen(false);
                    }}
                    id={`select-currency-${c}`}
                    className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between hover:bg-slate-50 transition ${
                      currency === c ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
                    }`}
                  >
                    <span>{c}</span>
                    {currency === c && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsLangOpen(!isLangOpen);
              setIsCurrOpen(false);
              setIsProfileOpen(false);
            }}
            id="language-selector-btn"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold shadow-sm transition"
          >
            <span>{languages.find((l) => l.code === language)?.flag}</span>
            <span className="hidden md:inline">{languages.find((l) => l.code === language)?.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {isLangOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 overflow-hidden"
              >
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      setIsLangOpen(false);
                    }}
                    id={`select-lang-${l.code}`}
                    className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center space-x-2 hover:bg-slate-50 transition ${
                      language === l.code ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Email Logs Button */}
        <button
          onClick={() => setIsEmailDrawerOpen(true)}
          id="open-email-drawer-btn"
          className="relative p-2 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200/80 bg-white shadow-sm transition"
          title="Consulter les e-mails automatisés envoyés"
        >
          <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
          {emails.length > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold leading-none shadow-sm">
              {emails.length}
            </span>
          )}
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setIsNotificationsDrawerOpen(true)}
          id="open-notifications-drawer-btn"
          className="relative p-2 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-100 border border-slate-200/80 bg-white shadow-sm transition"
          title="Notifications"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
          {unreadNotifsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center leading-none shadow-sm">
              {unreadNotifsCount}
            </span>
          )}
        </button>

        {/* Profile Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsLangOpen(false);
              setIsCurrOpen(false);
            }}
            id="user-profile-menu-btn"
            className="flex items-center space-x-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-200/50 transition border border-transparent"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-300 p-0.5 shadow-sm overflow-hidden">
              <img
                src="https://picsum.photos/seed/thomas_martin/100/100"
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {role === 'user' ? 'Thomas Martin' : 'Admin Martin'}
              </p>
              <p className="text-[10px] text-slate-500 leading-tight">
                {role === 'user' ? 'Client Particulier' : 'Administrateur'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50"
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-sm font-bold text-slate-900">
                    {role === 'user' ? 'Thomas Martin' : 'Admin Martin'}
                  </p>
                  <p className="text-xs text-slate-500">urbainmorel@gmail.com</p>
                </div>
                <button
                  onClick={() => {
                    setIsSupabaseModalOpen(true);
                    setIsProfileOpen(false);
                  }}
                  id="profile-supabase-config-btn"
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition"
                >
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>{t.supabaseConfig}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
