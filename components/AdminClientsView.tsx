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
    <div className="min-w-0 space-y-6">
      <header className="rounded-3xl bg-slate-900 p-4 text-white sm:p-6">
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

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="relative max-w-sm mb-5">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nom ou e-mail" className="min-h-11 w-full rounded-xl border py-2 pl-9 pr-3 text-xs" />
        </div>
        <div className="grid min-w-0 gap-3 md:hidden">
          {filtered.map((application) => {
            const accountCount = accounts.filter(
              (account) => account.ownerId === application.ownerId,
            ).length;
            return (
              <article key={application.id} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="break-words text-xs font-extrabold text-slate-900">
                  {application.firstName} {application.lastName}
                </p>
                <p className="mt-1 break-all text-[10px] text-slate-500">{application.email}</p>
                <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-[10px] min-[360px]:grid-cols-2">
                  <div className="rounded-xl bg-white p-2.5">
                    <dt className="text-slate-500">Contrôle identité</dt>
                    <dd className="mt-1 break-words font-bold text-slate-700">
                      {application.workflowStatus?.replaceAll('_', ' ')}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-white p-2.5">
                    <dt className="text-slate-500">Comptes bancaires</dt>
                    <dd className="mt-1 font-bold text-slate-700">{accountCount}</dd>
                  </div>
                </dl>
                <p className="mt-3 break-all font-mono text-[10px] text-slate-500">
                  Dossier {application.id}
                </p>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
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
        </div>
        {!filtered.length && <p className="py-10 text-center text-sm text-slate-500">Aucun utilisateur.</p>}
      </section>
    </div>
  );
}
