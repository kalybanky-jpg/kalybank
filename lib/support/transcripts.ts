const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTITY_MARKER_SUFFIX =
  /(?:\s*\[mz1:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32}\])+\s*$/i;
const MIME_TYPE =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/i;
const LANGUAGE_TAG = /^[a-z]{2}(?:-[a-z0-9]{1,8})*$/;
const EMAIL = /^[^\s@]+@[^\s@]+$/;

const DEFAULT_CONVERSATION_LIMIT = 50;
const MAX_CONVERSATION_LIMIT = 100;
const MAX_MESSAGES_PER_CONVERSATION = 250;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_ATTACHMENTS_PER_CONVERSATION = 100;
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_CONVERSATION_TEXT_LENGTH = 100_000;
const MAX_URL_LENGTH = 2_048;

export const SUPPORT_TRANSCRIPT_ADMIN_SELECT = [
  'id',
  'tawk_chat_id',
  'event_at',
  'created_at',
  'identity_status',
  'notification_display_name',
  'notification_email',
  'notification_language',
  'visitor_email_normalized',
  'payload',
].join(',');

export type SupportConversationIdentityStatus =
  | 'resolved'
  | 'missing_email'
  | 'not_found'
  | 'ambiguous';

export type SupportConversationSenderType = 'visitor' | 'agent' | 'system';

export interface SupportConversationAttachmentDto {
  name: string | null;
  url: string;
  contentType: string | null;
  size: number | null;
}

export interface SupportConversationMessageDto {
  id: string | null;
  senderType: SupportConversationSenderType;
  senderName: string | null;
  text: string | null;
  createdAt: string | null;
  attachments: SupportConversationAttachmentDto[];
}

