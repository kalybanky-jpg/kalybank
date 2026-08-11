'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, LoaderCircle, Search, Trash2, Users, X } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogPanel } from '@/components/ui/Dialog';
import { CLIENT_PURGE_EXTERNAL_CHECKLIST } from '@/lib/client-purge';
import {
  createClientPurgeCompletionMonitor,
  type ObservedClientPurge,
} from '@/lib/client-purge-completion-monitor';

type Client = {
  id: string;
  email: string;
  displayName: string;
  accessStatus: string;
  authDeleted: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  kycStatus: string | null;
  purgeStatus: string | null;
  purgeStage: string | null;
  purgeSweepNotBefore: string | null;
  counts: { accounts: number; loans: number; transfers: number; documents: number };
};

type PurgeState = {
  deleted?: boolean;
  status: 'preview' | 'running' | 'processing' | 'failed' | 'waiting_sweep' | 'deleted';
  stage: string;
  sweepNotBefore: string | null;
  canResume?: boolean;
  ignoredUnsafeStorageReferences?: number;
  storagePhase?: string;
  targetEmail?: string;
  authDeleted?: boolean;
};

type ClientPurgeCompletionMonitor = ReturnType<
  typeof createClientPurgeCompletionMonitor
>;

type Preview = {
  challengeId: string;
  challengeToken: string;
  expiresAt: string;
  targetEmail: string;
  pending?: boolean;
  idempotencyKey: string;
  impact: {
    preservedAdmins: number;
    kycApplications: number;
    kycDrafts: number;
    accounts: number;
    ledgerEntries: number;
    loans: number;
    transfers: number;
    documents: number;
    notifications: number;
    emailOutbox: number;
    pushSubscriptions: number;
    supportIdentities: number;
    supportTranscripts: number;
    auditEvents: number;
    workflowEvents: number;
    externalExecutions: number;
    profileRecords: number;
    authRecords: number;
    storageReferences: number;
    unsafeStorageReferences: number;
    storageObjects: number;
  };
};

type Page = {
  clients: Client[];
  page: number;
  total: number;
  totalPages: number;
};

async function responseJson<T>(response: Response) {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Une erreur est survenue.');
  return body;
}

