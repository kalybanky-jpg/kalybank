'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import UserDashboard from '@/components/UserDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import WireTransferModal from '@/components/WireTransferModal';
import LoanApplicationModal from '@/components/LoanApplicationModal';
import NotificationsDrawer from '@/components/NotificationsDrawer';
import AccountStatementsModal from '@/components/AccountStatementsModal';
import ContactModal from '@/components/ContactModal';

interface MainAppLayoutProps {
  forcedRole?: 'user' | 'admin';
}

export default function MainAppLayout({ forcedRole }: MainAppLayoutProps) {
  const { role, isLoading, lastError } = useAppStore();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Route access is enforced by middleware; the role is always derived from
  // the authenticated staff_members row, never from the URL or client state.
  const currentRole = role;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-sm font-bold">
        Chargement sécurisé…
      </div>
    );
  }

  if (forcedRole === 'admin' && currentRole !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-extrabold">Accès Back-Office refusé</h1>
          <p className="text-sm text-slate-400 mt-2">
            {lastError ?? 'Une habilitation active est requise.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] flex text-slate-800 font-sans antialiased selection:bg-[#4b2df1] selection:text-white">
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
        <main className="flex-1">
          {currentRole === 'admin' ? <AdminDashboard /> : <UserDashboard />}
        </main>
      </div>

      {/* Modals & Drawers */}
      <WireTransferModal />
      <LoanApplicationModal />
      <NotificationsDrawer />
      <AccountStatementsModal />
      <ContactModal />
    </div>
  );
}
