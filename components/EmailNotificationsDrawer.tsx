'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { EmailNotification } from '@/lib/types';
import { X, Mail, CheckCircle2, AlertTriangle, Eye, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function EmailNotificationsDrawer() {
  const { language, emails, isEmailDrawerOpen, setIsEmailDrawerOpen } = useAppStore();
  const t = translations[language] || translations.fr;

  const [selectedEmail, setSelectedEmail] = useState<EmailNotification | null>(null);

  if (!isEmailDrawerOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-lg bg-[#121826] h-full shadow-2xl flex flex-col border-l border-white/10"
        >
          {/* Header */}
          <div className="bg-[#080b11] text-white p-5 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">{t.emailNotificationsTitle}</h3>
                <p className="text-xs text-slate-400">Journal des e-mails HTML générés automatiquement</p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedEmail(null);
                setIsEmailDrawerOpen(false);
              }}
              id="close-email-drawer-btn"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#080b11]">
            {selectedEmail ? (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="flex items-center space-x-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour à la liste des e-mails</span>
                </button>

                <div className="bg-[#121826] p-4 rounded-2xl border border-white/10 shadow-sm space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Destinataire : <strong className="text-slate-200">{selectedEmail.recipientName}</strong> ({selectedEmail.recipientEmail})</span>
                    <span>{selectedEmail.sentAt}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                    {selectedEmail.subject}
                  </h4>

                  {/* Render HTML Body safely */}
                  <div
                    className="p-3 border border-white/10 rounded-xl bg-white text-slate-900 my-3 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                  />
                </div>
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-16 space-y-2 text-slate-400">
                <Mail className="w-10 h-10 mx-auto text-slate-500" />
                <p className="text-sm font-semibold">{t.noEmailsSent}</p>
              </div>
            ) : (
              emails.map((email, idx) => (
                <div
                  key={`${email.id}_${idx}`}
                  onClick={() => setSelectedEmail(email)}
                  className="p-4 rounded-2xl bg-[#121826] border border-white/10 hover:border-indigo-500/50 shadow-sm transition cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {email.type}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">{email.sentAt}</span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition">
                      {email.subject}
                    </h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{email.previewText}</p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/10">
                    <span>À : {email.recipientName}</span>
                    <span className="text-indigo-400 font-bold flex items-center group-hover:underline">
                      <Eye className="w-3.5 h-3.5 mr-1" /> {t.viewEmailBody}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
