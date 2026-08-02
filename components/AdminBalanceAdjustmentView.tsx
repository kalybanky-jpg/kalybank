'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CheckCircle2,
  Landmark,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { formatDirectCurrency } from '@/lib/currency';
import { useAppStore } from '@/lib/store';
import { useBrand } from '@/components/brand/BrandProvider';

type AdjustmentDirection = 'credit' | 'debit';

export default function AdminBalanceAdjustmentView() {
  const { brand } = useBrand();
  const { accounts, updateAccountBalance } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [direction, setDirection] = useState<AdjustmentDirection>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currentAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.type === 'courant' && account.accountStatus !== 'closed',
      ),
    [accounts],
  );

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('fr-FR');
    if (!query) return currentAccounts;

    return currentAccounts.filter((account) =>
      [
        account.name,
        account.accountHolderName,
        account.accountNumber,
        account.iban,
        account.currency,
      ].some((value) => value?.toLocaleLowerCase('fr-FR').includes(query)),
    );
  }, [currentAccounts, searchQuery]);

  const selectedAccount = currentAccounts.find(
    (account) => account.id === selectedAccountId,
  );
  const numericAmount = Number(amount);
  const movement = Number.isFinite(numericAmount) ? numericAmount : 0;
  const targetBalance = selectedAccount
    ? selectedAccount.balance + (direction === 'credit' ? movement : -movement)
    : 0;
  const isAmountValid =
    Boolean(selectedAccount) &&
    movement > 0 &&
    (direction === 'credit' || targetBalance >= 0);
  const canSubmit = isAmountValid && reason.trim().length >= 10 && !isSaving;

  const selectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    setAmount('');
    setReason('');
    setError('');
    setSuccess('');
  };

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !canSubmit) return;

    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      const operationLabel = direction === 'credit' ? 'Crédit' : 'Débit';
      await updateAccountBalance(
        selectedAccount.id,
        targetBalance,
        `${operationLabel} de réajustement — ${reason.trim()}`,
      );
      setSuccess(
        `${operationLabel} de ${formatDirectCurrency(
          movement,
          selectedAccount.currency,
            'fr',
        )} enregistré avec succès.`,
      );
      setAmount('');
      setReason('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Le réajustement n’a pas pu être enregistré.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pt-1">
      <header className="overflow-hidden rounded-[22px] bg-[#0a154f] text-white shadow-[0_18px_45px_rgba(10,21,79,0.16)]">
        <div className="relative px-5 py-6 sm:px-7">
          <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-[#5d43ff]/30 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa0ff]">
                <Landmark className="h-4 w-4" />
                Grand livre {brand.bankName}
              </div>
              <h1 className="mt-2 text-2xl font-extrabold sm:text-[28px]">
                Réajuster un solde courant
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-white/70">
                Créditez ou débitez un compte courant depuis un espace dédié, avec
                aperçu du nouveau solde avant confirmation.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 text-[10px] text-white/80 backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-[#8f80ff]" />
              Action motivée et auditée
            </div>
          </div>
        </div>
      </header>

      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"
        >
          <CheckCircle2 className="mt-[-1px] h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[0.92fr_1.25fr]">
        <section className="rounded-[18px] border border-[#e2e6f0] bg-white p-4 shadow-[0_10px_32px_rgba(31,42,94,0.04)] sm:p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7767ef]">
              Étape 1
            </p>
            <h2 className="mt-1 text-base font-extrabold text-[#0a154f]">
              Sélectionner le compte
            </h2>
          </div>

          <label className="relative mt-4 block">
            <span className="sr-only">Rechercher un compte courant</span>
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#8992b4]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Titulaire, compte, IBAN…"
              className="w-full rounded-xl border border-[#dfe3ee] bg-[#f8f9fc] py-3 pl-10 pr-3 text-xs text-[#0a154f] outline-none transition placeholder:text-[#929aba] focus:border-[#6b55f5] focus:bg-white focus:ring-4 focus:ring-[#6b55f5]/10"
            />
          </label>

          <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {filteredAccounts.map((account) => {
              const isSelected = account.id === selectedAccountId;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => selectAccount(account.id)}
                  aria-pressed={isSelected}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? 'border-[#6650f4] bg-[#f3f1ff] shadow-[0_8px_20px_rgba(79,55,229,0.08)]'
                      : 'border-[#e7e9f1] bg-white hover:border-[#c8c1fb] hover:bg-[#fafaff]'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold text-[#0a154f]">
                        {account.accountHolderName ?? account.name}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[9px] text-[#7a84a8]">
                        N° {account.accountNumber ?? 'non attribué'}
                        {account.iban ? ` · ${account.iban}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-[#eef0f7] px-2 py-1 text-[9px] font-bold text-[#4c5887]">
                      {account.currency}
                    </span>
                  </span>
                  <span className="mt-3 flex items-end justify-between gap-3">
                    <span className="text-[9px] text-[#7a84a8]">Solde actuel</span>
                    <strong className="text-sm text-[#0a154f]">
                  {formatDirectCurrency(account.balance, account.currency, 'fr')}
                    </strong>
                  </span>
                </button>
              );
            })}
            {!filteredAccounts.length && (
              <p className="rounded-xl bg-[#f8f9fc] px-4 py-10 text-center text-xs text-[#7a84a8]">
                Aucun compte courant ne correspond à cette recherche.
              </p>
            )}
          </div>
        </section>

        <form
          onSubmit={submitAdjustment}
          className="rounded-[18px] border border-[#e2e6f0] bg-white p-4 shadow-[0_10px_32px_rgba(31,42,94,0.04)] sm:p-5"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7767ef]">
              Étape 2
            </p>
            <h2 className="mt-1 text-base font-extrabold text-[#0a154f]">
              Choisir le mouvement
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#f4f5f9] p-1.5">
            <button
              type="button"
              onClick={() => {
                setDirection('credit');
                setError('');
              }}
              aria-pressed={direction === 'credit'}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-xs font-extrabold transition ${
                direction === 'credit'
                  ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                  : 'text-[#737d9f] hover:text-[#0a154f]'
              }`}
            >
              <ArrowDownToLine className="h-4 w-4" />
              Créditer
            </button>
            <button
              type="button"
              onClick={() => {
                setDirection('debit');
                setError('');
              }}
              aria-pressed={direction === 'debit'}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-xs font-extrabold transition ${
                direction === 'debit'
                  ? 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-200'
                  : 'text-[#737d9f] hover:text-[#0a154f]'
              }`}
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Débiter
            </button>
          </div>

          <label className="mt-5 block text-[11px] font-bold text-[#263362]">
            Montant du {direction === 'credit' ? 'crédit' : 'débit'}
            <span className="relative mt-1.5 block">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
                disabled={!selectedAccount}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError('');
                  setSuccess('');
                }}
                placeholder="0,00"
                className="w-full rounded-xl border border-[#dfe3ee] px-4 py-3.5 pr-16 text-lg font-extrabold text-[#0a154f] outline-none transition placeholder:text-[#b2b8ce] focus:border-[#6b55f5] focus:ring-4 focus:ring-[#6b55f5]/10 disabled:cursor-not-allowed disabled:bg-[#f5f6f9]"
              />
              <span className="absolute right-4 top-4 text-xs font-bold text-[#7a84a8]">
                {selectedAccount?.currency ?? '—'}
              </span>
            </span>
          </label>

          {selectedAccount && movement > 0 && (
            <div className="mt-4 rounded-xl border border-[#e4e6ef] bg-[#f8f9fc] p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div>
                  <p className="text-[9px] font-medium text-[#7a84a8]">Solde actuel</p>
                  <p className="mt-1 text-sm font-extrabold text-[#0a154f]">
                    {formatDirectCurrency(
                      selectedAccount.balance,
                      selectedAccount.currency,
                    'fr',
                    )}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#939bb7]" />
                <div className="text-right">
                  <p className="text-[9px] font-medium text-[#7a84a8]">Nouveau solde</p>
                  <p
                    className={`mt-1 text-sm font-extrabold ${
                      targetBalance < 0
                        ? 'text-rose-700'
                        : direction === 'credit'
                          ? 'text-emerald-700'
                          : 'text-[#0a154f]'
                    }`}
                  >
                    {formatDirectCurrency(
                      targetBalance,
                      selectedAccount.currency,
                    'fr',
                    )}
                  </p>
                </div>
              </div>
              <p
                className={`mt-3 border-t border-[#e0e3ed] pt-3 text-center text-[10px] font-bold ${
                  direction === 'credit' ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {direction === 'credit' ? '+' : '−'}{' '}
                    {formatDirectCurrency(movement, selectedAccount.currency, 'fr')}
              </p>
            </div>
          )}

          {selectedAccount && direction === 'debit' && targetBalance < 0 && (
            <p role="alert" className="mt-3 text-[10px] font-semibold text-rose-700">
              Le débit dépasse le solde disponible. Le nouveau solde ne peut pas être
              négatif.
            </p>
          )}

          <label className="mt-4 block text-[11px] font-bold text-[#263362]">
            Motif et référence du réajustement
            <textarea
              required
              minLength={10}
              disabled={!selectedAccount}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError('');
                setSuccess('');
              }}
              rows={3}
              placeholder="Ex. Rapprochement du 30/07 — référence interne…"
              className="mt-1.5 w-full resize-none rounded-xl border border-[#dfe3ee] px-4 py-3 text-xs text-[#0a154f] outline-none transition placeholder:text-[#a2a9c2] focus:border-[#6b55f5] focus:ring-4 focus:ring-[#6b55f5]/10 disabled:cursor-not-allowed disabled:bg-[#f5f6f9]"
            />
            <span className="mt-1 block text-right text-[9px] font-medium text-[#9199b5]">
              {reason.trim().length}/10 caractères minimum
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2.5 text-[10px] font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-4 rounded-xl bg-[#fff8e7] p-3 text-[10px] leading-4 text-[#825d0b]">
            La confirmation ajoute une écriture immuable au grand livre. Vérifiez le
            compte, le sens du mouvement et le montant avant de continuer.
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-xs font-extrabold text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-[#c4c8d7] disabled:shadow-none ${
              direction === 'credit'
                ? 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700'
                : 'bg-[#d83b55] shadow-rose-600/20 hover:bg-[#c62f49]'
            }`}
          >
            {isSaving
              ? 'Enregistrement…'
              : selectedAccount
                ? `Confirmer le ${direction === 'credit' ? 'crédit' : 'débit'}`
                : 'Sélectionnez d’abord un compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
