'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { X, Bell, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatLocalizedDateTime } from '@/lib/language';
import { extraUserMessages, notificationCopy } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';
import { DialogBackdrop, DialogPanel, Drawer } from '@/components/ui/Dialog';

export default function NotificationsDrawer() {
  const {
    language,
    role,
    notifications,
    isNotificationsDrawerOpen,
    setIsNotificationsDrawerOpen,
    markNotificationAsRead,
  } = useAppStore();

  const effectiveLanguage = role === 'admin' ? 'fr' : language;
  const t = useBranded(extraUserMessages[effectiveLanguage]);

  if (!isNotificationsDrawerOpen) return null;

  return (
    <AnimatePresence>
      <Drawer
        open={isNotificationsDrawerOpen}
        onClose={() => setIsNotificationsDrawerOpen(false)}
        ariaLabelledBy="notifications-drawer-title"
      >
        <DialogBackdrop className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/50 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-sm">
          <DialogPanel
            as={motion.div}
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl sm:max-w-sm"
          >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:p-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center space-x-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20 text-blue-400">
                <Bell className="w-5 h-5" />
              </div>
              <h3
                id="notifications-drawer-title"
                className="min-w-0 break-words text-base font-extrabold"
              >
                {t.notifications.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsNotificationsDrawerOpen(false)}
              id="close-notifications-drawer-btn"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label={t.common.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12 font-medium">{t.notifications.empty}</p>
            ) : (
              notifications.map((n, idx) => {
                const localized = role === 'admin'
                  ? { title: n.title, message: n.message }
                  : notificationCopy(language, n.messageKey, n.messageParams);
                return (
                <div
                  key={`${n.id}_${idx}`}
                  className={`p-3.5 rounded-2xl border transition space-y-1.5 ${
                    n.read ? 'bg-white border-slate-200 opacity-70' : 'bg-blue-50/80 border-blue-200 font-medium'
                  }`}
                >
                  <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:justify-between">
                    <span className="min-w-0 break-words text-xs font-extrabold text-slate-900">{localized.title}</span>
                    <span className="shrink-0 break-words font-mono text-[10px] font-medium text-slate-500">
                      {formatLocalizedDateTime(n.createdAt, effectiveLanguage)}
                    </span>
                  </div>
                  <p className="break-words text-xs leading-snug text-slate-700">{localized.message}</p>
                  {n.actionPath && (
                    <a
                      href={n.actionPath}
                      className="inline-flex max-w-full items-center gap-1 break-words pt-1 text-[10px] font-bold text-blue-700 hover:underline"
                    >
                      {t.notifications.openItem} <ArrowRight className="h-3 w-3" />
                    </a>
                  )}
                  {!n.read && (
                    <button
                      onClick={() => markNotificationAsRead(n.id)}
                      className="text-[10px] text-blue-600 font-bold hover:underline pt-1 block"
                    >
                      {t.notifications.markRead}
                    </button>
                  )}
                </div>
              )})
            )}
          </div>
          </DialogPanel>
        </DialogBackdrop>
      </Drawer>
    </AnimatePresence>
  );
}
