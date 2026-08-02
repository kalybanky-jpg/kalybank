'use client';

import React from 'react';
import {
  ArrowDownUp,
  BadgeCheck,
  BarChart3,
  CreditCard,
  FileText,
  Folder,
  Headphones,
  LayoutGrid,
  LogOut,
  SendHorizontal,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { extraUserMessages } from '@/lib/user-i18n';
import { createClient } from '@/lib/supabase/client';
import BrandLogo from '@/components/brand/BrandLogo';
import { useBranded } from '@/components/brand/BrandProvider';

interface SidebarProps {
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ isOpenOnMobile, onCloseMobile }: SidebarProps) {
  const {
    language,
    role,
    activeTab,
    setActiveTab,
    setIsContactModalOpen,
  } = useAppStore();
  const effectiveLanguage = role === 'admin' ? 'fr' : language;
  const t = useBranded(translations[effectiveLanguage] || translations.fr);
  const shell = useBranded(extraUserMessages[effectiveLanguage].shell);

  const userNavItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutGrid },
    { id: 'accounts', label: t.accounts, icon: CreditCard },
    { id: 'transfers', label: t.transfers, icon: SendHorizontal },
    { id: 'loan', label: t.loan, icon: WalletCards },
    { id: 'documents', label: t.documents, icon: FileText },
    { id: 'kyc', label: 'KYC', icon: BadgeCheck },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  const adminNavItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutGrid },
    { id: 'loanRequests', label: t.loanRequests, icon: FileText },
    { id: 'transfers', label: t.transfers, icon: SendHorizontal },
    { id: 'compliance', label: t.compliance, icon: ShieldCheck },
    { id: 'clients', label: t.clients, icon: Users },
    { id: 'accounts', label: t.accounts, icon: CreditCard },
    {
      id: 'balanceAdjustment',
      label: t.balanceAdjustment,
      icon: ArrowDownUp,
      featured: true,
    },
    { id: 'documents', label: t.auditLogs, icon: Folder },
    { id: 'reports', label: t.reports, icon: BarChart3 },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  const navItems = role === 'admin' ? adminNavItems : userNavItems;

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    onCloseMobile?.();
  };

  const content = (
    <div className="monalyz-sidebar flex h-full w-[282px] flex-col px-6 pb-7 pt-7 text-white">
      <div>
        <div className="mb-8 flex items-center justify-between px-1">
          <button
            type="button"
            aria-label={shell.homeAria}
            onClick={() => handleNavClick('dashboard')}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <BrandLogo
              tone="reversed-white"
              decorative
              priority
              className="h-auto w-[166px]"
            />
          </button>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label={shell.closeMenu}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="space-y-1.5" aria-label={shell.mainNavigation}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                id={`nav-item-${item.id}`}
                className={`group flex w-full items-center gap-4 rounded-[10px] px-4 py-[13px] text-left text-[14px] font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#5138ff] to-[#3123b8] text-white shadow-[0_10px_26px_rgba(64,45,235,0.32)]'
                    : 'featured' in item && item.featured
                      ? 'border border-[#806eff]/55 bg-[#654cff]/15 text-white hover:bg-[#654cff]/25'
                      : 'text-white/84 hover:bg-white/[0.07] hover:text-white'
                }`}
              >
                <Icon
                  strokeWidth={1.8}
                  className={`h-[22px] w-[22px] shrink-0 ${
                    isActive ? 'text-white' : 'text-white/86 group-hover:text-white'
                  }`}
                />
                <span className="min-w-0 flex-1">{item.label}</span>
                {'featured' in item && item.featured === true && !isActive && (
                  <span className="rounded bg-[#7863ff] px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-white">
                    {shell.actions.toUpperCase()}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto">
        <div className="mb-6 rounded-2xl border border-white/15 bg-white/[0.025] p-5">
          <Headphones className="mb-4 h-8 w-8 text-[#7054ff]" strokeWidth={1.8} />
          <h2 className="text-[15px] font-semibold">{t.needHelp}</h2>
          <p className="mt-1.5 text-[11px] leading-5 text-white/66">
            {role === 'admin' ? shell.adminHelp : shell.userHelp}
          </p>
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            id="help-contact-us-btn"
            className="mt-4 rounded-md bg-gradient-to-r from-[#6044ff] to-[#4128ef] px-5 py-2.5 text-[11px] font-semibold text-white shadow-lg shadow-indigo-950/30 hover:brightness-110"
          >
            {shell.contact}
          </button>
        </div>

        <button
          type="button"
          onClick={async () => {
            await createClient().auth.signOut();
            window.location.replace('/login');
          }}
          id="sidebar-logout-btn"
          className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-[13px] font-medium text-white/82 transition hover:bg-white/[0.07] hover:text-white"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.8} />
          <span>{t.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 z-30 hidden h-screen shrink-0 lg:block">
        {content}
      </aside>

      {isOpenOnMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <motion.button
            type="button"
            aria-label={shell.closeMenu}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 bg-[#020617]/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: -282 }}
            animate={{ x: 0 }}
            exit={{ x: -282 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="relative z-10 h-full"
          >
            {content}
          </motion.div>
        </div>
      )}
    </>
  );
}
