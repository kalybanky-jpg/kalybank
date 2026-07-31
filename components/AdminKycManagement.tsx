'use client';

import React, { useState } from 'react';
import {
  CheckCircle2, Clock, Eye, FileText, Search, ShieldCheck, X, XCircle,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { KYCApplication, KYCReviewChecklist, KYCReviewState } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Soumis', under_review: 'En vérification', approved: 'Approuvé',
  rejected: 'Rejeté', needs_information: 'Complément requis', resubmitted: 'Resoumis',
};
const CHECKS: [keyof KYCReviewChecklist, string][] = [
  ['documentQuality', 'Qualité et validité des pièces'],
  ['dataConsistency', 'Cohérence des données déclarées'],
  ['selfieMatch', 'Comparaison manuelle du selfie'],
  ['adulthood', 'Contrôle de majorité'],
  ['fatca', 'Contrôle FATCA'],
  ['pep', 'Contrôle PPE'],
];
const REQUEST_ITEMS = [
  ['identity', 'Identité'], ['birth', 'Naissance'], ['address', 'Adresse'],
  ['profile', 'Profil FATCA/PPE'], ['document_metadata', 'Informations de la pièce'],
  ['id_front', 'Recto'], ['id_back', 'Verso'], ['selfie', 'Selfie'],
  ['proof_of_address', 'Justificatif de domicile'],
] as const;
const REASONS = [
  ['unreadable_document', 'Document illisible'], ['expired_document', 'Document expiré'],
  ['inconsistent_information', 'Informations incohérentes'], ['missing_document', 'Document manquant'],
  ['selfie_mismatch', 'Selfie non concordant'], ['address_not_verified', 'Adresse non vérifiable'],
  ['regulatory_information', 'Informations réglementaires'], ['other', 'Autre'],
] as const;
const EMPTY_CHECKLIST: KYCReviewChecklist = {
  documentQuality: 'pending', dataConsistency: 'pending', selfieMatch: 'pending',
  adulthood: 'pending', fatca: 'pending', pep: 'pending', internalComments: '',
};

