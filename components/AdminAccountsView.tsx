'use client';

import React, { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDirectCurrency } from '@/lib/currency';
import type { BankAccount, Currency } from '@/lib/types';
import {
  Landmark,
  Plus,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';

interface DeclarationForm {
  ownerId: string;
  label: string;
  accountType: 'current';
  currency: Currency;
  iban: string;
  bic: string;
  accountHolderName: string;
  institutionName: string;
  branchName: string;
  branchCode: string;
  openingBalance: number;
  openedAt: string;
  reason: string;
}

const initialDeclaration: DeclarationForm = {
  ownerId: '',
  label: 'Compte courant',
  accountType: 'current' as const,
  currency: 'EUR' as Currency,
  iban: '',
  bic: '',
  accountHolderName: '',
  institutionName: 'Monalyz',
  branchName: '',
  branchCode: '',
  openingBalance: 0,
  openedAt: new Date().toISOString().slice(0, 10),
  reason: '',
};

export default function AdminAccountsView() {
  const {
    language,
    accounts,
    kycApplications,
    declareBankAccount,
    updateAccountBalance,
    accountNumberConfiguration,
  } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [isDeclarationOpen, setIsDeclarationOpen] = useState(false);
  const [declaration, setDeclaration] =
    useState<DeclarationForm>(initialDeclaration);
  const [newAmount, setNewAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const approvedClients = useMemo(
    () =>
      kycApplications.filter(
        (application) =>
          application.ownerId && application.workflowStatus === 'approved',
      ),
    [kycApplications],
  );

  const filtered = accounts.filter((account) => {
    const query = searchQuery.toLowerCase();
    return (
      account.name.toLowerCase().includes(query) ||
      (account.iban ?? '').toLowerCase().includes(query) ||
      (account.accountNumber ?? '').includes(query) ||
      (account.accountHolderName ?? '').toLowerCase().includes(query)
    );
  });

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    setError('');
    setIsSaving(true);
    try {
      await updateAccountBalance(selected.id, newAmount, reason.trim());
      setSelected(null);
      setReason('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Ajustement impossible.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const submitDeclaration = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await declareBankAccount(declaration);
      setDeclaration(initialDeclaration);
      setIsDeclarationOpen(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Déclaration du compte impossible.',
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
            <WalletCards className="w-4 h-4" />
            <span>Registre bancaire</span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">Comptes, IBAN et soldes</h1>
          <p className="text-xs text-slate-300 mt-2 max-w-2xl">
            Déclarez les comptes créés par les procédures internes de la banque,
            puis tenez leurs soldes à jour. Chaque action est motivée et auditée.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setIsDeclarationOpen(true);
          }}
          className="px-4 py-3 bg-blue-600 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Déclarer un compte
        </button>
      </header>

      <section className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="relative max-w-sm mb-5">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Titulaire, numéro de compte ou IBAN"
            className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b text-[10px] uppercase text-slate-500">
                <th className="pb-3 px-2">Compte</th>
                <th className="pb-3 px-2">IBAN / BIC</th>
                <th className="pb-3 px-2">Statut</th>
                <th className="pb-3 px-2 text-right">Solde</th>
                <th className="pb-3 px-2">Mis à jour</th>
                <th className="pb-3 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {filtered.map((account) => (
                <tr key={account.id}>
                  <td className="py-4 px-2">
                    <p className="font-bold text-slate-900">{account.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {account.accountHolderName ?? account.ownerId}
                    </p>
                    <p className="font-mono text-[10px] font-bold text-slate-600">
                      N° {account.accountNumber ?? 'non attribué'}
                    </p>
                  </td>
                  <td className="py-4 px-2">
                    <p className="font-mono font-bold text-slate-700">
                      {account.iban ?? 'En attente de déclaration'}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500">
                      {account.bic ?? 'BIC non renseigné'}
                    </p>
                  </td>
                  <td className="py-4 px-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        account.accountStatus === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : account.accountStatus === 'restricted'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {account.accountStatus ?? 'pending'}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-right font-extrabold">
                    {formatDirectCurrency(account.balance, account.currency, language)}
                  </td>
                  <td className="py-4 px-2 text-slate-600">
                    {account.asOf
                      ? new Date(account.asOf).toLocaleString(language)
                      : '—'}
                  </td>
                  <td className="py-4 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(account);
                        setNewAmount(account.balance);
                        setError('');
                      }}
                      disabled={account.accountStatus === 'closed'}
                      className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-40"
                    >
                      Mettre à jour le solde
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="py-10 text-center text-sm text-slate-500">
              Aucun compte bancaire déclaré.
            </p>
          )}
        </div>
      </section>

      {isDeclarationOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={submitDeclaration}
            className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-5 my-auto"
          >
            <header className="flex justify-between border-b pb-4">
              <div>
                <h2 className="font-extrabold text-slate-900">
                  Déclarer un compte bancaire
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Saisissez uniquement les coordonnées attribuées après le traitement
                  interne de la banque. Le numéro de compte sera généré automatiquement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeclarationOpen(false)}
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
            {!accountNumberConfiguration && (
              <p role="alert" className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs">
                Configurez d’abord le préfixe des numéros de compte dans Paramètres.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-xs font-bold sm:col-span-2">
                Client KYC approuvé
                <select
                  required
                  value={declaration.ownerId}
                  onChange={(event) => {
                    const client = approvedClients.find(
                      (candidate) => candidate.ownerId === event.target.value,
                    );
                    setDeclaration((current) => ({
                      ...current,
                      ownerId: event.target.value,
                      accountHolderName: client
                        ? `${client.firstName} ${client.lastName}`
                        : '',
                    }));
                  }}
                  className="mt-1 w-full p-3 border rounded-xl"
                >
                  <option value="">Sélectionner</option>
                  {approvedClients.map((client) => (
                    <option key={client.id} value={client.ownerId}>
                      {client.firstName} {client.lastName} — {client.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Libellé du compte
                <input
                  required
                  value={declaration.label}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                />
              </label>
              <label className="text-xs font-bold">
                Type
                <input
                  value="Compte courant"
                  readOnly
                  className="mt-1 w-full p-3 border rounded-xl bg-slate-50 text-slate-600"
                />
              </label>
              <label className="text-xs font-bold">
                Titulaire
                <input
                  required
                  value={declaration.accountHolderName}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      accountHolderName: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                IBAN
                <input
                  required
                  value={declaration.iban}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      iban: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="FR76…"
                  className="mt-1 w-full p-3 border rounded-xl font-mono"
                />
              </label>
              <label className="text-xs font-bold">
                BIC / SWIFT
                <input
                  required
                  value={declaration.bic}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      bic: event.target.value.toUpperCase(),
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl font-mono"
                />
              </label>
              <label className="text-xs font-bold">
                Devise
                <select
                  value={declaration.currency}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      currency: event.target.value as Currency,
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                >
                  {['EUR', 'USD', 'CAD', 'CHF', 'GBP'].map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Établissement
                <input
                  required
                  value={declaration.institutionName}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      institutionName: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                />
              </label>
              <label className="text-xs font-bold">
                Agence
                <input
                  required
                  value={declaration.branchName}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      branchName: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                />
              </label>
              <label className="text-xs font-bold">
                Code agence
                <input
                  required
                  value={declaration.branchCode}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      branchCode: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                />
              </label>
              <label className="text-xs font-bold">
                Date d&apos;ouverture
                <input
                  type="date"
                  required
                  value={declaration.openedAt}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      openedAt: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                />
              </label>
              <label className="text-xs font-bold">
                Solde d&apos;ouverture ({declaration.currency})
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={declaration.openingBalance}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      openingBalance: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Motif et référence du dossier interne
                <textarea
                  required
                  minLength={10}
                  value={declaration.reason}
                  onChange={(event) =>
                    setDeclaration((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-3 border rounded-xl"
                />
              </label>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex gap-2 text-xs text-blue-900">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              La déclaration crée le compte, son solde d&apos;ouverture et la première
              écriture du grand livre dans une transaction atomique.
            </div>
            <button
              disabled={
                isSaving ||
                !approvedClients.length ||
                !accountNumberConfiguration
              }
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {isSaving ? 'Déclaration…' : 'Déclarer le compte'}
            </button>
          </form>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <form
            onSubmit={submitAdjustment}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4"
          >
            <header className="flex justify-between">
              <div>
                <h2 className="font-extrabold text-slate-900">Mise à jour du solde</h2>
                <p className="text-xs text-slate-500">{selected.name}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                <X className="w-5 h-5" />
              </button>
            </header>
            {error && (
              <p role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">
                {error}
              </p>
            )}
            <label className="block text-xs font-bold">
              Nouveau solde ({selected.currency})
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={newAmount}
                onChange={(event) => setNewAmount(Number(event.target.value))}
                className="mt-1 w-full p-3 border rounded-xl"
              />
            </label>
            <label className="block text-xs font-bold">
              Motif et référence du traitement interne
              <textarea
                required
                minLength={10}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full p-3 border rounded-xl"
              />
            </label>
            <p className="text-[11px] text-amber-800 bg-amber-50 p-3 rounded-xl">
              Confirmez uniquement après la réalisation du mouvement ou du
              rapprochement par le personnel bancaire. Une écriture immuable sera
              ajoutée au grand livre.
            </p>
            <button
              disabled={isSaving}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement…' : 'Enregistrer le nouveau solde'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
