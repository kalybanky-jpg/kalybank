'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { BarChart3, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useBrand } from '@/components/brand/BrandProvider';

export default function AdminReportsView() {
  const { brand } = useBrand();
  const { pendingTransfers, loans, kycApplications } = useAppStore();

  const terminalFailures =
    pendingTransfers.filter((item) =>
      ['rejected', 'cancelled', 'external_failed'].includes(item.workflowStatus ?? ''),
    ).length +
    loans.filter((item) =>
      ['rejected', 'cancelled', 'external_failed'].includes(item.workflowStatus ?? ''),
    ).length;
  const completedOperations =
    pendingTransfers.filter(
      (item) => item.workflowStatus === 'external_settlement_confirmed',
    ).length +
    loans.filter((item) => item.workflowStatus === 'external_settlement_confirmed').length;
  const openWorkflows =
    pendingTransfers.length + loans.length - terminalFailures - completedOperations;

  return (
    <div className="min-w-0 space-y-6">
      <header className="rounded-3xl bg-slate-900 p-4 text-white sm:p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <BarChart3 className="w-4 h-4" />
          <span>Indicateurs applicatifs</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">Rapport opérationnel {brand.bankName}</h1>
        <p className="text-xs text-slate-300 mt-2">
          Les métriques portent sur les comptes et opérations enregistrés par le
          personnel dans {brand.bankName}.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Workflows ouverts',
            value: openWorkflows,
            icon: Clock,
            color: 'text-amber-700 bg-amber-50',
          },
          {
            label: 'Opérations bancaires finalisées',
            value: completedOperations,
            icon: CheckCircle2,
            color: 'text-emerald-700 bg-emerald-50',
          },
          {
            label: 'Terminaux négatifs',
            value: terminalFailures,
            icon: XCircle,
            color: 'text-rose-700 bg-rose-50',
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${metric.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-500 mt-4">{metric.label}</p>
              <p className="text-3xl font-extrabold text-slate-900">{metric.value}</p>
            </article>
          );
        })}
      </section>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="font-extrabold text-slate-900">Contrôle d&apos;identité</h2>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-4">
          {['submitted', 'under_review', 'approved', 'rejected'].map((status) => (
            <div key={status} className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-500">{status.replaceAll('_', ' ')}</p>
              <p className="text-xl font-extrabold text-slate-900">
                {kycApplications.filter((item) => item.workflowStatus === status).length}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
