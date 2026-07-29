'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Search, Users } from 'lucide-react';

export default function AdminClientsView() {
  const { kycApplications, accounts } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = kycApplications.filter((application) => {
    const query = searchQuery.toLowerCase();
    return (
      application.firstName.toLowerCase().includes(query) ||
      application.lastName.toLowerCase().includes(query) ||
      application.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <Users className="w-4 h-4" />
          <span>Registre clients</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">Utilisateurs et contrôles d&apos;identité</h1>
        <p className="text-xs text-slate-300 mt-2">
          Consultez les clients, leur contrôle d&apos;identité et les comptes
          bancaires déclarés après traitement interne.
        </p>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="relative max-w-sm mb-5">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nom ou e-mail" className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b text-[10px] uppercase text-slate-500">
                <th className="pb-3 px-2">Utilisateur</th>
                <th className="pb-3 px-2">Contrôle identité</th>
                <th className="pb-3 px-2">Comptes bancaires</th>
                <th className="pb-3 px-2">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {filtered.map((application) => (
                <tr key={application.id}>
                  <td className="py-4 px-2">
                    <p className="font-bold text-slate-900">{application.firstName} {application.lastName}</p>
                    <p className="text-[10px] text-slate-500">{application.email}</p>
                  </td>
                  <td className="py-4 px-2 font-bold text-slate-700">
                    {application.workflowStatus?.replaceAll('_', ' ')}
                  </td>
                  <td className="py-4 px-2 text-slate-600">
                    {accounts.filter((account) => account.ownerId === application.ownerId).length}
                  </td>
                  <td className="py-4 px-2 font-mono text-[10px] text-slate-500">
                    {application.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="py-10 text-center text-sm text-slate-500">Aucun utilisateur.</p>}
        </div>
      </section>
    </div>
  );
}
