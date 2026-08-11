'use client';

import React from 'react';
import {
  ArrowDownUp,
  BadgeCheck,
  BarChart3,
  CreditCard,
  ExternalLink,
  FileText,
  Folder,
  Headphones,
  LayoutGrid,
  LogOut,
  MessageCircle,
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
import BrandLogo from '@/components/brand/BrandLogo';
import { useBranded } from '@/components/brand/BrandProvider';
import SupportButton from '@/components/support/SupportButton';
import { useSupport } from '@/components/support/SupportProvider';
import { DialogBackdrop, DialogPanel, Drawer } from '@/components/ui/Dialog';
import { ADMIN_FEATURES } from '@/lib/admin-features';

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
  } = useAppStore();
  const { signOut, isSigningOut } = useSupport();
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
    { id: 'support', label: 'Archives support', icon: MessageCircle },
    {
      id: 'tawkLive',
      label: 'Messages en direct · Tawk.to',
      icon: ExternalLink,
      href: 'https://dashboard.tawk.to/',
    },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  const navItems = role === 'admin'
    ? adminNavItems.filter(
        (item) => item.id !== 'documents' || ADMIN_FEATURES.auditAndRegistry,
      )
    : userNavItems;

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    onCloseMobile?.();
  };

  const content = (
    <div className="monalyz-sidebar flex h-full min-h-full w-[282px] max-w-[calc(100vw-1.5rem)] flex-col overflow-y-auto overscroll-contain px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] text-white sm:px-6">
      <div>
        <div className="mb-6 flex items-center justify-between px-1 sm:mb-8">
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
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label={shell.closeMenu}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="space-y-1.5" aria-label={shell.mainNavigation}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const externalHref =
              'href' in item && typeof item.href === 'string' ? item.href : null;
            const isActive = externalHref === null && activeTab === item.id;
            const itemClassName = `group flex w-full items-center gap-4 rounded-[10px] px-4 py-[13px] text-left text-[14px] font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#5138ff] to-[#3123b8] text-white shadow-[0_10px_26px_rgba(64,45,235,0.32)]'
                    : 'featured' in item && item.featured
                      ? 'border border-[#806eff]/55 bg-[#654cff]/15 text-white hover:bg-[#654cff]/25'
                      : 'text-white/84 hover:bg-white/[0.07] hover:text-white'
                }`;
            const itemContent = (
              <>
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
              </>
            );

            if (externalHref) {
              return (
                <a
                  key={item.id}
                  href={externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onCloseMobile}
                  id={`nav-item-${item.id}`}
                  className={itemClassName}
                >
                  {itemContent}
                </a>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                id={`nav-item-${item.id}`}
                className={itemClassName}
              >
                {itemContent}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto">
        {role === 'admin' ? (
          <div className="mb-6 rounded-2xl border border-white/15 bg-white/[0.025] p-4 sm:p-5">
            <MessageCircle
              className="mb-4 h-8 w-8 text-[#7054ff]"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <h2 className="text-[15px] font-semibold">Archives support</h2>
            <p className="mt-1.5 text-[11px] leading-5 text-white/66">
              Consultez les conversations clients clôturées et leurs pièces jointes.
            </p>
            <button
              type="button"
              onClick={() => handleNavClick('support')}
              id="admin-support-messages-btn"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#6044ff] to-[#4128ef] px-4 py-2.5 text-[11px] font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Ouvrir les archives
            </button>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-white/15 bg-white/[0.025] p-4 sm:p-5">
            <Headphones className="mb-4 h-8 w-8 text-[#7054ff]" strokeWidth={1.8} />
            <h2 className="text-[15px] font-semibold">{t.needHelp}</h2>
            <p className="mt-1.5 text-[11px] leading-5 text-white/66">{shell.userHelp}</p>
            <SupportButton
              variant="sidebar"
              id="help-contact-us-btn"
              className="mt-4"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => void signOut()}
          disabled={isSigningOut}
          aria-busy={isSigningOut}
          id="sidebar-logout-btn"
          className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-[13px] font-medium text-white/82 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.8} />
          <span>{t.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 z-30 hidden h-[100dvh] shrink-0 lg:block">
        {content}
      </aside>

      <Drawer
        open={Boolean(isOpenOnMobile)}
        onClose={() => onCloseMobile?.()}
        ariaLabelledBy="mobile-navigation-title"
      >
        <DialogBackdrop className="fixed inset-0 z-50 flex overflow-hidden overscroll-contain bg-[#020617]/70 backdrop-blur-sm lg:hidden">
          <DialogPanel
            as={motion.div}
            initial={{ x: -282 }}
            animate={{ x: 0 }}
            exit={{ x: -282 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="relative z-10 h-[100dvh] max-w-full bg-[#050b2b] shadow-2xl"
          >
            <h2 id="mobile-navigation-title" className="sr-only">
              {shell.mainNavigation}
            </h2>
            {content}
          </DialogPanel>
        </DialogBackdrop>
      </Drawer>
    </>
  );
}
