'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { X, Bell, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatLocalizedDateTime } from '@/lib/language';
import { extraUserMessages, notificationCopy } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';

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
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col border-l border-slate-200"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold">{t.notifications.title}</h3>
            </div>
            <button
              onClick={() => setIsNotificationsDrawerOpen(false)}
              id="close-notifications-drawer-btn"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              aria-label={t.common.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900">{localized.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">
                      {formatLocalizedDateTime(n.createdAt, effectiveLanguage)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-snug">{localized.message}</p>
                  {n.actionPath && (
                    <a
                      href={n.actionPath}
                      className="inline-flex items-center gap-1 pt-1 text-[10px] font-bold text-blue-700 hover:underline"
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
