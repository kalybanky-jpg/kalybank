'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import type { Language, OfficialDocumentType } from '@/lib/types';
import {
  Download,
  FileCheck2,
  FileText,
  ShieldCheck,
} from 'lucide-react';

const messages: Record<
  Language,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    available: string;
    empty: string;
    download: string;
    pending: string;
    revoked: string;
    demo: string;
    provenance: string;
    types: Record<OfficialDocumentType, string>;
  }
> = {
  fr: {
    eyebrow: 'Documents bancaires',
    title: 'Relevés, RIB et attestations',
    subtitle:
      'Téléchargez les documents officiels émis par Monalyz depuis les données validées par le personnel de la banque.',
    available: 'Documents disponibles',
    empty: 'Aucun document officiel n’a encore été émis.',
    download: 'Télécharger le PDF',
    pending: 'Publication en cours',
    revoked: 'Révoqué',
    demo: 'Démonstration — aucune valeur',
    provenance:
      'Chaque document comporte une référence, une version, une empreinte et la date de son émission. Il n’est pas certifié par un tiers externe.',
    types: {
      bank_details: 'RIB / coordonnées bancaires',
      account_statement: 'Relevé de compte',
      balance_certificate: 'Attestation de solde',
      transfer_confirmation: 'Confirmation de virement',
      loan_disbursement_confirmation: 'Avis de décaissement de prêt',
      loan_decision: 'Décision de prêt',
    },
  },
  en: {
    eyebrow: 'Bank documents',
    title: 'Statements, bank details and certificates',
    subtitle:
      'Download official Monalyz documents issued from data validated by bank staff.',
    available: 'Available documents',
    empty: 'No official document has been issued yet.',
    download: 'Download PDF',
    pending: 'Publication in progress',
    revoked: 'Revoked',
    demo: 'Demonstration — no legal value',
    provenance:
      'Each document includes a reference, version, fingerprint and issue date. It is not certified by an external third party.',
    types: {
      bank_details: 'Bank account details',
      account_statement: 'Account statement',
      balance_certificate: 'Balance certificate',
      transfer_confirmation: 'Transfer confirmation',
      loan_disbursement_confirmation: 'Loan disbursement notice',
      loan_decision: 'Loan decision',
    },
  },
  de: {
    eyebrow: 'Bankdokumente',
    title: 'Auszüge, Bankverbindung und Bescheinigungen',
    subtitle:
      'Laden Sie offizielle Monalyz-Dokumente aus den vom Bankpersonal bestätigten Daten herunter.',
    available: 'Verfügbare Dokumente',
    empty: 'Es wurde noch kein offizielles Dokument ausgestellt.',
    download: 'PDF herunterladen',
    pending: 'Veröffentlichung läuft',
    revoked: 'Widerrufen',
    demo: 'Demonstration — ohne Gültigkeit',
    provenance:
      'Jedes Dokument enthält Referenz, Version, Fingerabdruck und Ausstellungsdatum. Es ist nicht extern zertifiziert.',
    types: {
      bank_details: 'Bankverbindung',
      account_statement: 'Kontoauszug',
      balance_certificate: 'Saldenbescheinigung',
      transfer_confirmation: 'Überweisungsbestätigung',
      loan_disbursement_confirmation: 'Kreditauszahlungsanzeige',
      loan_decision: 'Kreditentscheidung',
    },
  },
  es: {
    eyebrow: 'Documentos bancarios',
    title: 'Extractos, datos bancarios y certificados',
    subtitle:
      'Descargue documentos oficiales de Monalyz emitidos a partir de datos validados por el personal del banco.',
    available: 'Documentos disponibles',
    empty: 'Todavía no se ha emitido ningún documento oficial.',
    download: 'Descargar PDF',
    pending: 'Publicación en curso',
    revoked: 'Revocado',
    demo: 'Demostración — sin validez',
    provenance:
      'Cada documento incluye referencia, versión, huella y fecha de emisión. No está certificado por un tercero externo.',
    types: {
      bank_details: 'Datos bancarios',
      account_statement: 'Extracto de cuenta',
      balance_certificate: 'Certificado de saldo',
      transfer_confirmation: 'Confirmación de transferencia',
      loan_disbursement_confirmation: 'Aviso de desembolso del préstamo',
      loan_decision: 'Decisión del préstamo',
    },
  },
};

export default function UserDocumentsView() {
  const { language, officialDocuments } = useAppStore();
  const t = messages[language];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6">
        <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
          <FileCheck2 className="w-4 h-4" />
          <span>{t.eyebrow}</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-1">{t.title}</h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl">
          {t.subtitle}
        </p>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <h2 className="font-extrabold text-slate-900 mb-4">{t.available}</h2>
        <div className="divide-y divide-slate-100">
          {officialDocuments.map((document) => (
            <article
              key={document.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-slate-900 truncate">
                    {document.title}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t.types[document.documentType]} · {document.documentNumber} · v
                    {document.version}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {document.issuedAt
                      ? new Date(document.issuedAt).toLocaleString(language)
                      : t.pending}
                    {document.isDemo ? ` · ${t.demo}` : ''}
                  </p>
                </div>
              </div>
              {document.status === 'issued' ? (
                <a
                  href={`/api/official-documents/${document.id}`}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t.download}
                </a>
              ) : (
                <span
                  className={`px-3 py-2 rounded-xl text-xs font-bold ${
                    document.status === 'revoked'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {document.status === 'revoked' ? t.revoked : t.pending}
                </span>
              )}
            </article>
          ))}
          {!officialDocuments.length && (
            <p className="py-12 text-center text-sm text-slate-500">{t.empty}</p>
          )}
        </div>
      </section>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
        <p className="text-xs text-blue-900 leading-relaxed">{t.provenance}</p>
      </div>
    </div>
  );
}
