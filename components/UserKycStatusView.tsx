'use client';

import React from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { kycStatusLabels } from '@/lib/kyc-i18n';
import { formatLocalizedDate, formatLocalizedDateTime } from '@/lib/language';
import { useBranded } from '@/components/brand/BrandProvider';

const COPY = {
  fr: { title: 'Suivi de mon identité', submitted: 'Date de soumission', next: 'Prochaine action', waiting: 'Aucune action requise. {bankName} examine votre dossier.', correct: 'Corrigez uniquement les éléments signalés puis resoumettez le même dossier.', done: 'Votre identité est confirmée et votre compte interne est ouvert.', edit: 'Corriger mon dossier', noFile: 'Aucun dossier KYC soumis.', start: 'Commencer la vérification', due: 'Échéance' },
  en: { title: 'My identity status', submitted: 'Submission date', next: 'Next action', waiting: 'No action required. {bankName} is reviewing your file.', correct: 'Correct only the flagged items, then resubmit the same file.', done: 'Your identity is confirmed and your internal account is open.', edit: 'Correct my file', noFile: 'No KYC file submitted.', start: 'Start verification', due: 'Due date' },
  de: { title: 'Status meiner Identität', submitted: 'Einreichungsdatum', next: 'Nächste Aktion', waiting: 'Keine Aktion erforderlich. {bankName} prüft Ihre Unterlagen.', correct: 'Korrigieren Sie nur die markierten Elemente und reichen Sie denselben Vorgang erneut ein.', done: 'Ihre Identität wurde bestätigt und Ihr internes Konto eröffnet.', edit: 'Unterlagen korrigieren', noFile: 'Keine KYC-Unterlagen eingereicht.', start: 'Prüfung starten', due: 'Frist' },
  es: { title: 'Estado de mi identidad', submitted: 'Fecha de envío', next: 'Próxima acción', waiting: 'No se requiere ninguna acción. {bankName} está revisando su expediente.', correct: 'Corrija únicamente los elementos indicados y vuelva a enviar el mismo expediente.', done: 'Su identidad está confirmada y su cuenta interna está abierta.', edit: 'Corregir mi expediente', noFile: 'No se ha enviado ningún expediente KYC.', start: 'Iniciar verificación', due: 'Fecha límite' },
} as const;

const REASON_LABELS: Record<string, Record<string, string>> = {
  unreadable_document: { fr: 'Document illisible', en: 'Unreadable document', de: 'Dokument unleserlich', es: 'Documento ilegible' },
  expired_document: { fr: 'Document expiré', en: 'Expired document', de: 'Dokument abgelaufen', es: 'Documento caducado' },
  inconsistent_information: { fr: 'Informations incohérentes', en: 'Inconsistent information', de: 'Widersprüchliche Angaben', es: 'Información incoherente' },
  missing_document: { fr: 'Document manquant', en: 'Missing document', de: 'Dokument fehlt', es: 'Documento ausente' },
  selfie_mismatch: { fr: 'Selfie non concordant', en: 'Selfie mismatch', de: 'Selfie stimmt nicht überein', es: 'El selfie no coincide' },
  address_not_verified: { fr: 'Adresse non vérifiable', en: 'Address could not be verified', de: 'Adresse nicht überprüfbar', es: 'No se pudo verificar la dirección' },
  regulatory_information: { fr: 'Informations réglementaires à compléter', en: 'Regulatory information required', de: 'Regulatorische Angaben erforderlich', es: 'Información normativa requerida' },
  other: { fr: 'Autre correction demandée', en: 'Other correction required', de: 'Andere Korrektur erforderlich', es: 'Otra corrección necesaria' },
};
const ITEM_LABELS: Record<string, Record<string, string>> = {
  identity: { fr: 'Identité', en: 'Identity', de: 'Identität', es: 'Identidad' },
  birth: { fr: 'Naissance', en: 'Birth details', de: 'Geburtsdaten', es: 'Nacimiento' },
  address: { fr: 'Adresse', en: 'Address', de: 'Adresse', es: 'Dirección' },
  profile: { fr: 'Profil réglementaire', en: 'Regulatory profile', de: 'Regulatorisches Profil', es: 'Perfil normativo' },
  document_metadata: { fr: 'Informations de la pièce', en: 'Document details', de: 'Dokumentangaben', es: 'Datos del documento' },
  id_front: { fr: 'Recto', en: 'Document front', de: 'Vorderseite', es: 'Anverso' },
  id_back: { fr: 'Verso', en: 'Document back', de: 'Rückseite', es: 'Reverso' },
  selfie: { fr: 'Selfie', en: 'Selfie', de: 'Selfie', es: 'Selfie' },
  proof_of_address: { fr: 'Justificatif de domicile', en: 'Proof of address', de: 'Adressnachweis', es: 'Justificante de domicilio' },
};

export default function UserKycStatusView() {
  const { language, kycApplications } = useAppStore();
  const copy = useBranded(COPY[language]);
  const application = kycApplications[0];

  if (!application) return (
    <div className="mx-auto max-w-3xl min-w-0 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <section className="min-w-0 rounded-3xl border bg-white p-4 text-center sm:p-8">
        <ShieldCheck className="mx-auto h-12 w-12 text-blue-600" />
        <h1 className="mt-4 break-words text-xl font-extrabold">{copy.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{copy.noFile}</p>
        <a href="/onboarding" className="mt-6 inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white sm:w-auto">{copy.start}<ArrowRight className="h-4 w-4 shrink-0" /></a>
      </section>
    </div>
  );

  const status = application.workflowStatus ?? 'submitted';
  const needsAction = status === 'needs_information' || status === 'rejected';
  const approved = status === 'approved';
  const Icon = approved ? CheckCircle2 : needsAction ? XCircle : Clock3;
  const nextAction = approved ? copy.done : needsAction ? copy.correct : copy.waiting;

  return (
    <div className="mx-auto max-w-4xl min-w-0 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="mb-4 sm:mb-6"><h1 className="break-words text-xl font-extrabold text-slate-950 sm:text-2xl">{copy.title}</h1></header>
      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${approved ? 'bg-emerald-100 text-emerald-700' : needsAction ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}><Icon className="h-6 w-6" /></span>
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">KYC</span>
            <h2 className="mt-1 break-words text-lg font-extrabold sm:text-xl">{kycStatusLabels[language][status]}</h2>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl bg-slate-50 p-4"><dt className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="h-4 w-4 shrink-0" />{copy.submitted}</dt><dd className="mt-2 break-words text-sm font-bold">{formatLocalizedDateTime(application.submittedAt, language)}</dd></div>
          <div className="min-w-0 rounded-2xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">{copy.next}</dt><dd className="mt-2 break-words text-sm font-bold">{nextAction}</dd></div>
        </dl>
        {needsAction && <>
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="font-extrabold">
              {(REASON_LABELS[application.correctionReasonCode ?? 'other'] ?? REASON_LABELS.other)[language]}
            </p>
            {application.requestedItems.length > 0 && <p className="mt-2 break-words text-xs [overflow-wrap:anywhere]">{application.requestedItems.map((item) => (ITEM_LABELS[item] ?? REASON_LABELS.other)[language]).join(' · ')}</p>}
            {application.correctionDueAt && <p className="mt-2 text-xs">{copy.due} : {formatLocalizedDate(application.correctionDueAt, language)}</p>}
          </div>
          <a href="/onboarding" className="mt-5 inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white sm:w-auto">{copy.edit}<ArrowRight className="h-4 w-4 shrink-0" /></a>
        </>}
      </section>
    </div>
  );
}
