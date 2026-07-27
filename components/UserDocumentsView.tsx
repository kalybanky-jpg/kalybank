'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import {
  FolderGit2,
  FileText,
  Download,
  Eye,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  Building,
  ShieldCheck,
} from 'lucide-react';

export default function UserDocumentsView() {
  const {
    language,
    setIsStatementsModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const [searchDoc, setSearchDoc] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const documentList = [
    { id: 'doc_1', title: 'Relevé bancaire mensuel - Juin 2026', type: 'PDF', size: '1.2 MB', date: '01/07/2026', category: 'Relevés' },
    { id: 'doc_2', title: 'Relevé bancaire mensuel - Mai 2026', type: 'PDF', size: '1.1 MB', date: '01/06/2026', category: 'Relevés' },
    { id: 'doc_3', title: 'Relevé bancaire mensuel - Avril 2026', type: 'PDF', size: '1.4 MB', date: '01/05/2026', category: 'Relevés' },
    { id: 'doc_4', title: 'Attestation de Solde Officielle (NovaBank)', type: 'PDF', size: '420 KB', date: '15/06/2026', category: 'Attestations' },
    { id: 'doc_5', title: 'Relevé d\'Identité Bancaire (RIB / IBAN)', type: 'PDF', size: '280 KB', date: '01/01/2026', category: 'RIB' },
    { id: 'doc_6', title: 'Imprimé Fiscal Unique (IFU 2025-2026)', type: 'PDF', size: '850 KB', date: '10/02/2026', category: 'Fiscal' },
  ];

  const filteredDocs = documentList.filter((doc) =>
    doc.title.toLowerCase().includes(searchDoc.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchDoc.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FolderGit2 className="w-4 h-4" />
            <span>{t.documents}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Documents, Relevés & Attestations
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Téléchargez vos relevés mensuels au format PDF certifié électroniquement avec signature numérique NovaBank.
          </p>
        </div>

        <button
          onClick={() => setIsStatementsModalOpen(true)}
          id="user-docs-generate-custom-btn"
          className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Générer un relevé sur-mesure</span>
        </button>
      </div>

      {/* Main Content Box */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Archives des Documents</h2>
              <p className="text-xs text-slate-500">6 documents disponibles au téléchargement</p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filtrer par nom ou type..."
              value={searchDoc}
              onChange={(e) => setSearchDoc(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Documents Table */}
        <div className="divide-y divide-slate-100">
          {filteredDocs.map((doc) => (
            <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 rounded-2xl px-3 transition">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                  PDF
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">{doc.title}</h3>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-medium mt-0.5">
                    <span>{doc.date}</span>
                    <span>•</span>
                    <span>{doc.size}</span>
                    <span>•</span>
                    <span className="font-bold text-indigo-600">{doc.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPreviewDoc(doc.title)}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-white text-slate-700 font-bold text-xs flex items-center space-x-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Aperçu</span>
                </button>
                <button
                  onClick={() => alert(`Téléchargement de "${doc.title}" démarré.`)}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6 relative">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs">
                  PDF
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Aperçu du Document</h3>
                  <p className="text-xs text-slate-500">Tampon de certification NovaBank S.A.</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-center">
              <ShieldCheck className="w-12 h-12 text-blue-600 mx-auto" />
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">{previewDoc}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Ce document est signé électroniquement et certifié conforme pour toutes démarches administratives.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  alert(`Téléchargement de "${previewDoc}" lancé.`);
                  setPreviewDoc(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
