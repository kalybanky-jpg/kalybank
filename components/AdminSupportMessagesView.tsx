'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  Inbox,
  Mail,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import type { SupportConversationDto } from '@/lib/support/transcripts';

type LoadState = 'loading' | 'ready' | 'error';
type SenderKind = 'customer' | 'support' | 'system';

interface SupportConversationsResponse {
  conversations?: SupportConversationDto[];
  error?: string;
}

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function normalizedSearchValue(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR');
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date indisponible';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date indisponible' : dateTimeFormatter.format(date);
}

function visitorName(conversation: SupportConversationDto) {
  return conversation.visitor.name?.trim() || 'Client sans nom';
}

function senderKind(value: string): SenderKind {
  const normalized = value.trim().toLocaleLowerCase('fr-FR');
  if (['customer', 'visitor', 'user', 'client', 'v'].includes(normalized)) {
    return 'customer';
  }
  if (['support', 'agent', 'staff', 'admin', 'a'].includes(normalized)) {
    return 'support';
  }
  return 'system';
}

function safeAttachmentUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function lastMessagePreview(conversation: SupportConversationDto) {
  const message = conversation.messages.at(-1);
  if (!message) return 'Aucun message dans cette transcription.';
  const text = message.text?.trim();
  if (text) return text;
  return message.attachments.length > 0 ? 'Pièce jointe' : 'Message sans contenu textuel';
}

