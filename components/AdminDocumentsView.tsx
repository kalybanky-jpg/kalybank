'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import {
  FolderGit2,
  FileText,
  Download,
  Search,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export default function AdminDocumentsView() {
  const {
    language,
    activityLogs,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const [searchLog, setSearchLog] = useState('');

  const filteredLogs = activityLogs.filter((log) =>
    log.description.toLowerCase().includes(searchLog.toLowerCase()) ||
    log.timestamp.toLowerCase().includes(searchLog.toLowerCase())
  );

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      ["ID,Horodatage,Description,Type", ...activityLogs.map(l => `${l.id},${l.timestamp},"${l.description}",${l.type}`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_novabank_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FolderGit2 className="w-4 h-4" />
            <span>Gestion Documentaire & Audit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Archives & Journaux d&apos;Audit Système
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Générez les relevés de comptes officiels des clients et exportez les registres de traçabilité réglementaire.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center space-x-2 backdrop-blur-md transition border border-white/10 shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exporter Audit (CSV)</span>
          </button>
        </div>
      </div>

      {/* Audit Logs Box */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Registre d&apos;Audit en Temps Réel</h2>
              <p className="text-xs text-slate-500">{activityLogs.length} événements enregistrés</p>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Rechercher événements..."
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Logs List */}
        <div className="space-y-2 text-xs">
          {filteredLogs.map((log, idx) => (
            <div key={`${log.id}_${idx}`} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition">
              <div className="flex items-center space-x-3">
                <span className="font-mono font-bold text-slate-400 text-[11px] shrink-0">{log.timestamp}</span>
                <p className="text-slate-800 font-semibold">{log.description}</p>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                  log.type === 'success'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : log.type === 'alert'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {log.type === 'success' ? 'Succès' : log.type === 'alert' ? 'Alerte' : 'Info'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
