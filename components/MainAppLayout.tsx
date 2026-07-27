'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import UserDashboard from '@/components/UserDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import WireTransferModal from '@/components/WireTransferModal';
import LoanApplicationModal from '@/components/LoanApplicationModal';
import EmailNotificationsDrawer from '@/components/EmailNotificationsDrawer';
import NotificationsDrawer from '@/components/NotificationsDrawer';
import AccountStatementsModal from '@/components/AccountStatementsModal';
import ContactModal from '@/components/ContactModal';
import SupabaseSettingsModal from '@/components/SupabaseSettingsModal';

interface MainAppLayoutProps {
  forcedRole?: 'user' | 'admin';
}

export default function MainAppLayout({ forcedRole }: MainAppLayoutProps) {
  const { role, setRole } = useAppStore();
  const pathname = usePathname();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (forcedRole) {
      setRole(forcedRole);
    } else if (pathname === '/admin' || pathname?.startsWith('/admin/')) {
      setRole('admin');
    } else if (pathname === '/myaccount' || pathname?.startsWith('/myaccount/')) {
      setRole('user');
    }
  }, [forcedRole, pathname, setRole]);

  const currentRole = forcedRole || role;

  return (
    <div className="min-h-screen bg-[#f4f6fa] flex text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        isOpenOnMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Sticky Header */}
        <Header onToggleMobileMenu={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} />

        {/* Dynamic View Content */}
        <main className="flex-1 pb-16">
          {currentRole === 'admin' ? <AdminDashboard /> : <UserDashboard />}
        </main>
      </div>

      {/* Modals & Drawers */}
      <WireTransferModal />
      <LoanApplicationModal />
      <EmailNotificationsDrawer />
      <NotificationsDrawer />
      <AccountStatementsModal />
      <ContactModal />
      <SupabaseSettingsModal />
    </div>
  );
}