export default function AdminSupportMessagesView() {
  const [conversations, setConversations] = useState<SupportConversationDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const loadConversations = useCallback(
    async (options: { initial?: boolean; signal?: AbortSignal } = {}) => {
      // Defer state transitions past the effect's synchronous setup phase.
      await Promise.resolve();
      if (options.signal?.aborted) return;
      const initial = options.initial ?? false;
      if (initial) setLoadState('loading');
      else setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/admin/support-conversations?limit=50', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: options.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | SupportConversationsResponse
          | null;
        if (!response.ok) {
          throw new Error(
            payload?.error?.trim() || 'Les conversations n’ont pas pu être chargées.',
          );
        }

        const nextConversations = Array.isArray(payload?.conversations)
          ? payload.conversations
          : [];
        setConversations(nextConversations);
        setSelectedId((currentId) =>
          currentId && nextConversations.some((conversation) => conversation.id === currentId)
            ? currentId
            : nextConversations[0]?.id ?? null,
        );
        setLoadState('ready');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Les conversations n’ont pas pu être chargées.',
        );
        if (initial) setLoadState('error');
      } finally {
        if (!initial) setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadConversations({ initial: true, signal: controller.signal });
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadConversations]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = normalizedSearchValue(query.trim());
    if (!normalizedQuery) return conversations;
    return conversations.filter((conversation) => {
      const searchable = [
        conversation.chatId,
        conversation.visitor.name,
        conversation.visitor.email,
        conversation.visitor.language,
        ...conversation.messages.flatMap((message) => [
          message.senderName,
          message.text,
          ...message.attachments.map((attachment) => attachment.name),
        ]),
      ];
      return normalizedSearchValue(searchable.join(' ')).includes(normalizedQuery);
    });
  }, [conversations, query]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedId) ??
    filteredConversations[0] ??
    null;

  const selectConversation = (conversation: SupportConversationDto) => {
    setSelectedId(conversation.id);
    setMobileDetailOpen(true);
  };

  const showFullError = loadState === 'error' && conversations.length === 0;
  const showInitialLoading = loadState === 'loading' && conversations.length === 0;

  return (
    <div className="min-w-0 space-y-5 py-1">
      <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
              Assistance clients
            </p>
            <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Messagerie support</h1>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Consultez les transcriptions des échanges terminés avec les clients.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadConversations()}
          disabled={isRefreshing || loadState === 'loading'}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isRefreshing ? 'Actualisation…' : 'Rafraîchir'}
        </button>
      </header>

      <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-950">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
        <p>
          Les conversations apparaissent dans cette archive uniquement après leur clôture dans
          le widget de chat. Cette vue n’affiche pas les échanges en cours en temps réel.
        </p>
      </div>

      {errorMessage && !showFullError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {showFullError ? (
        <section className="rounded-3xl border border-rose-200 bg-white px-5 py-12 text-center shadow-sm">
          <AlertCircle className="mx-auto h-9 w-9 text-rose-500" aria-hidden="true" />
          <h2 className="mt-4 text-sm font-extrabold text-slate-900">
            Messagerie indisponible
          </h2>
          <p role="alert" className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-600">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => void loadConversations({ initial: true })}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Réessayer
          </button>
        </section>
      ) : (
        <div className="grid min-h-[560px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_38px_rgba(15,23,42,0.05)] lg:grid-cols-[minmax(300px,0.38fr)_minmax(0,0.62fr)]">
          <section
            aria-label="Liste des conversations"
            className={`${mobileDetailOpen ? 'hidden lg:flex' : 'flex'} min-w-0 flex-col border-slate-200 lg:border-r`}
          >
            <div className="border-b border-slate-100 p-4">
              <label className="relative block">
                <span className="sr-only">Rechercher une conversation</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nom, e-mail, message…"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
              </label>
              <p className="mt-2 text-[10px] font-medium text-slate-500" aria-live="polite">
                {showInitialLoading
                  ? 'Chargement des conversations…'
                  : `${filteredConversations.length} conversation${
                      filteredConversations.length > 1 ? 's' : ''
                    }`}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {showInitialLoading ? (
                <div role="status" className="space-y-2 p-2" aria-label="Chargement">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="animate-pulse rounded-2xl border border-slate-100 p-4">
                      <div className="h-3 w-2/3 rounded bg-slate-200" />
                      <div className="mt-3 h-2.5 w-full rounded bg-slate-100" />
                      <div className="mt-2 h-2.5 w-1/2 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                  <Inbox className="h-10 w-10 text-slate-300" aria-hidden="true" />
                  <h2 className="mt-4 text-sm font-extrabold text-slate-800">
                    {conversations.length === 0
                      ? 'Aucune conversation clôturée'
                      : 'Aucun résultat'}
                  </h2>
                  <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                    {conversations.length === 0
                      ? 'Les premières transcriptions s’afficheront ici après la clôture des chats.'
                      : 'Essayez une autre recherche ou effacez le filtre.'}
                  </p>
                  {query && conversations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="mt-4 min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 sm:w-auto"
                    >
                      Effacer la recherche
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredConversations.map((conversation) => {
                    const active = selectedConversation?.id === conversation.id;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => selectConversation(conversation)}
                        aria-pressed={active}
                        className={`w-full rounded-2xl border px-3.5 py-3 text-left transition ${
                          active
                            ? 'border-violet-200 bg-violet-50 shadow-sm'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-slate-900">
                              {visitorName(conversation)}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">
                              {conversation.visitor.email || `Chat ${conversation.chatId}`}
                            </p>
                          </div>
                          <time className="shrink-0 text-[9px] font-medium text-slate-400">
                            {formatDate(conversation.occurredAt)}
                          </time>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-600">
                          {lastMessagePreview(conversation)}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[9px] font-medium text-slate-400">
                          <span className="truncate">#{conversation.chatId}</span>
                          <span className="shrink-0">
                            {conversation.messages.length} message
                            {conversation.messages.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section
            aria-label="Détail de la conversation"
            className={`${mobileDetailOpen ? 'flex' : 'hidden lg:flex'} min-w-0 flex-col bg-slate-50/50`}
          >
            {selectedConversation ? (
              <>
                <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setMobileDetailOpen(false)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
                      aria-label="Retour à la liste des conversations"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-extrabold text-slate-900">
                        {visitorName(selectedConversation)}
                      </h2>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                        {selectedConversation.visitor.email && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="break-all">{selectedConversation.visitor.email}</span>
                          </span>
                        )}
                        <span>{formatDate(selectedConversation.occurredAt)}</span>
                        {selectedConversation.visitor.language && (
                          <span className="uppercase">
                            {selectedConversation.visitor.language}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 break-all font-mono text-[9px] text-slate-400">
                        Conversation #{selectedConversation.chatId}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
                  {selectedConversation.messages.length === 0 ? (
                    <div className="flex min-h-72 flex-col items-center justify-center text-center">
                      <MessageCircle className="h-9 w-9 text-slate-300" aria-hidden="true" />
                      <p className="mt-3 text-xs font-bold text-slate-600">
                        Aucun message exploitable dans cette transcription.
                      </p>
                    </div>
                  ) : (
                    selectedConversation.messages.map((message, index) => {
                      const kind = senderKind(message.senderType);
                      const isCustomer = kind === 'customer';
                      const isSystem = kind === 'system';
                      const messageText = message.text?.trim() ?? '';
                      return (
                        <article
                          key={message.id || `${selectedConversation.id}-${index}`}
                          className={`flex ${
                            isSystem
                              ? 'justify-center'
                              : isCustomer
                                ? 'justify-end'
                                : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs shadow-sm sm:max-w-[76%] ${
                              isSystem
                                ? 'bg-slate-200/80 text-slate-700'
                                : isCustomer
                                  ? 'rounded-br-md bg-violet-600 text-white'
                                  : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                            }`}
                          >
                            <div
                              className={`mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[9px] font-bold ${
                                isCustomer ? 'text-violet-100' : 'text-slate-500'
                              }`}
                            >
                              <span>
                                {message.senderName?.trim() ||
                                  (isCustomer
                                    ? visitorName(selectedConversation)
                                    : kind === 'support'
                                      ? 'Support'
                                      : 'Système')}
                              </span>
                              <time>{formatDate(message.createdAt)}</time>
                            </div>
                            {messageText && (
                              <p className="whitespace-pre-wrap break-words leading-5">
                                {messageText}
                              </p>
                            )}
                            {message.attachments.length > 0 && (
                              <ul className="mt-2 space-y-1.5">
                                {message.attachments.map((attachment, attachmentIndex) => {
                                  const href = safeAttachmentUrl(attachment.url);
                                  const label = attachment.name?.trim() || 'Pièce jointe';
                                  return (
                                    <li
                                      key={`${message.id}-attachment-${attachmentIndex}`}
                                      className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 ${
                                        isCustomer ? 'bg-white/15' : 'bg-slate-100'
                                      }`}
                                    >
                                      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                      {href ? (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex min-h-11 min-w-0 flex-1 items-center break-all font-bold underline underline-offset-2"
                                        >
                                          {label}
                                        </a>
                                      ) : (
                                        <span className="min-w-0 break-all font-bold">{label}</span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                <footer className="border-t border-slate-200 bg-white px-4 py-3 text-[10px] text-slate-500 sm:px-5">
                  Transcription archivée le {formatDate(selectedConversation.createdAt)} · Statut
                  d’identité : {selectedConversation.identityStatus}
                </footer>
              </>
            ) : (
              <div className="flex min-h-[480px] flex-1 flex-col items-center justify-center px-6 text-center">
                <MessageCircle className="h-11 w-11 text-slate-300" aria-hidden="true" />
                <h2 className="mt-4 text-sm font-extrabold text-slate-800">
                  Sélectionnez une conversation
                </h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                  Le détail et les pièces jointes de la transcription s’afficheront ici.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