export default function AdminKycManagement() {
  const {
    kycApplications, beginKYCReview, updateKYCChecklist,
    requestKYCInformation, approveKYCApplication, rejectKYCApplication,
  } = useAppStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<KYCApplication | null>(null);
  const [documentKey, setDocumentKey] =
    useState<'idFrontUrl' | 'idBackUrl' | 'selfieUrl' | 'proofOfAddressUrl'>('idFrontUrl');
  const [checklist, setChecklist] = useState<KYCReviewChecklist>(EMPTY_CHECKLIST);
  const [requested, setRequested] = useState<string[]>([]);
  const [reasonCode, setReasonCode] = useState('unreadable_document');
  const [note, setNote] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openApplication = (application: KYCApplication) => {
    setSelected(application);
    setChecklist(application.checklist ?? EMPTY_CHECKLIST);
    setRequested([]);
    setNote('');
    setError('');
  };

  const applications = kycApplications.filter((application) => {
    const query = search.toLowerCase();
    return `${application.firstName} ${application.lastName} ${application.email} ${application.id}`
      .toLowerCase().includes(query);
  });

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setSelected(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggleRequested = (item: string) =>
    setRequested((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Contrôle structuré des identités</h1>
            <p className="text-xs text-slate-500">L’approbation crée automatiquement un compte actif avec son numéro interne. IBAN, BIC et agence restent gérés hors Monalyz.</p>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="relative mb-5 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, e-mail ou référence" className="w-full rounded-xl border bg-slate-50 py-2 pl-9 pr-3 text-xs" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead><tr className="border-b text-[10px] uppercase text-slate-500"><th className="px-2 pb-3">Référence / date</th><th className="px-2 pb-3">Demandeur</th><th className="px-2 pb-3">État</th><th className="px-2 pb-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y">
              {applications.map((application) => {
                const status = application.workflowStatus ?? 'submitted';
                return <tr key={application.id} className="hover:bg-slate-50">
                  <td className="px-2 py-4"><p className="font-mono font-bold">{application.id}</p><p className="text-[10px] text-slate-500">{application.submittedAt}</p></td>
                  <td className="px-2 py-4"><p className="font-bold">{application.firstName} {application.lastName}</p><p className="text-[10px] text-slate-500">{application.email}</p></td>
                  <td className="px-2 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${status === 'approved' ? 'bg-emerald-100 text-emerald-800' : status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{status === 'approved' ? <CheckCircle2 className="h-3 w-3" /> : status === 'rejected' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{STATUS_LABELS[status]}</span></td>
                  <td className="px-2 py-4 text-right"><button type="button" onClick={() => openApplication(application)} className="inline-flex gap-1 rounded-xl bg-blue-600 px-3 py-2 font-bold text-white"><Eye className="h-3.5 w-3.5" />Examiner</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm">
        <section className="mx-auto my-4 w-full max-w-6xl space-y-6 rounded-3xl bg-white p-6">
          <header className="flex items-start justify-between border-b pb-4">
            <div><h2 className="text-lg font-extrabold">{selected.firstName} {selected.lastName}</h2><p className="font-mono text-xs text-slate-500">{selected.id}</p></div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Fermer"><X className="h-5 w-5" /></button>
          </header>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {([
                  ['idFrontUrl', 'Recto'], ['idBackUrl', 'Verso'], ['selfieUrl', 'Selfie'],
                  ['proofOfAddressUrl', 'Domicile'],
                ] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setDocumentKey(key)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${documentKey === key ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>{label}</button>)}
              </div>
              <div className="flex h-80 items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
                {selected.documents[documentKey] ? selected.documents[documentKey].includes('.pdf?')
                  ? <a href={selected.documents[documentKey]} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 text-xs font-bold">Ouvrir le PDF privé</a>
                  // Signed, short-lived private URLs cannot use a stable next/image pattern.
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={selected.documents[documentKey]} alt="Justificatif KYC privé" referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
                  : <p className="text-xs text-slate-400">Aperçu indisponible.</p>}
              </div>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">La comparaison du selfie reste entièrement manuelle.</p>
            </div>

            <div className="space-y-4 text-xs">
              <h3 className="flex items-center gap-2 font-extrabold"><FileText className="h-4 w-4 text-blue-600" />Données déclarées</h3>
              <dl className="divide-y overflow-hidden rounded-2xl border">
                {[
                  ['Naissance', `${selected.dateOfBirth} — ${selected.placeOfBirth}`],
                  ['Nationalité', selected.nationality],
                  ['Adresse', `${selected.address.street}, ${selected.address.postalCode} ${selected.address.city}, ${selected.address.country}`],
                  ['Profession', selected.profile.occupation], ['Revenus', selected.profile.incomeRange],
                  ['FATCA', selected.profile.fatca ? 'Oui' : 'Non'], ['PPE', selected.profile.pep ? 'Oui' : 'Non'],
                  ['Type de pièce', selected.documentType ?? '—'], ['Numéro', selected.documentNumber ?? '—'],
                  ['Pays émetteur', selected.issuingCountry ?? '—'], ['Expiration', selected.documentExpiresOn ?? '—'],
                ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 p-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-bold">{value}</dd></div>)}
              </dl>
            </div>
          </div>

          {['submitted', 'resubmitted'].includes(selected.workflowStatus ?? 'submitted') &&
            <button type="button" disabled={busy} onClick={() => void run(() => beginKYCReview(selected.id))} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50">Commencer l’examen</button>}

          {selected.workflowStatus === 'under_review' && <div className="grid gap-6 border-t pt-6 lg:grid-cols-2">
            <section>
              <h3 className="font-extrabold">Checklist administrative</h3>
              <div className="mt-3 space-y-3">
                {CHECKS.map(([key, label]) => <label key={key} className="grid grid-cols-[1fr_170px] items-center gap-3 rounded-xl border p-3 text-xs"><span>{label}</span><select value={checklist[key] as string} onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.value as KYCReviewState }))} className="rounded-lg border p-2"><option value="pending">À contrôler</option><option value="compliant">Conforme</option><option value="non_compliant">Non conforme</option></select></label>)}
                <label className="block text-xs font-bold">Commentaires internes<textarea value={checklist.internalComments} onChange={(event) => setChecklist((current) => ({ ...current, internalComments: event.target.value }))} className="mt-2 min-h-24 w-full rounded-xl border p-3 font-normal" /></label>
                <button type="button" disabled={busy} onClick={() => void run(() => updateKYCChecklist(selected.id, checklist))} className="w-full rounded-xl border border-blue-600 py-3 font-bold text-blue-700">Enregistrer la checklist</button>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-extrabold">Décision ou complément</h3>
              <div className="grid grid-cols-2 gap-2">
                {REQUEST_ITEMS.map(([key, label]) => <label key={key} className="flex gap-2 rounded-lg border p-2 text-xs"><input type="checkbox" checked={requested.includes(key)} onChange={() => toggleRequested(key)} />{label}</label>)}
              </div>
              <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="w-full rounded-xl border p-3 text-xs">{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Motif communiqué au client" className="min-h-24 w-full rounded-xl border p-3 text-xs" />
              <label className="block text-xs font-bold">Échéance facultative<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
              <button type="button" disabled={busy || !requested.length || !note.trim()} onClick={() => void run(async () => {
                await updateKYCChecklist(selected.id, checklist);
                await requestKYCInformation(selected.id, requested, reasonCode, note, dueAt ? new Date(dueAt).toISOString() : undefined);
              })} className="w-full rounded-xl bg-amber-500 py-3 font-bold text-white disabled:opacity-40">Demander un complément ciblé</button>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => void run(async () => { await updateKYCChecklist(selected.id, checklist); await approveKYCApplication(selected.id, checklist.internalComments); })} className="rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">Approuver et créer le compte</button>
                <button type="button" disabled={busy || !note.trim()} onClick={() => void run(async () => { await updateKYCChecklist(selected.id, checklist); await rejectKYCApplication(selected.id, note, reasonCode); })} className="rounded-xl bg-rose-600 py-3 font-bold text-white disabled:opacity-50">Rejeter</button>
              </div>
            </section>
          </div>}

          {selected.workflowStatus === 'approved' && <p className="rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">Identité approuvée : le compte courant interne a été créé automatiquement.</p>}
          {selected.workflowStatus === 'rejected' && <p className="rounded-xl bg-rose-50 p-4 text-rose-800">Motif : {selected.rejectionReason}. Le client peut corriger et resoumettre ce même dossier.</p>}
        </section>
      </div>}
    </div>
  );
}
