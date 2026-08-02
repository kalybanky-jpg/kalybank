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
    <div className="space-y-6">
      <header className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
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
          className="px-4 py-3 bg-blue-600 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Émettre un document
        </button>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <h2 className="font-extrabold text-slate-900 mb-4">
          Registre des documents
        </h2>
        <div className="divide-y">
          {officialDocuments.map((document) => (
            <article
              key={document.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex gap-3">
                <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs font-extrabold text-slate-900">
                    {document.title}
                  </p>
                  <p className="font-mono text-[10px] text-slate-500 mt-1">
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
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2"
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

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <h2 className="font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          Journal d&apos;audit
        </h2>
        <div className="space-y-3">
          {activityLogs.map((event) => (
            <article key={event.id} className="p-4 border rounded-2xl flex gap-3">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {event.description}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {event.timestamp}
                </p>
                <p className="font-mono text-[10px] text-slate-400">{event.id}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isIssueOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={submit}
            className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 my-auto"
          >
            <header className="flex justify-between border-b pb-4">
              <div>
                <h2 className="font-extrabold text-slate-900">
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
              <div className="grid grid-cols-2 gap-3">
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
          </form>
        </div>
      )}
    </div>
  );
}
