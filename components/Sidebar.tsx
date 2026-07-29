'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import {
  LayoutDashboard,
  CreditCard,
  Send,
  FileText,
  FileCode2,
  FolderGit2,
  ShieldCheck,
  Users,
  PieChart,
  Settings,
  Headphones,
  LogOut,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import BrandLogo from '@/components/brand/BrandLogo';

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
    setIsTransferModalOpen,
    setIsLoanModalOpen,
    setIsStatementsModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;

  const userNavItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'accounts', label: t.accounts, icon: CreditCard },
    { id: 'transfers', label: t.transfers, icon: Send },
    { id: 'loan', label: t.loan, icon: FileText },
    { id: 'documents', label: t.documents, icon: FolderGit2 },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  const adminNavItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'loanRequests', label: t.loanRequests, icon: FileText },
    { id: 'transfers', label: t.transfers, icon: Send },
    { id: 'compliance', label: t.compliance, icon: ShieldCheck },
    { id: 'clients', label: t.clients, icon: Users },
    { id: 'accounts', label: t.accounts, icon: CreditCard },
    { id: 'documents', label: t.auditLogs, icon: FolderGit2 },
    { id: 'reports', label: t.reports, icon: PieChart },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  const navItems = role === 'admin' ? adminNavItems : userNavItems;

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-[var(--brand-aubergine)] text-white select-none justify-between p-4 w-64 border-r border-blue-950/40 shadow-2xl">
      {/* Top Header & Logo */}
      <div>
        <div className="flex items-center justify-between mb-8 px-2 pt-2">
          <button
            type="button"
            aria-label="Monalyz — accueil"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lilac)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--brand-aubergine)]"
            onClick={() => setActiveTab('dashboard')}
          >
            <BrandLogo
              tone="reversed-white"
              decorative
              priority
              className="h-auto w-[148px]"
            />
          </button>

          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              id="close-mobile-sidebar-btn"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                id={`nav-item-${item.id}`}
                className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        {/* Help Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all" />
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
            <Headphones className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-sm text-white mb-1">{t.needHelp}</h4>
          <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
            {t.helpSubtitle}
          </p>
          <button
            onClick={() => setIsContactModalOpen(true)}
            id="help-contact-us-btn"
            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
          >
            {t.contactUs}
          </button>
        </div>

        {/* Logout Button */}
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            window.location.replace('/login');
          }}
          id="sidebar-logout-btn"
          className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>{t.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block h-screen sticky top-0 z-30 shrink-0">
        {content}
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      {isOpenOnMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative z-10 h-full"
          >
            {content}
          </motion.div>
        </div>
      )}
    </>
  );
}