export interface SupportConversationDto {
  id: string;
  chatId: string;
  occurredAt: string;
  createdAt: string;
  identityStatus: SupportConversationIdentityStatus;
  visitor: {
    name: string | null;
    email: string | null;
    language: string | null;
  };
  messages: SupportConversationMessageDto[];
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string' || maxLength < 1) return null;
  const normalized = value
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function sanitizeSingleLine(value: unknown, maxLength: number) {
  const text = sanitizeText(value, maxLength);
  return text?.replace(/[\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim() || null;
}

function safeIsoDate(value: unknown) {
  const source = sanitizeSingleLine(value, 100);
  if (!source) return null;
  const timestamp = Date.parse(source);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function safeEmail(value: unknown) {
  const email = sanitizeSingleLine(value, 254)?.toLowerCase() ?? null;
  return email && EMAIL.test(email) ? email : null;
}

function safeLanguage(value: unknown) {
  const language = sanitizeSingleLine(value, 35)
    ?.toLowerCase()
    .replaceAll('_', '-');
  return language && LANGUAGE_TAG.test(language) ? language : null;
}

function safeHttpsUrl(value: unknown) {
  const source = sanitizeSingleLine(value, MAX_URL_LENGTH);
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeIdentityStatus(
  value: unknown,
): SupportConversationIdentityStatus | null {
  return value === 'resolved' ||
    value === 'missing_email' ||
    value === 'not_found' ||
    value === 'ambiguous'
    ? value
    : null;
}

export function stripTawkIdentityMarker(value: unknown) {
  const name = sanitizeSingleLine(value, 1_000);
  if (!name) return null;
  const visibleName = name.replace(IDENTITY_MARKER_SUFFIX, '').trim();
  return visibleName ? visibleName.slice(0, 200) : null;
}

function parseAttachment(value: unknown): SupportConversationAttachmentDto | null {
  const attachment = asObject(value);
  const content = asObject(attachment?.content);
  const file = asObject(content?.file);
  const url = safeHttpsUrl(file?.url);
  if (!file || !url) return null;

  const rawContentType = sanitizeSingleLine(file.mimeType, 129);
  const contentType = rawContentType && MIME_TYPE.test(rawContentType)
    ? rawContentType.toLowerCase()
    : null;
  const size =
    typeof file.size === 'number' &&
    Number.isSafeInteger(file.size) &&
    file.size >= 0
      ? file.size
      : null;

  return {
    name: sanitizeSingleLine(file.name, 255),
    url,
    contentType,
    size,
  };
}

function senderType(value: unknown): SupportConversationSenderType {
  if (value === 'v') return 'visitor';
  if (value === 'a') return 'agent';
  return 'system';
}

function parseMessages(value: unknown, visitorName: string | null) {
  if (!Array.isArray(value)) return [];

  const messages: SupportConversationMessageDto[] = [];
  let remainingTextLength = MAX_CONVERSATION_TEXT_LENGTH;
  let remainingAttachmentCount = MAX_ATTACHMENTS_PER_CONVERSATION;

  for (const rawMessage of value.slice(0, MAX_MESSAGES_PER_CONVERSATION)) {
    const message = asObject(rawMessage);
    if (!message) continue;

    const sender = asObject(message.sender);
    const parsedSenderType = senderType(sender?.t);
    const textLimit = Math.min(MAX_MESSAGE_LENGTH, remainingTextLength);
    const text = sanitizeText(message.msg, textLimit);
    if (text) remainingTextLength -= text.length;

    const attachmentLimit = Math.min(
      MAX_ATTACHMENTS_PER_MESSAGE,
      remainingAttachmentCount,
    );
    const attachments = Array.isArray(message.attchs)
      ? message.attchs
          .slice(0, attachmentLimit)
          .map(parseAttachment)
          .filter(
            (attachment): attachment is SupportConversationAttachmentDto =>
              attachment !== null,
          )
      : [];
    remainingAttachmentCount -= attachments.length;

    if (!text && attachments.length === 0) continue;
    const parsedSenderName = stripTawkIdentityMarker(sender?.n);
    messages.push({
      id: sanitizeSingleLine(message.id, 200),
      senderType: parsedSenderType,
      senderName:
        parsedSenderName ??
        (parsedSenderType === 'visitor' ? visitorName : null),
      text,
      createdAt: safeIsoDate(message.time),
      attachments,
    });
  }

  return messages;
}

export function parseSupportConversation(
  value: unknown,
): SupportConversationDto | null {
  const row = asObject(value);
  if (!row) return null;

  const id = sanitizeSingleLine(row.id, 36);
  const chatId = sanitizeSingleLine(row.tawk_chat_id, 200);
  const occurredAt = safeIsoDate(row.event_at);
  const createdAt = safeIsoDate(row.created_at);
  const identityStatus = safeIdentityStatus(row.identity_status);
  if (
    !id ||
    !UUID.test(id) ||
    !chatId ||
    !occurredAt ||
    !createdAt ||
    !identityStatus
  ) {
    return null;
  }

  const payload = asObject(row.payload);
  const chat = asObject(payload?.chat);
  const visitor = asObject(chat?.visitor);
  const visitorName =
    stripTawkIdentityMarker(row.notification_display_name) ??
    stripTawkIdentityMarker(visitor?.name);
  const visitorEmail =
    safeEmail(row.notification_email) ??
    safeEmail(row.visitor_email_normalized) ??
    safeEmail(visitor?.email);

  return {
    id: id.toLowerCase(),
    chatId,
    occurredAt,
    createdAt,
    identityStatus,
    visitor: {
      name: visitorName,
      email: visitorEmail,
      language: safeLanguage(row.notification_language),
    },
    messages: parseMessages(chat?.messages, visitorName),
  };
}

export function parseSupportConversations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseSupportConversation)
    .filter(
      (conversation): conversation is SupportConversationDto =>
        conversation !== null,
    );
}

export function parseSupportConversationLimit(value: string | null | undefined) {
  if (!value || !/^\d{1,3}$/.test(value)) return DEFAULT_CONVERSATION_LIMIT;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return DEFAULT_CONVERSATION_LIMIT;
  }
  return Math.min(parsed, MAX_CONVERSATION_LIMIT);
}
