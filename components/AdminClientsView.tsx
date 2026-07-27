'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { translations } from '@/lib/i18n';
import { formatCurrency } from '@/lib/currency';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  ShieldCheck,
  CreditCard,
  Building,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
} from 'lucide-react';

export default function AdminClientsView() {
  const {
    language,
    currency,
    rates,
    kycApplications,
    accounts,
  } = useAppStore();

  const t = translations[language] || translations.fr;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  // Synthesize client database from KYC applications
  const clients = kycApplications.map((app) => ({
    id: app.id,
    name: `${app.firstName} ${app.lastName}`,
    email: app.email,
    phone: '+33 6 88 99 00 11',
    address: `${app.address?.street || '12 Rue de la Paix'}, ${app.address?.postalCode || '75002'} ${app.address?.city || 'Paris'}`,
    kycStatus: app.status,
    iban: app.iban || 'FR76 1234 5678 9012 3456 789',
    totalDeposits: 142500,
    accountsCount: 2,
    joinedDate: app.submittedAt,
  }));

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.iban.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl border border-blue-900/40">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Gestion CRM & Portefeuille Client</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Annuaire des Clients NovaBank
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Consultez les dossiers clients, vérifiez l&apos;état de conformité KYC et supervisez les encours des comptes rattachés.
          </p>
        </div>
      </div>

      {/* Content Box */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Base Clientèle ({clients.length})</h2>
              <p className="text-xs text-slate-500">Mise à jour en temps réel</p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Rechercher nom, email, IBAN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Clients Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Client</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Statut KYC</th>
                <th className="py-3 px-3">IBAN Principal</th>
                <th className="py-3 px-3">Comptes</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-bold flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900">{client.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Inscrit le {client.joinedDate}</p>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-800">{client.email}</p>
                    <p className="text-[10px] text-slate-400">{client.phone}</p>
                  </td>
                  <td className="py-3 px-3">
                    {client.kycStatus === 'valide' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        KYC Validé
                      </span>
                    ) : client.kycStatus === 'rejete' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Refusé
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3 mr-1" />
                        En attente
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-700">
                    {client.iban}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {client.accountsCount} Comptes
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setSelectedClient(client)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-blue-600 font-bold text-xs flex items-center space-x-1 ml-auto transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Fiche Client</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6 relative">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm">
                  {selectedClient.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">{selectedClient.name}</h3>
                  <p className="text-xs text-slate-500">Inscrit le {selectedClient.joinedDate}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs font-medium">
              <div className="flex items-center space-x-2 text-slate-800">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{selectedClient.email}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{selectedClient.phone}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{selectedClient.address}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between">
                <span className="text-slate-400">IBAN Compte Courant:</span>
                <strong className="font-mono text-blue-700">{selectedClient.iban}</strong>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
