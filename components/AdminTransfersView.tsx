'use client';
import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency } from '@/lib/currency';
import {
  Send,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Globe,
  Building,
  Check,
  X,
  User,
} from 'lucide-react';

export default function AdminTransfersView() {
  const {
    language,
    currency,
    rates,
    pendingTransfers,
    approveTransfer,
    rejectTransfer,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const [statusFilter, setStatusFilter] = useState<'tous' | 'en_attente' | 'valide' | 'rejete'>('tous');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransfers = pendingTransfers.filter((tr) => {
    const matchesStatus = statusFilter === 'tous' || tr.status === statusFilter;
    const matchesSearch =
      tr.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.recipientAccount.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Send className="w-4 h-4" />
            <span>Historique & Audit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Historique des Virements Initiés
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Consultez le registre complet des virements effectués par les clients et gérez les validations.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setStatusFilter('tous')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === 'tous' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setStatusFilter('en_attente')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === 'en_attente' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              En attente
            </button>
            <button
              onClick={() => setStatusFilter('valide')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === 'valide' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Exécutés
            </button>
            <button
              onClick={() => setStatusFilter('rejete')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === 'rejete' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Rejetés
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Chercher bénéficiaire, IBAN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-3 font-bold px-2">Date / Réf</th>
                <th className="pb-3 font-bold px-2">Initiateur</th>
                <th className="pb-3 font-bold px-2">Bénéficiaire & IBAN</th>
                <th className="pb-3 font-bold px-2 text-right">Montant</th>
                <th className="pb-3 font-bold px-2 text-center">Statut</th>
                <th className="pb-3 font-bold px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {filteredTransfers.map((tr) => (
                <tr key={tr.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition group">
                  <td className="py-4 px-2 align-middle">
                    <p className="font-bold text-slate-900">{tr.date}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{tr.id}</p>
                  </td>
                  <td className="py-4 px-2 align-middle">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-3 h-3 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Client N°{tr.sourceAccountId || '0001'}</p>
                        <p className="text-[10px] text-slate-500">Compte Source</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2 align-middle">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        {tr.transferType !== 'eurozone' ? <Globe className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{tr.recipientName}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{tr.recipientAccount}</p>
                        {tr.details?.bicSwift && (
                          <p className="text-[10px] text-slate-400 font-mono">BIC: {tr.details.bicSwift}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2 align-middle text-right">
                    <p className="font-extrabold text-blue-600">
                      {formatCurrency(tr.amount, currency, rates, language)}
                    </p>
                  </td>
                  <td className="py-4 px-2 align-middle text-center">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        tr.status === 'valide'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tr.status === 'rejete'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tr.status === 'valide' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {tr.status === 'rejete' && <XCircle className="w-3 h-3 mr-1" />}
                      {tr.status !== 'valide' && tr.status !== 'rejete' && <Clock className="w-3 h-3 mr-1" />}
                      {tr.status === 'valide' ? 'Exécuté' : tr.status === 'rejete' ? 'Rejeté' : 'En attente'}
                    </span>
                  </td>
                  <td className="py-4 px-2 align-middle text-right">
                    {tr.status !== 'valide' && tr.status !== 'rejete' ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            if (window.confirm('Confirmer et libérer les fonds pour ce virement ?')) {
                              approveTransfer(tr.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition"
                          title="Valider le virement"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt('Motif du refus :');
                            if (reason !== null) {
                              rejectTransfer(tr.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 transition"
                          title="Refuser le virement"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">Archivé</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTransfers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                    Aucun virement trouvé pour cette recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