export default function AdminClientsView() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [purgeState, setPurgeState] = useState<PurgeState | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [exactEmail, setExactEmail] = useState('');
  const [password, setPassword] = useState('');
  const [purgeError, setPurgeError] = useState('');
  const [purging, setPurging] = useState(false);
  const [notice, setNotice] = useState('');
  const [externalChecklist, setExternalChecklist] = useState<ObservedClientPurge[]>([]);
  const emailInput = useRef<HTMLInputElement>(null);
  const previewRequest = useRef(0);
  const completionMonitor = useRef<ClientPurgeCompletionMonitor | null>(null);

  const loadClients = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (activeQuery) params.set('q', activeQuery);
      const response = await fetch(`/api/admin/clients?${params}`, {
        cache: 'no-store',
        signal,
      });
      setResult(await responseJson<Page>(response));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [activeQuery, page]);
  const loadClientsRef = useRef(loadClients);

  useEffect(() => {
    loadClientsRef.current = loadClients;
  }, [loadClients]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadClients(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadClients]);

  useEffect(() => {
    const monitor = createClientPurgeCompletionMonitor({
      fetchStatus: async (target) => {
        const response = await fetch(`/api/admin/clients/${target.targetUserId}/purge`, {
          cache: 'no-store',
        });
        if (response.status === 404) return null;
        return responseJson<PurgeState>(response);
      },
      onCompleted: (target) => {
        setExternalChecklist((current) => [
          ...current.filter(
            (entry) => entry.targetUserId !== target.targetUserId,
          ),
          target,
        ]);
        setNotice(`Les données de ${target.email} ont été supprimées.`);
        void loadClientsRef.current();
      },
      focusTarget: window,
      visibilityTarget: document,
      isVisible: () => document.visibilityState === 'visible',
    });
    completionMonitor.current = monitor;
    return () => {
      completionMonitor.current = null;
      monitor.stop();
    };
  }, []);

  function observeWaitingSweep(client: Client, state: PurgeState) {
    if (state.status !== 'waiting_sweep' || !state.sweepNotBefore) return;
    completionMonitor.current?.observeWaitingSweep({
      targetUserId: client.id,
      email: client.email,
      displayName: client.displayName,
      sweepNotBefore: state.sweepNotBefore,
    });
  }

  function showExternalChecklist(client: Client) {
    setExternalChecklist((current) => [
      ...current.filter((entry) => entry.targetUserId !== client.id),
      {
        targetUserId: client.id,
        email: client.email,
        displayName: client.displayName,
        sweepNotBefore: new Date().toISOString(),
      },
    ]);
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setActiveQuery(query.trim());
  }

  function closeDialog(force = false) {
    if (purging && !force) return;
    previewRequest.current += 1;
    setSelected(null);
    setPreview(null);
    setPurgeState(null);
    setExactEmail('');
    setPassword('');
    setPurgeError('');
  }

  async function openPurge(client: Client) {
    const requestId = ++previewRequest.current;
    setSelected(client);
    setPreview(null);
    setPurgeState(null);
    setPurgeError('');
    setExactEmail('');
    setPassword('');
    try {
      if (client.purgeStatus && client.purgeStatus !== 'preview') {
        const response = await fetch(`/api/admin/clients/${client.id}/purge`, {
          cache: 'no-store',
        });
        const state = await responseJson<PurgeState>(response);
        setPurgeState(state);
        observeWaitingSweep(client, state);
        if (state.canResume) {
          requestAnimationFrame(() => emailInput.current?.focus());
        }
        return;
      }
      const recovering = client.purgeStatus === 'preview';
      const key = crypto.randomUUID();
      const response = await fetch(`/api/admin/clients/${client.id}/purge/preview${recovering ? '/continue' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recovering
          ? { continue: true }
          : { idempotencyKey: key }),
        cache: 'no-store',
      });
      const nextPreview = await responseJson<Preview>(response);
      if (previewRequest.current !== requestId) return;
      setIdempotencyKey(nextPreview.idempotencyKey);
      setPreview(nextPreview);
      if (!nextPreview.pending) {
        requestAnimationFrame(() => emailInput.current?.focus());
      }
    } catch (previewError) {
      setPurgeError(
        previewError instanceof Error ? previewError.message : 'Aperçu impossible.',
      );
    }
  }

  async function continuePreview() {
    if (!selected || !preview?.pending) return;
    setPurgeError('');
    try {
      const response = await fetch(
        `/api/admin/clients/${selected.id}/purge/preview/continue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ continue: true }),
          cache: 'no-store',
        },
      );
      const nextPreview = await responseJson<Preview>(response);
      setIdempotencyKey(nextPreview.idempotencyKey);
      setPreview(nextPreview);
      if (!nextPreview.pending) {
        requestAnimationFrame(() => emailInput.current?.focus());
      }
    } catch (previewError) {
      setPurgeError(
        previewError instanceof Error ? previewError.message : 'Aperçu impossible.',
      );
    }
  }

  async function purge(event: FormEvent) {
    event.preventDefault();
    if (!selected || !preview || exactEmail !== preview.targetEmail) return;
    setPurging(true);
    setPurgeError('');
    try {
      const response = await fetch(`/api/admin/clients/${selected.id}/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: preview.challengeId,
          challengeToken: preview.challengeToken,
          idempotencyKey,
          exactEmail,
          currentPassword: password,
        }),
      });
      const outcome = await responseJson<PurgeState>(response);
      observeWaitingSweep(selected, outcome);
      const ignoredNotice = outcome.ignoredUnsafeStorageReferences
        ? ` ${outcome.ignoredUnsafeStorageReferences} référence Storage étrangère a été ignorée et son fichier préservé.`
        : '';
      const outcomeNotice = outcome.deleted
        ? 'Les données du client ont été supprimées.'
        : outcome.status === 'waiting_sweep' && outcome.sweepNotBefore
          ? `Le compte est gelé. Le balayage final aura lieu après ${new Date(outcome.sweepNotBefore).toLocaleString('fr-FR')}.`
          : 'Le compte est gelé et la suppression progresse par lots en arrière-plan.';
      setNotice(outcomeNotice + ignoredNotice);
      if (outcome.deleted) showExternalChecklist(selected);
      closeDialog(true);
      await loadClients();
    } catch (deleteError) {
      setPurgeError(
        deleteError instanceof Error ? deleteError.message : 'Suppression interrompue.',
      );
    } finally {
      setPassword('');
      setPurging(false);
    }
  }

  async function resumePurge(event: FormEvent) {
    event.preventDefault();
    if (!selected || !purgeState?.canResume || exactEmail !== selected.email) return;
    setPurging(true);
    setPurgeError('');
    try {
      const response = await fetch(`/api/admin/clients/${selected.id}/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: true,
          exactEmail,
          currentPassword: password,
        }),
      });
      const outcome = await responseJson<PurgeState>(response);
      observeWaitingSweep(selected, outcome);
      const ignoredNotice = outcome.ignoredUnsafeStorageReferences
        ? ` ${outcome.ignoredUnsafeStorageReferences} référence Storage étrangère a été ignorée et son fichier préservé.`
        : '';
      const outcomeNotice = outcome.deleted
        ? 'Les données du client ont été supprimées.'
        : outcome.status === 'waiting_sweep' && outcome.sweepNotBefore
          ? `Le compte reste gelé. Le balayage final est programmé après ${new Date(outcome.sweepNotBefore).toLocaleString('fr-FR')}.`
          : 'La reprise a traité un lot et continuera automatiquement en arrière-plan.';
      setNotice(outcomeNotice + ignoredNotice);
      if (outcome.deleted) showExternalChecklist(selected);
      closeDialog(true);
      await loadClients();
    } catch (resumeError) {
      setPurgeError(
        resumeError instanceof Error ? resumeError.message : 'Reprise interrompue.',
      );
    } finally {
      setPassword('');
      setPurging(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="rounded-3xl bg-slate-900 p-4 text-white sm:p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-300">
          <Users aria-hidden="true" className="h-4 w-4" />
          <span>Registre clients</span>
        </div>
        <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Clients</h1>
        <p className="mt-2 max-w-2xl text-xs text-slate-300">
          Données issues des profils et de l’authentification. Les comptes du personnel sont exclus.
        </p>
      </header>

      {externalChecklist.length > 0 && (
        <section
          aria-labelledby="client-purge-external-checklist-title"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="client-purge-external-checklist-title" className="font-extrabold">
                Vérifications externes non automatiques
              </h2>
              <p className="mt-1 text-xs">
                Cette liste reste uniquement dans cette session et n’est pas enregistrée par l’application.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExternalChecklist([])}
              aria-label="Fermer la checklist externe"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-amber-100"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 space-y-4">
            {externalChecklist.map((target) => (
              <article key={target.targetUserId} className="rounded-xl border border-amber-200 bg-white/70 p-3">
                <p className="font-bold">{target.displayName || 'Client supprimé'}</p>
                <p className="break-all text-xs">{target.email}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {CLIENT_PURGE_EXTERNAL_CHECKLIST.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p>{notice}</p>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Fermer la notification"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full hover:bg-amber-100"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <form onSubmit={search} className="mb-5 flex flex-col gap-2 min-[380px]:flex-row">
          <label className="relative min-w-0 flex-1 sm:max-w-md">
            <span className="sr-only">Rechercher un client</span>
            <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom ou e-mail"
              className="min-h-11 w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
            />
          </label>
          <button className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white" type="submit">
            Rechercher
          </button>
        </form>

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading && <p role="status" className="py-10 text-center text-sm text-slate-500">Chargement des clients…</p>}

        {!loading && result && (
          <>
            <p className="mb-3 text-xs font-semibold text-slate-500">{result.total} client(s)</p>
            <div className="grid min-w-0 gap-3 md:hidden">
              {result.clients.map((client) => (
                <article key={client.id} className="min-w-0 rounded-2xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-900">{client.displayName || 'Sans nom'}</p>
                  <p className="break-all text-xs text-slate-500">{client.email}</p>
                  {client.purgeStatus && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                      {client.authDeleted
                        ? 'Auth supprimée — finalisation à reprendre'
                        : `Suppression : ${client.purgeStatus.replaceAll('_', ' ')}`}
                    </p>
                  )}
                  <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-slate-500">KYC</dt><dd className="font-semibold">{client.kycStatus?.replaceAll('_', ' ') || 'Non soumis'}</dd></div>
                    <div><dt className="text-slate-500">Comptes</dt><dd className="font-semibold">{client.counts.accounts}</dd></div>
                    <div><dt className="text-slate-500">Prêts</dt><dd className="font-semibold">{client.counts.loans}</dd></div>
                    <div><dt className="text-slate-500">Virements</dt><dd className="font-semibold">{client.counts.transfers}</dd></div>
                  </dl>
                  <button type="button" onClick={() => void openPurge(client)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 text-sm font-bold text-red-700">
                    <Trash2 aria-hidden="true" className="h-4 w-4" /> {client.purgeStatus ? 'Voir ou reprendre' : 'Supprimer les données'}
                  </button>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead><tr className="border-b text-[10px] uppercase text-slate-500"><th className="px-2 pb-3">Client</th><th className="px-2 pb-3">KYC</th><th className="px-2 pb-3">Comptes</th><th className="px-2 pb-3">Dossiers</th><th className="px-2 pb-3 text-right">Action</th></tr></thead>
                <tbody className="divide-y">
                  {result.clients.map((client) => (
                    <tr key={client.id}>
                      <td className="px-2 py-4"><p className="font-bold text-slate-900">{client.displayName || 'Sans nom'}</p><p className="break-all text-[10px] text-slate-500">{client.email}</p>{client.purgeStatus && <p className="mt-1 text-[10px] font-bold text-amber-700">{client.authDeleted ? 'Auth supprimée — finalisation à reprendre' : `Suppression : ${client.purgeStatus.replaceAll('_', ' ')}`}</p>}</td>
                      <td className="px-2 py-4 font-semibold">{client.kycStatus?.replaceAll('_', ' ') || 'Non soumis'}</td>
                      <td className="px-2 py-4">{client.counts.accounts}</td>
                      <td className="px-2 py-4">{client.counts.loans} prêt(s), {client.counts.transfers} virement(s)</td>
                      <td className="px-2 py-4 text-right"><button type="button" onClick={() => void openPurge(client)} className="min-h-11 rounded-xl border border-red-300 px-3 py-2 font-bold text-red-700">{client.purgeStatus ? 'Voir / reprendre' : 'Supprimer'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!result.clients.length && <p className="py-10 text-center text-sm text-slate-500">Aucun client.</p>}
            {result.totalPages > 1 && (
              <nav aria-label="Pagination des clients" className="mt-5 flex items-center justify-between gap-3">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">Précédent</button>
                <span className="text-xs text-slate-500">Page {result.page} / {result.totalPages}</span>
                <button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">Suivant</button>
              </nav>
            )}
          </>
        )}
      </section>

      <Dialog
        open={Boolean(selected)}
        onClose={closeDialog}
        ariaLabelledBy="purge-title"
        initialFocusRef={emailInput}
        closeOnBackdrop={!purging}
      >
        {selected && (
          <DialogBackdrop className="fixed inset-0 z-50 flex items-end overflow-hidden bg-slate-950/60 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] sm:items-center sm:justify-center sm:px-4 sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
          <DialogPanel as="section" className="max-h-dvh w-full min-w-0 overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="flex items-center gap-2 text-xs font-bold uppercase text-red-700"><AlertTriangle aria-hidden="true" className="h-4 w-4" /> Action irréversible</p><h2 id="purge-title" className="mt-1 text-xl font-extrabold">{purgeState ? 'Suivi de la suppression' : 'Supprimer toutes les données'}</h2></div>
              <button type="button" onClick={() => closeDialog()} aria-label="Fermer" className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5" /></button>
            </div>
            <p className="mt-3 text-sm text-slate-600">Client : <strong className="break-all">{selected.email}</strong>. Le compte est gelé dès le lancement. Les dossiers sont purgés, puis un balayage Storage final est exécuté au moins deux heures et cinq minutes plus tard avant la suppression Auth, suivi d’un dernier contrôle ciblé.</p>

            {!preview && !purgeState && !purgeError && <p role="status" className="mt-6 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> Chargement de l’état sécurisé…</p>}
            {purgeError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{purgeError}</p>}

            {preview?.pending && (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <p role="status" className="flex items-center gap-2 font-semibold">
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Inventaire Storage enregistré par lots. Le curseur est conservé si vous fermez ou rechargez cette page.
                </p>
                <button type="button" onClick={() => void continuePreview()} className="mt-3 min-h-11 w-full rounded-xl bg-blue-800 px-4 font-bold text-white">
                  Continuer l’inventaire
                </button>
              </div>
            )}
            {preview && !preview.pending && (
              <form onSubmit={purge} className="mt-5 space-y-4">
                <dl className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-4 text-xs">
                  <div><dt className="text-slate-500">Admins conservés</dt><dd className="font-bold">{preview.impact.preservedAdmins}</dd></div>
                  <div><dt className="text-slate-500">KYC</dt><dd className="font-bold">{preview.impact.kycApplications}</dd></div>
                  <div><dt className="text-slate-500">Brouillons KYC</dt><dd className="font-bold">{preview.impact.kycDrafts}</dd></div>
                  <div><dt className="text-slate-500">Comptes</dt><dd className="font-bold">{preview.impact.accounts}</dd></div>
                  <div><dt className="text-slate-500">Écritures</dt><dd className="font-bold">{preview.impact.ledgerEntries}</dd></div>
                  <div><dt className="text-slate-500">Prêts</dt><dd className="font-bold">{preview.impact.loans}</dd></div>
                  <div><dt className="text-slate-500">Virements</dt><dd className="font-bold">{preview.impact.transfers}</dd></div>
                  <div><dt className="text-slate-500">Documents</dt><dd className="font-bold">{preview.impact.documents}</dd></div>
                  <div><dt className="text-slate-500">Notifications</dt><dd className="font-bold">{preview.impact.notifications}</dd></div>
                  <div><dt className="text-slate-500">E-mails en attente</dt><dd className="font-bold">{preview.impact.emailOutbox}</dd></div>
                  <div><dt className="text-slate-500">Abonnements push</dt><dd className="font-bold">{preview.impact.pushSubscriptions}</dd></div>
                  <div><dt className="text-slate-500">Échanges support</dt><dd className="font-bold">{preview.impact.supportTranscripts}</dd></div>
                  <div><dt className="text-slate-500">Audits</dt><dd className="font-bold">{preview.impact.auditEvents}</dd></div>
                  <div><dt className="text-slate-500">Événements métier</dt><dd className="font-bold">{preview.impact.workflowEvents}</dd></div>
                  <div><dt className="text-slate-500">Objets Storage ciblés</dt><dd className="font-bold">{preview.impact.storageObjects}</dd></div>
                </dl>
                {preview.impact.unsafeStorageReferences > 0 && (
                  <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    {preview.impact.unsafeStorageReferences} référence Storage n’appartient pas à ce client. Elle sera ignorée et le fichier étranger sera préservé pendant la suppression des données du client.
                  </p>
                )}
                <label className="block text-sm font-semibold">Recopiez exactement l’e-mail du client<input ref={emailInput} value={exactEmail} onChange={(event) => setExactEmail(event.target.value)} autoComplete="off" spellCheck={false} aria-invalid={exactEmail.length > 0 && exactEmail !== preview.targetEmail} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
                <label className="block text-sm font-semibold">Votre mot de passe actuel<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
                <p className="text-xs text-slate-500">Le défi expire à {new Date(preview.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Après lancement, l’état privé est conservé uniquement jusqu’au balayage final ou en cas d’échec.</p>
                <button type="submit" disabled={purging || exactEmail !== preview.targetEmail || password.length < 8} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40">{purging ? <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> Suppression sécurisée…</> : <><Trash2 aria-hidden="true" className="h-4 w-4" /> Lancer la suppression sécurisée</>}</button>
              </form>
            )}

            {purgeState && (
              <div className="mt-5 space-y-4">
                {(selected.authDeleted || purgeState.authDeleted) && (
                  <p role="status" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
                    Le compte Auth est déjà supprimé. L’état privé minimal de l’opération reste visible uniquement pour terminer les contrôles et reprendre la finalisation en sécurité.
                  </p>
                )}
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p><strong>État :</strong> {purgeState.status.replaceAll('_', ' ')}</p>
                  <p><strong>Étape :</strong> {purgeState.stage.replaceAll('_', ' ')}</p>
                  {purgeState.storagePhase && <p><strong>Lot Storage :</strong> {purgeState.storagePhase.replaceAll('_', ' ')}</p>}
                  {purgeState.sweepNotBefore && (
                    <p className="mt-1">Balayage final après {new Date(purgeState.sweepNotBefore).toLocaleString('fr-FR')}.</p>
                  )}
                  {!purgeState.canResume && (
                    <p className="mt-2 text-xs">Le compte reste gelé. La reprise sera proposée à l’expiration du délai ou du bail de traitement.</p>
                  )}
                </div>
                {purgeState.canResume && (
                  <form onSubmit={resumePurge} className="space-y-4">
                    <label className="block text-sm font-semibold">Recopiez exactement l’e-mail du client<input ref={emailInput} value={exactEmail} onChange={(event) => setExactEmail(event.target.value)} autoComplete="off" spellCheck={false} aria-invalid={exactEmail.length > 0 && exactEmail !== selected.email} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
                    <label className="block text-sm font-semibold">Votre mot de passe actuel<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
                    <button type="submit" disabled={purging || exactEmail !== selected.email || password.length < 8} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40">{purging ? <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> Reprise sécurisée…</> : 'Reprendre la suppression'}</button>
                  </form>
                )}
              </div>
            )}
          </DialogPanel>
        </DialogBackdrop>
        )}
      </Dialog>
    </div>
  );
}
