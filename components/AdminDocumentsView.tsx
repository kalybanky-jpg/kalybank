'use client';

import React, { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { OfficialDocumentType } from '@/lib/types';
import {
  Download,
  FileCheck2,
  FileText,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useBrand } from '@/components/brand/BrandProvider';
import { Dialog, DialogBackdrop, DialogPanel } from '@/components/ui/Dialog';

const DOCUMENT_TYPES: Array<{
  value: OfficialDocumentType;
  label: string;
}> = [
  { value: 'bank_details', label: 'RIB / coordonnées bancaires' },
  { value: 'account_statement', label: 'Relevé de compte' },
  { value: 'balance_certificate', label: 'Attestation de solde' },
  { value: 'transfer_confirmation', label: 'Confirmation de virement' },
  {
    value: 'loan_disbursement_confirmation',
    label: 'Avis de décaissement de prêt',
  },
  { value: 'loan_decision', label: 'Décision de prêt' },
];

function defaultPeriod() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export default function AdminDocumentsView() {
  const { brand } = useBrand();
  const {
    accounts,
    pendingTransfers,
    loans,
    officialDocuments,
    activityLogs,
    issueOfficialDocument,
  } = useAppStore();
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [documentType, setDocumentType] =
    useState<OfficialDocumentType>('bank_details');
  const [accountId, setAccountId] = useState('');
  const [transferId, setTransferId] = useState('');
  const [loanId, setLoanId] = useState('');
  const [{ periodStart, periodEnd }, setPeriod] = useState(defaultPeriod);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const completedTransfers = useMemo(
    () =>
      pendingTransfers.filter(
        (transfer) =>
          transfer.workflowStatus === 'external_settlement_confirmed',
      ),
    [pendingTransfers],
  );
  const eligibleLoans = useMemo(
    () =>
      loans.filter((loan) =>
        [
          'approved_for_external_funding',
          'external_funding_recorded',
          'external_settlement_confirmed',
        ].includes(loan.workflowStatus ?? ''),
      ),
    [loans],
  );

  const setType = (nextType: OfficialDocumentType) => {
    setDocumentType(nextType);
    setTransferId('');
    setLoanId('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    let selectedAccount = accounts.find((account) => account.id === accountId);
    let selectedTransfer = completedTransfers.find(
      (transfer) => transfer.id === transferId,
    );
    let selectedLoan = eligibleLoans.find((loan) => loan.id === loanId);

    if (documentType === 'transfer_confirmation') {
      selectedAccount = accounts.find(
        (account) => account.id === selectedTransfer?.sourceAccountId,
      );
    }
    if (
      documentType === 'loan_disbursement_confirmation' ||
      documentType === 'loan_decision'
    ) {
      selectedAccount = accounts.find(
        (account) => account.id === selectedLoan?.creditedPositionId,
      );
    }

    const ownerId =
      selectedAccount?.ownerId ?? selectedTransfer?.ownerId ?? selectedLoan?.ownerId;
    if (!ownerId) {
      setError('Sélectionnez un compte ou un dossier compatible.');
      return;
    }

    setIsSaving(true);
    try {
      await issueOfficialDocument({
        ownerId,
        accountId: selectedAccount?.id,
        transferId:
          documentType === 'transfer_confirmation' ? selectedTransfer?.id : undefined,
        loanId:
          documentType === 'loan_disbursement_confirmation' ||
          documentType === 'loan_decision'
            ? selectedLoan?.id
            : undefined,
        documentType,
        periodStart:
          documentType === 'account_statement' ? periodStart : undefined,
        periodEnd: documentType === 'account_statement' ? periodEnd : undefined,
      });
      setIsIssueOpen(false);
      setAccountId('');
      setTransferId('');
      setLoanId('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Émission du document impossible.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl bg-slate-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase">
            <FileCheck2 className="w-4 h-4" />
            <span>Émission et traçabilité</span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">Documents officiels {brand.bankName}</h1>
          <p className="text-xs text-slate-300 mt-2 max-w-2xl">
            Émettez un PDF depuis un snapshot immuable du registre bancaire. Les
            documents de démonstration portent un filigrane et aucune certification
            externe n&apos;est revendiquée.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setIsIssueOpen(true);
          }}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-extrabold sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Émettre un document
        </button>
      </header>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="font-extrabold text-slate-900 mb-4">
          Registre des documents
        </h2>
        <div className="divide-y">
          {officialDocuments.map((document) => (
            <article
              key={document.id}
              className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900">
                    {document.title}
                  </p>
                  <p className="mt-1 break-all font-mono text-[10px] text-slate-500">
                    {document.documentNumber} · v{document.version} ·{' '}
                    {document.status}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {document.issuedAt
                      ? new Date(document.issuedAt).toLocaleString('fr')
                      : 'Émission en cours'}
                    {document.isDemo ? ' · DÉMONSTRATION' : ''}
                  </p>
                </div>
              </div>
              {document.status === 'issued' && (
                <a
                  href={`/api/official-documents/${document.id}`}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white sm:w-auto"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
              )}
            </article>
          ))}
          {!officialDocuments.length && (
            <p className="py-10 text-center text-sm text-slate-500">
              Aucun document émis.
            </p>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          Journal d&apos;audit
        </h2>
        <div className="space-y-3">
          {activityLogs.map((event) => (
            <article key={event.id} className="flex min-w-0 gap-3 rounded-2xl border p-4">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">
                  {event.description}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {event.timestamp}
                </p>
                <p className="break-all font-mono text-[10px] text-slate-400">{event.id}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isIssueOpen && (
        <Dialog open onClose={() => setIsIssueOpen(false)} ariaLabelledBy="admin-document-dialog-title">
          <DialogBackdrop className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/75 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] sm:items-center sm:px-4 sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
          <DialogPanel
            as="form"
            onSubmit={submit}
            className="max-h-dvh w-full min-w-0 max-w-xl space-y-4 overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-6"
          >
            <header className="flex min-w-0 items-start justify-between gap-3 border-b pb-4">
              <div className="min-w-0">
                <h2 id="admin-document-dialog-title" className="break-words font-extrabold text-slate-900">
                  Émettre un document officiel
                </h2>
                <p className="text-xs text-slate-500">
                  Le PDF sera généré côté serveur et stocké dans un bucket privé.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueOpen(false)}
                aria-label="Fermer"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </header>
            {error && (
              <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">
                {error}
              </p>
            )}
            <label className="block text-xs font-bold">
              Type de document
              <select
                value={documentType}
                onChange={(event) =>
                  setType(event.target.value as OfficialDocumentType)
                }
                className="mt-1 w-full p-3 border rounded-xl"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            {['bank_details', 'account_statement', 'balance_certificate'].includes(
              documentType,
            ) && (
              <label className="block text-xs font-bold">
                Compte
                <select
                  required
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className="mt-1 w-full p-3 border rounded-xl"
                >
                  <option value="">Sélectionner</option>
                  {accounts
                    .filter((account) => account.accountStatus === 'active')
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountHolderName} — {account.name} —{' '}
                        {account.iban}
                      </option>
                    ))}
                </select>
              </label>
            )}

            {documentType === 'transfer_confirmation' && (
              <label className="block text-xs font-bold">
                Virement effectué
                <select
                  required
                  value={transferId}
                  onChange={(event) => setTransferId(event.target.value)}
                  className="mt-1 w-full p-3 border rounded-xl"
                >
                  <option value="">Sélectionner</option>
                  {completedTransfers.map((transfer) => (
                    <option key={transfer.id} value={transfer.id}>
                      {transfer.recipientName} — {transfer.amount}{' '}
                      {transfer.currency} — {transfer.id}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(documentType === 'loan_disbursement_confirmation' ||
              documentType === 'loan_decision') && (
              <label className="block text-xs font-bold">
                Dossier de prêt
                <select
                  required
                  value={loanId}
                  onChange={(event) => setLoanId(event.target.value)}
                  className="mt-1 w-full p-3 border rounded-xl"
                >
                  <option value="">Sélectionner</option>
                  {eligibleLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.clientName} — {loan.reference} — {loan.requestedAmount}{' '}
                      {loan.currency}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {documentType === 'account_statement' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">
                  Début
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(event) =>
                      setPeriod((current) => ({
                        ...current,
                        periodStart: event.target.value,
                      }))
                    }
                    className="mt-1 w-full p-3 border rounded-xl"
                  />
                </label>
                <label className="text-xs font-bold">
                  Fin
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(event) =>
                      setPeriod((current) => ({
                        ...current,
                        periodEnd: event.target.value,
                      }))
                    }
                    className="mt-1 w-full p-3 border rounded-xl"
                  />
                </label>
              </div>
            )}

            <button
              disabled={isSaving}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {isSaving ? 'Génération et publication…' : 'Émettre et publier le PDF'}
            </button>
          </DialogPanel>
          </DialogBackdrop>
        </Dialog>
      )}
    </div>
  );
}
