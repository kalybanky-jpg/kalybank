'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { extraUserMessages } from '@/lib/user-i18n';
import { useBranded } from '@/components/brand/BrandProvider';
import { AlertTriangle, ArrowRight } from 'lucide-react';

const bannerTextByLang = {
  fr: {
    title: 'Vérification d’identité requise',
    noFile: 'Pour effectuer vos opérations bancaires (virements, comptes, etc.), veuillez finaliser la vérification de votre identité.',
    needsAction: 'Votre dossier d’identité nécessite une correction avant de pouvoir effectuer l’ensemble de vos opérations.',
    underReview: 'Votre dossier d’identité est en cours d’examen. L’accès complet à vos opérations sera débloqué dès sa validation.',
  },
  en: {
    title: 'Identity verification required',
    noFile: 'To perform your banking operations (transfers, accounts, etc.), please complete your identity verification.',
    needsAction: 'Your identity file requires a correction before you can perform all your operations.',
    underReview: 'Your identity file is currently under review. Full access to your operations will be unlocked upon approval.',
  },
  de: {
    title: 'Identitätsprüfung erforderlich',
    noFile: 'Um Ihre Bankgeschäfte (Überweisungen, Konten usw.) durchzuführen, schließen Sie bitte Ihre Identitätsprüfung ab.',
    needsAction: 'Ihre Identitätsunterlagen erfordern eine Korrektur, bevor Sie alle Bankgeschäfte ausführen können.',
    underReview: 'Ihre Identitätsunterlagen werden derzeit geprüft. Der vollständige Zugriff wird nach der Freigabe aktiviert.',
  },
  es: {
    title: 'Verificación de identidad requerida',
    noFile: 'Para realizar sus operaciones bancarias (transferencias, cuentas, etc.), complete la verificación de su identidad.',
    needsAction: 'Su expediente de identidad requiere una corrección antes de poder realizar todas sus operaciones.',
    underReview: 'Su expediente de identidad está en revisión. El acceso completo a sus operaciones se activará tras su validación.',
  },
  it: {
    title: 'Verifica dell’identità richiesta',
    noFile: 'Per effettuare le tue operazioni bancarie (bonifici, conti, ecc.), completa la verifica della tua identità.',
    needsAction: 'La tua pratica d’identità richiede una correzione prima di poter effettuare tutte le tue operazioni.',
    underReview: 'La tua pratica d’identità è in corso di esame. L’accesso completo alle tue operazioni sarà sbloccato dopo la convalida.',
  },
  nl: {
    title: 'Identiteitsverificatie vereist',
    noFile: 'Om uw bankverrichtingen (overschrijvingen, rekeningen, enz.) uit te voeren, voltooit u uw identiteitsverificatie.',
    needsAction: 'Uw identiteitsdossier vereist een correctie voordat u al uw verrichtingen kunt uitvoeren.',
    underReview: 'Uw identiteitsdossier wordt momenteel beoordeeld. Volledige toegang tot uw verrichtingen wordt geactiveerd na goedkeuring.',
  },
};

export default function KycGlobalBanner() {
  const { language, kycApplications, setActiveTab, role } = useAppStore();
  const copy = useBranded(extraUserMessages[language]);

  const activeKyc = kycApplications[0];
  const isKycApproved = activeKyc?.workflowStatus === 'approved';

  // Only render for regular user accounts when KYC is not approved
  if (role !== 'user' || isKycApproved) return null;

  const needsAction =
    activeKyc?.workflowStatus === 'needs_information' ||
    activeKyc?.workflowStatus === 'rejected';

  const texts = bannerTextByLang[language] || bannerTextByLang.fr;

  const title = texts.title;
  const description = !activeKyc
    ? texts.noFile
    : needsAction
    ? texts.needsAction
    : texts.underReview;

  const ctaText = !activeKyc
    ? copy.loanModal.kycStartVerification
    : needsAction
    ? copy.loanModal.kycCorrectFile
    : copy.loanModal.kycCheckStatus;

  return (
    <div className="mx-4 mt-4 sm:mx-6 sm:mt-6">
      <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 p-4 sm:p-5 text-white shadow-md shadow-rose-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start space-x-3.5 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/20 text-rose-400 shadow-inner">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-sm font-extrabold tracking-tight text-white sm:text-base">
                {title}
              </h3>
              <p className="mt-0.5 max-w-3xl break-words text-xs leading-relaxed text-rose-100/90 sm:text-xs">
                {description}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!activeKyc || needsAction ? (
              <button
                type="button"
                onClick={() => window.location.assign('/onboarding')}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-rose-600/30 transition hover:bg-rose-500 hover:shadow-rose-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
              >
                <span>{ctaText}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('kyc')}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-rose-600/30 transition hover:bg-rose-500 hover:shadow-rose-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
              >
                <span>{ctaText}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
