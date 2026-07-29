'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { KYCApplication } from '@/lib/types';
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Soumis',
  under_review: 'En contrôle',
  approved: 'Identité approuvée',
  rejected: 'Rejeté',
  needs_information: 'Informations requises',
};

export default function AdminKycManagement() {
  const { kycApplications, approveKYCApplication, rejectKYCApplication } =
    useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<KYCApplication | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<'idFrontUrl' | 'idBackUrl' | 'selfieUrl'>('idFrontUrl');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredApplications = kycApplications.filter((application) => {
    const query = searchQuery.toLowerCase();
    return (
      application.firstName.toLowerCase().includes(query) ||
      application.lastName.toLowerCase().includes(query) ||
      application.email.toLowerCase().includes(query) ||
      application.id.toLowerCase().includes(query)
    );
  });

  const run = async (operation: () => Promise<void>) => {
    setError('');
    setIsSubmitting(true);
    try {
      await operation();
      setSelected(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Action impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Contrôle humain des dossiers d&apos;identité
            </h1>
            <p className="text-xs text-slate-500">
              L&apos;approbation confirme le contrôle KYC dans Monalyz. La déclaration
              d&apos;un compte et de son IBAN reste une action séparée du chef
              d&apos;agence, après le traitement interne de la banque.
            </p>
          </div>
        </div>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="relative max-w-sm mb-5">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nom, e-mail ou référence"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[750px]">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-3 px-2">Référence / date</th>
                <th className="pb-3 px-2">Demandeur</th>
                <th className="pb-3 px-2">État</th>
                <th className="pb-3 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredApplications.map((application) => {
                const status = application.workflowStatus ?? 'submitted';
                return (
                  <tr key={application.id} className="hover:bg-slate-50">
                    <td className="py-4 px-2">
                      <p className="font-mono font-bold text-slate-900">{application.id}</p>
                      <p className="text-[10px] text-slate-500">{application.submittedAt}</p>
                    </td>
                    <td className="py-4 px-2">
                      <p className="font-bold text-slate-900">
                        {application.firstName} {application.lastName}
                      </p>
                      <p className="text-[10px] text-slate-500">{application.email}</p>
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {status === 'approved' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : status === 'rejected' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(application);
                          setError('');
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-[11px] inline-flex gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Examiner
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredApplications.length && (
            <p className="py-10 text-center text-sm text-slate-500">Aucun dossier.</p>
          )}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <section className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-6 my-auto">
            <header className="flex justify-between items-start border-b pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {selected.firstName} {selected.lastName}
                </h2>
                <p className="text-xs text-slate-500 font-mono">{selected.id}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fermer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </header>

            {error && (
              <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  {[
                    ['idFrontUrl', 'Recto'],
                    ['idBackUrl', 'Verso'],
                    ['selfieUrl', 'Selfie'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setSelectedDocument(
                          key as 'idFrontUrl' | 'idBackUrl' | 'selfieUrl',
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                        selectedDocument === key
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="h-80 bg-slate-950 rounded-2xl flex items-center justify-center overflow-hidden">
                  {selected.documents[selectedDocument] ? (
                    selected.documents[selectedDocument].includes('.pdf?') ? (
                      <a
                        href={selected.documents[selectedDocument]}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="px-4 py-3 rounded-xl bg-white text-slate-900 text-xs font-bold"
                      >
                        Ouvrir le PDF privé
                      </a>
                    ) : (
                      // Signed, short-lived private URLs cannot be configured as a
                      // stable Next Image remote pattern.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selected.documents[selectedDocument]}
                        alt="Justificatif KYC privé"
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain"
                      />
                    )
                  ) : (
                    <p className="text-xs text-slate-400">Aperçu indisponible ou expiré.</p>
                  )}
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  Aucun score biométrique n&apos;est calculé par Monalyz. Comparez
                  manuellement les pièces et documentez la décision.
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Données déclarées
                </h3>
                <dl className="divide-y border rounded-2xl overflow-hidden">
                  {[
                    ['Naissance', `${selected.dateOfBirth} — ${selected.placeOfBirth}`],
                    ['Nationalité', selected.nationality],
                    [
                      'Adresse',
                      `${selected.address.street}, ${selected.address.postalCode} ${selected.address.city}, ${selected.address.country}`,
                    ],
                    ['Profession', selected.profile.occupation],
                    ['Revenus', selected.profile.incomeRange],
                    ['FATCA', selected.profile.fatca ? 'Déclaré oui' : 'Déclaré non'],
                    ['PPE', selected.profile.pep ? 'Déclaré oui' : 'Déclaré non'],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 flex justify-between gap-4">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-bold text-slate-900 text-right">{value}</dd>
                    </div>
                  ))}
                </dl>

                {['submitted', 'under_review', 'needs_information'].includes(
                  selected.workflowStatus ?? 'submitted',
                ) && (
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() =>
                        void run(() => approveKYCApplication(selected.id))
                      }
                      className="py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50"
                    >
                      Approuver l&apos;identité
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        const reason = window.prompt('Motif détaillé du rejet :')?.trim();
                        if (reason) {
                          void run(() => rejectKYCApplication(selected.id, reason));
                        }
                      }}
                      className="py-3 bg-rose-600 text-white rounded-xl font-bold disabled:opacity-50"
                    >
                      Rejeter
                    </button>
                  </div>
                )}

                {selected.workflowStatus === 'approved' && (
                  <p className="p-3 bg-emerald-50 text-emerald-800 rounded-xl font-bold">
                    Identité approuvée. Le compte et l&apos;IBAN peuvent maintenant
                    être déclarés depuis le registre bancaire.
                  </p>
                )}
                {selected.workflowStatus === 'rejected' && (
                  <p className="p-3 bg-rose-50 text-rose-800 rounded-xl">
                    Motif : {selected.rejectionReason}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
