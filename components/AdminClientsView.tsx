'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, LoaderCircle, Search, Trash2, Users, X } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogPanel } from '@/components/ui/Dialog';
import {
  CLIENT_PURGE_EXTERNAL_CHECKLIST,
  continueClientPurgeAutomatically,
  createClientPurgeChallengeGuard,
  runClientPurgeAutomaticFlow,
} from '@/lib/client-purge';
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
  workKind?: string;
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

type ActivePurgeRun = {
  id: number;
  targetUserId: string;
  controller: AbortController;
  challengeId: string | null;
  commitDispatched: boolean;
  commitInFlight: boolean;
  executionStarted: boolean;
};

async function responseJson<T>(response: Response) {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Une erreur est survenue.');
  return body;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Opération annulée.', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Opération annulée.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
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
  const [purgeError, setPurgeError] = useState('');
  const [purging, setPurging] = useState(false);
  const [commitInFlight, setCommitInFlight] = useState(false);
  const [notice, setNotice] = useState('');
  const [externalChecklist, setExternalChecklist] = useState<ObservedClientPurge[]>([]);
  const purgeRunSequence = useRef(0);
  const activePurgeRun = useRef<ActivePurgeRun | null>(null);
  const challengeGuard = useRef(createClientPurgeChallengeGuard());
  const uncertainChallenges = useRef(new Set<string>());
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
        setNotice(`Le nettoyage résiduel de ${target.email} est terminé.`);
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

  function closeDialog() {
    const run = activePurgeRun.current;
    if (run?.commitInFlight) {
      setPurgeError(
        'Le lancement sécurisé est en cours. Patientez quelques secondes avant de fermer ce suivi.',
      );
      return;
    }
    if (run) {
      run.controller.abort();
      activePurgeRun.current = null;
      setPurging(false);
      if (run.executionStarted || run.commitDispatched) {
        setNotice(
          run.executionStarted
            ? 'Le suivi interactif est fermé. La suppression déjà lancée sera reprise automatiquement en arrière-plan.'
            : 'Le suivi est fermé pendant la vérification du lancement. Si la demande a été enregistrée, le worker automatique la terminera.',
        );
      }
    }
    setSelected(null);
    setPreview(null);
    setPurgeState(null);
    setPurgeError('');
    setCommitInFlight(false);
  }

  function assertActiveRun(run: ActivePurgeRun) {
    if (activePurgeRun.current !== run || run.controller.signal.aborted) {
      throw new DOMException('Opération annulée.', 'AbortError');
    }
  }

  async function requestForRun<T>(
    run: ActivePurgeRun,
    url: string,
    init: RequestInit = {},
  ) {
    assertActiveRun(run);
    const response = await fetch(url, {
      cache: 'no-store',
      ...init,
      signal: run.controller.signal,
    });
    const body = await responseJson<T>(response);
    assertActiveRun(run);
    return body;
  }

  async function commitForRun<T>(
    run: ActivePurgeRun,
    url: string,
    init: Omit<RequestInit, 'keepalive' | 'signal'>,
  ) {
    assertActiveRun(run);
    const response = await fetch(url, {
      cache: 'no-store',
      ...init,
      keepalive: true,
    });
    const body = await responseJson<T>(response);
    assertActiveRun(run);
    return body;
  }

  async function purgeStatusForRun(run: ActivePurgeRun, client: Client) {
    assertActiveRun(run);
    const response = await fetch(`/api/admin/clients/${client.id}/purge`, {
      cache: 'no-store',
      signal: run.controller.signal,
    });
    if (response.status === 404) {
      assertActiveRun(run);
      return null;
    }
    const state = await responseJson<PurgeState>(response);
    assertActiveRun(run);
    return state;
  }

  function announceOutcome(client: Client, outcome: PurgeState) {
    observeWaitingSweep(client, outcome);
    const ignoredNotice = outcome.ignoredUnsafeStorageReferences
      ? ` ${outcome.ignoredUnsafeStorageReferences} référence Storage étrangère a été ignorée et son fichier préservé.`
      : '';
    const outcomeNotice = outcome.deleted
      ? 'Le compte est supprimé et son nettoyage résiduel est terminé.'
      : outcome.authDeleted
        ? `Le compte est supprimé immédiatement et la même adresse e-mail peut être réutilisée sans attendre. Le nettoyage Storage résiduel continue automatiquement en arrière-plan${outcome.sweepNotBefore ? ` après ${new Date(outcome.sweepNotBefore).toLocaleString('fr-FR')}` : ''}.`
        : 'La suppression sécurisée progresse par lots. Le worker automatique prendra le relais si ce suivi est fermé.';
    setNotice(outcomeNotice + ignoredNotice);
    if (outcome.deleted) showExternalChecklist(client);
  }

  async function continueUntilAuthDeleted(
    run: ActivePurgeRun,
    client: Client,
    initial: PurgeState,
  ) {
    const outcome = await continueClientPurgeAutomatically(initial, {
      wait: () => pause(200, run.controller.signal),
      resume: () => requestForRun<PurgeState>(
        run,
        `/api/admin/clients/${client.id}/purge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume: true }),
        },
      ),
      onOutcome: setPurgeState,
    });
    if (outcome.workKind === 'wait') {
      setNotice(
        'Un lot est déjà en cours. Le worker automatique poursuivra la suppression en arrière-plan.',
      );
      return outcome;
    }
    announceOutcome(client, outcome);
    await loadClients(run.controller.signal);
    return outcome;
  }

  async function recoverUncertainCommit(
    run: ActivePurgeRun,
    client: Client,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await pause(400, run.controller.signal);
      const state = await purgeStatusForRun(run, client);
      if (!state || state.status === 'preview') continue;

      if (run.challengeId) uncertainChallenges.current.delete(run.challengeId);
      run.executionStarted = true;
      setPurgeState(state);
      if (
        state.deleted ||
        state.authDeleted ||
        state.status === 'waiting_sweep'
      ) {
        announceOutcome(client, state);
        await loadClients(run.controller.signal);
        return true;
      }
      if (!state.canResume) {
        setNotice(
          'Le lancement est bien enregistré. Le worker automatique poursuivra si le traitement serveur en cours ne se termine pas dans cet onglet.',
        );
        await loadClients(run.controller.signal);
        return true;
      }

      const resumed = await requestForRun<PurgeState>(
        run,
        `/api/admin/clients/${client.id}/purge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume: true }),
        },
      );
      await continueUntilAuthDeleted(run, client, resumed);
      return true;
    }
    return false;
  }

  async function openPurge(client: Client) {
    if (activePurgeRun.current) return;
    const run: ActivePurgeRun = {
      id: ++purgeRunSequence.current,
      targetUserId: client.id,
      controller: new AbortController(),
      challengeId: null,
      commitDispatched: false,
      commitInFlight: false,
      executionStarted: false,
    };
    activePurgeRun.current = run;
    setSelected(client);
    setPreview(null);
    setPurgeState(null);
    setPurgeError('');
    setNotice('');
    setPurging(true);

    try {
      const currentState = await purgeStatusForRun(run, client);
      if (currentState && currentState.status !== 'preview') {
        const state = currentState;
        setPurgeState(state);
        if (
          state.deleted ||
          state.authDeleted ||
          state.status === 'waiting_sweep'
        ) {
          announceOutcome(client, state);
          return;
        }
        if (!state.canResume) {
          setNotice(
            'Cette suppression est déjà traitée. Le worker automatique la poursuivra en arrière-plan.',
          );
          return;
        }
        run.executionStarted = true;
        const resumed = await requestForRun<PurgeState>(
          run,
          `/api/admin/clients/${client.id}/purge`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume: true }),
          },
        );
        await continueUntilAuthDeleted(run, client, resumed);
        return;
      }

      const recovering = currentState?.status === 'preview';
      const outcome = await runClientPurgeAutomaticFlow<Preview, PurgeState>({
        startPreview: () => requestForRun<Preview>(
          run,
          `/api/admin/clients/${client.id}/purge/preview${recovering ? '/continue' : ''}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              recovering ? { continue: true } : { idempotencyKey: crypto.randomUUID() },
            ),
          },
        ),
        continuePreview: () => requestForRun<Preview>(
          run,
          `/api/admin/clients/${client.id}/purge/preview/continue`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ continue: true }),
          },
        ),
        commit: (readyPreview) => {
          if (uncertainChallenges.current.has(readyPreview.challengeId)) {
            throw new Error(
              'Le lancement précédent reste incertain. L’état serveur a été relu et ce challenge ne sera pas renvoyé ; rechargez la page avant une nouvelle tentative.',
            );
          }
          run.challengeId = readyPreview.challengeId;
          run.commitDispatched = true;
          run.commitInFlight = true;
          setCommitInFlight(true);
          return commitForRun<PurgeState>(run, `/api/admin/clients/${client.id}/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              challengeId: readyPreview.challengeId,
              challengeToken: readyPreview.challengeToken,
              idempotencyKey: readyPreview.idempotencyKey,
            }),
          }).then((committed) => {
            run.executionStarted = true;
            setPurgeError('');
            return committed;
          }).finally(() => {
            run.commitInFlight = false;
            if (activePurgeRun.current === run) setCommitInFlight(false);
          });
        },
        resume: () => requestForRun<PurgeState>(
          run,
          `/api/admin/clients/${client.id}/purge`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume: true }),
          },
        ),
        wait: (phase) => pause(
          phase === 'preview' ? 150 : 200,
          run.controller.signal,
        ),
        runChallenge: challengeGuard.current,
        onPreview: setPreview,
        onOutcome: setPurgeState,
      });
      if (outcome.workKind === 'wait') {
        setNotice(
          'Un lot est déjà en cours. Le worker automatique poursuivra la suppression en arrière-plan.',
        );
        return;
      }
      announceOutcome(client, outcome);
      await loadClients(run.controller.signal);
    } catch (caughtError) {
      let runError = caughtError;
      if (
        !isAbortError(runError) &&
        activePurgeRun.current === run &&
        run.commitDispatched &&
        !run.executionStarted
      ) {
        if (run.challengeId) uncertainChallenges.current.add(run.challengeId);
        try {
          if (await recoverUncertainCommit(run, client)) return;
        } catch (recoveryError) {
          runError = recoveryError;
        }
      }
      if (!isAbortError(runError) && activePurgeRun.current === run) {
        setPurgeError(
          runError instanceof Error ? runError.message : 'Suppression interrompue.',
        );
        if (run.executionStarted || run.commitDispatched) {
          setNotice(
            run.executionStarted
              ? 'La reprise interactive a été interrompue. Le worker automatique reste chargé de terminer la suppression.'
              : 'La réponse du lancement est incertaine. Si la demande a été enregistrée, le worker automatique la terminera ; son état sera relu à la prochaine ouverture.',
          );
          void loadClients();
        }
      }
    } finally {
      if (activePurgeRun.current === run) {
        activePurgeRun.current = null;
        setPurging(false);
        setCommitInFlight(false);
      }
    }
  }

  useEffect(() => () => {
    activePurgeRun.current?.controller.abort();
    activePurgeRun.current = null;
  }, []);

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
                        ? 'Compte supprimé — nettoyage automatique en cours'
                        : `Suppression : ${client.purgeStatus.replaceAll('_', ' ')}`}
                    </p>
                  )}
                  <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-slate-500">KYC</dt><dd className="font-semibold">{client.kycStatus?.replaceAll('_', ' ') || 'Non soumis'}</dd></div>
                    <div><dt className="text-slate-500">Comptes</dt><dd className="font-semibold">{client.counts.accounts}</dd></div>
                    <div><dt className="text-slate-500">Prêts</dt><dd className="font-semibold">{client.counts.loans}</dd></div>
                    <div><dt className="text-slate-500">Virements</dt><dd className="font-semibold">{client.counts.transfers}</dd></div>
                  </dl>
                  <button type="button" disabled={purging} onClick={() => void openPurge(client)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">
                    <Trash2 aria-hidden="true" className="h-4 w-4" /> {purging && selected?.id === client.id ? 'Suppression en cours…' : client.purgeStatus ? 'Voir ou reprendre' : 'Supprimer les données'}
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
                      <td className="px-2 py-4"><p className="font-bold text-slate-900">{client.displayName || 'Sans nom'}</p><p className="break-all text-[10px] text-slate-500">{client.email}</p>{client.purgeStatus && <p className="mt-1 text-[10px] font-bold text-amber-700">{client.authDeleted ? 'Compte supprimé — nettoyage automatique en cours' : `Suppression : ${client.purgeStatus.replaceAll('_', ' ')}`}</p>}</td>
                      <td className="px-2 py-4 font-semibold">{client.kycStatus?.replaceAll('_', ' ') || 'Non soumis'}</td>
                      <td className="px-2 py-4">{client.counts.accounts}</td>
                      <td className="px-2 py-4">{client.counts.loans} prêt(s), {client.counts.transfers} virement(s)</td>
                      <td className="px-2 py-4 text-right"><button type="button" disabled={purging} onClick={() => void openPurge(client)} className="min-h-11 rounded-xl border border-red-300 px-3 py-2 font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">{purging && selected?.id === client.id ? 'Suppression…' : client.purgeStatus ? 'Voir / reprendre' : 'Supprimer'}</button></td>
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
        closeOnBackdrop={!purging}
      >
        {selected && (
          <DialogBackdrop className="fixed inset-0 z-50 flex items-end overflow-hidden bg-slate-950/60 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] sm:items-center sm:justify-center sm:px-4 sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
          <DialogPanel as="section" className="max-h-dvh w-full min-w-0 overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="flex items-center gap-2 text-xs font-bold uppercase text-red-700"><AlertTriangle aria-hidden="true" className="h-4 w-4" /> Action irréversible</p><h2 id="purge-title" className="mt-1 text-xl font-extrabold">{purgeState?.authDeleted || selected.authDeleted ? 'Suivi du nettoyage résiduel' : purgeState ? 'Suivi de la suppression' : 'Supprimer toutes les données'}</h2></div>
              <button type="button" onClick={() => closeDialog()} aria-disabled={commitInFlight} aria-label={commitInFlight ? 'Fermeture temporairement bloquée pendant le lancement sécurisé' : purging ? 'Fermer le suivi ; la suppression continuera automatiquement si elle est enregistrée' : 'Fermer'} title={commitInFlight ? 'Patientez pendant l’enregistrement irréversible de la demande.' : purging ? 'La suppression continuera automatiquement en arrière-plan si elle est enregistrée.' : undefined} className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5" /></button>
            </div>
            <p className="mt-3 text-sm text-slate-600">Client : <strong className="break-all">{selected.email}</strong>. Dès ce clic, le compte est supprimé automatiquement et la même adresse e-mail peut être réutilisée sans attendre. Le nettoyage Storage résiduel continue automatiquement en arrière-plan après le délai de sécurité de deux heures et cinq minutes, puis un dernier contrôle ciblé est exécuté.</p>

            {!preview && !purgeState && !purgeError && <p role="status" className="mt-6 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> Suppression automatique en cours…</p>}
            {purgeError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{purgeError}</p>}

            {preview?.pending && (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <p role="status" className="flex items-center gap-2 font-semibold">
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Inventaire Storage automatique en cours. Le curseur est conservé si vous fermez ou rechargez cette page.
                </p>
              </div>
            )}
            {preview && !preview.pending && !purgeState && (
              <div className="mt-5 space-y-4">
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
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Vous allez supprimer définitivement le compte <strong className="break-all">{preview.targetEmail}</strong>.</p>
                <p className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900" role="status"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> Le défi sécurisé est validé automatiquement. Suppression et libération de l’e-mail en cours…</p>
                <p className="text-xs text-slate-500">Le défi expire à {new Date(preview.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. L’état privé est conservé uniquement jusqu’au nettoyage final ou en cas d’échec.</p>
              </div>
            )}

            {purgeState && (
              <div className="mt-5 space-y-4">
                {(selected.authDeleted || purgeState.authDeleted) && (
                  <p role="status" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
                    Le compte Auth est supprimé et son e-mail peut déjà être réutilisé. L’état privé minimal de l’ancien compte reste visible uniquement le temps du nettoyage Storage résiduel.
                  </p>
                )}
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p><strong>État :</strong> {purgeState.status.replaceAll('_', ' ')}</p>
                  <p><strong>Étape :</strong> {purgeState.stage.replaceAll('_', ' ')}</p>
                  {purgeState.storagePhase && <p><strong>Lot Storage :</strong> {purgeState.storagePhase.replaceAll('_', ' ')}</p>}
                  {purgeState.sweepNotBefore && (
                    <p className="mt-1">Nettoyage Storage résiduel automatique après {new Date(purgeState.sweepNotBefore).toLocaleString('fr-FR')}.</p>
                  )}
                  {!purgeState.canResume && (
                    <p className="mt-2 text-xs">{selected.authDeleted || purgeState.authDeleted ? 'Aucune attente n’est nécessaire pour recréer le compte. La reprise du nettoyage est automatique.' : 'Le compte reste gelé pendant le traitement initial. Une reprise sera proposée si celui-ci est interrompu.'}</p>
                  )}
                </div>
                {purging && !purgeState.authDeleted && (
                  <p className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900" role="status"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> Reprise automatique des lots jusqu’à la suppression du compte…</p>
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
