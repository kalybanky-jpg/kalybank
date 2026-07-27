'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency } from '@/lib/currency';
import {
  Send,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  Download,
  Info,
  ChevronRight,
  Globe,
  Building,
} from 'lucide-react';

export default function UserTransfersView() {
  const {
    language,
    currency,
    rates,
    pendingTransfers,
    setIsTransferModalOpen,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const [filterType, setFilterType] = useState<'tous' | 'sepa' | 'swift'>('tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

  const filteredTransfers = pendingTransfers.filter((tr) => {
    const matchesType =
      filterType === 'tous' ||
      (filterType === 'sepa' && tr.transferType === 'eurozone') ||
      (filterType === 'swift' && tr.transferType !== 'eurozone');
    const matchesSearch =
      tr.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.recipientAccount.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSearch;
  });

  const activeTransfer = pendingTransfers.find((tr) => tr.id === selectedTransferId) || pendingTransfers[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Send className="w-4 h-4" />
            <span>{t.transfers}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Espace Virements & Suivi Compliance
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Effectuez des virements nationaux SEPA ou internationaux SWIFT sécurisés par contrôle manuel en temps réel.
          </p>
        </div>

        <button
          onClick={() => setIsTransferModalOpen(true)}
          id="user-transfers-new-transfer-btn"
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.makeTransfer}</span>
        </button>
      </div>

      {/* Main Grid: Transfers List + Live Compliance Audit Sidecard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (lg:col-span-7): Transfers Table & Filters */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            {/* Filter Tabs */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => setFilterType('tous')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterType === 'tous' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Tous ({pendingTransfers.length})
              </button>
              <button
                onClick={() => setFilterType('sepa')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterType === 'sepa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                SEPA
              </button>
              <button
                onClick={() => setFilterType('swift')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterType === 'swift' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                SWIFT / Int.
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Rechercher bénéficiaire..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Transfers List */}
          <div className="space-y-3">
            {filteredTransfers.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-500">Aucun virement correspondant.</p>
            ) : (
              filteredTransfers.map((tr) => {
                const isSelected = activeTransfer?.id === tr.id;
                return (
                  <div
                    key={tr.id}
                    onClick={() => setSelectedTransferId(tr.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/10'
                        : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">
                        {tr.transferType !== 'eurozone' ? (
                          <Globe className="w-5 h-5" />
                        ) : (
                          <Building className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            {tr.recipientName}
                          </h4>
                          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                            {tr.transferType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          IBAN : {tr.recipientAccount}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4">
                      <div className="sm:text-right">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {formatCurrency(tr.amount, currency, rates, language)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {tr.date || 'Aujourd\'hui'}
                        </p>
                      </div>

                      {tr.status === 'valide' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Exécuté
                        </span>
                      ) : tr.status === 'rejete' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                          <XCircle className="w-3 h-3 mr-1" />
                          Refusé (Remboursé)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          <Clock className="w-3 h-3 mr-1 animate-pulse" />
                          {tr.complianceProgress || 25}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (lg:col-span-5): Selected Transfer Compliance Audit Card */}
        {activeTransfer && (
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Suivi Conformité Virement</h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">{activeTransfer.id}</span>
            </div>

            {/* Beneficiary Header Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Bénéficiaire :</span>
                <strong className="text-slate-900">{activeTransfer.recipientName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">IBAN / Compte :</span>
                <strong className="font-mono text-slate-800">{activeTransfer.recipientAccount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Montant :</span>
                <strong className="text-blue-600 font-extrabold">{formatCurrency(activeTransfer.amount, currency, rates, language)}</strong>
              </div>
              {activeTransfer.details?.bicSwift && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Code SWIFT / BIC :</span>
                  <strong className="font-mono text-slate-800">{activeTransfer.details.bicSwift}</strong>
                </div>
              )}
            </div>

            {/* Stepper Progress Steps */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Étapes de validation obligatoire
              </h4>

              {[
                { label: '1. Double validation interne', status: activeTransfer.complianceChecks?.doubleValidation || 'en_attente' },
                { label: '2. Escalade hiérarchique', status: activeTransfer.complianceChecks?.escalade || 'en_attente' },
                { label: '3. Contrôle conformité & sécurité', status: activeTransfer.complianceChecks?.controleConformite || 'en_attente' },
                { label: '4. Autorisation finale de virement', status: activeTransfer.complianceChecks?.autorisationFinale || 'en_attente' },
              ].map((step, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="font-bold text-slate-800">{step.label}</span>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md ${
                      step.status === 'termine'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : step.status === 'en_cours'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {step.status === 'termine' ? '✓ Validé' : step.status === 'en_cours' ? 'En cours' : 'En attente'}
                  </span>
                </div>
              ))}
            </div>

            {/* Download Receipt Button */}
            <button
              onClick={() => alert(`Reçu de virement ${activeTransfer.id} généré en PDF.`)}
              className="w-full py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger l&apos;avis d&apos;opéré (PDF)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
