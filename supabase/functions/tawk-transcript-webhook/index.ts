import { createClient } from "@supabase/supabase-js";
// @deno-types="npm:@types/web-push@3.6.4"
import webPush from "web-push";

import {
  interpolateSupportCopy,
  resolveSupportLanguage,
  SUPPORT_FALLBACK_LANGUAGE,
  type SupportNotificationCopy,
  supportNotificationCopy,
} from "../_shared/support-i18n.ts";
import { verifyTawkIdentityMarker } from "../_shared/tawk-identity.ts";
import {
  areAllDeliveryChannelsTerminal,
  classifyDeliveryHttpStatus,
} from "../_shared/delivery-policy.ts";

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_EVENT_ID_LENGTH = 200;
const MAX_STORED_ERROR_LENGTH = 1000;
const DELIVERY_TIMEOUT_MS = 8_000;
const textEncoder = new TextEncoder();

type JsonObject = Record<string, unknown>;
type AdminClient = ReturnType<typeof createAdminClient>;
type IdentityStatus = "resolved" | "missing_email" | "not_found" | "ambiguous";

interface TranscriptPayload extends JsonObject {
  event: "chat:transcript_created";
  time: string;
  property: JsonObject & { id: string };
  chat: JsonObject & {
    id: string;
    visitor: JsonObject;
    messages: unknown[];
  };
}

interface TranscriptRow {
  id: string;
  user_id: string | null;
  tawk_event_id: string;
  tawk_property_id: string;
  tawk_chat_id: string;
  visitor_email_normalized: string | null;
  identity_status: IdentityStatus;
  notification_email: string | null;
  notification_language: string | null;
  notification_display_name: string | null;
  event_at: string;
  payload: unknown;
  raw_body_sha256: string;
  email_request_payload: unknown | null;
  email_status:
    | "pending"
    | "failed"
    | "permanent_failed"
    | "sent"
    | "skipped";
  email_attempts: number;
  completed_at: string | null;
}

interface IdentityResolution {
  status: IdentityStatus;
  normalizedVisitorEmail: string | null;
  userId: string | null;
  errorCode: string | null;
}

interface SupportProfile {
  userId: string;
  displayName: string | null;
  preferredLanguage: string;
  deliveryEmail: string;
}

interface StoredEmailRequest {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  endpoint_hash: string;
  p256dh: string;
  auth_key: string;
  expiration_time: number | null;
  failure_count: number;
}

interface PushDeliveryRow {
  id: string;
  transcript_id: string;
  subscription_id: string | null;
  endpoint_hash_snapshot: string;
  status: "pending" | "failed" | "sent" | "expired" | "invalid";
  attempts: number;
}

interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

class ProcessingError extends Error {
  constructor(
    readonly code: string,
    readonly status = 503,
  ) {
    super(code);
  }
}

function jsonResponse(status: number, code: string, extra?: JsonObject) {
  return Response.json(
    { ok: status >= 200 && status < 300, code, ...extra },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new ProcessingError(`missing_env_${name.toLowerCase()}`, 500);
  }
  return value;
}

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function boundedString(value: unknown, maxLength = 200) {
  return typeof value === "string" && value.length > 0 &&
      value.length <= maxLength
    ? value
    : null;
}

function parsePayload(
  value: unknown,
  expectedPropertyId: string,
): TranscriptPayload {
  const payload = asObject(value);
  const property = asObject(payload?.property);
  const chat = asObject(payload?.chat);
  const visitor = asObject(chat?.visitor);
  const event = boundedString(payload?.event, 100);
  const time = boundedString(payload?.time, 100);
  const propertyId = boundedString(property?.id, 200);
  const chatId = boundedString(chat?.id, 200);
  const messages = chat?.messages;

  if (event !== "chat:transcript_created") {
    throw new ProcessingError("unsupported_event", 422);
  }
  if (propertyId !== expectedPropertyId) {
    throw new ProcessingError("property_mismatch", 403);
  }
  if (!chatId || !visitor || !Array.isArray(messages)) {
    throw new ProcessingError("invalid_transcript_payload", 422);
  }
  if (!time || Number.isNaN(Date.parse(time))) {
    throw new ProcessingError("invalid_event_time", 422);
  }

  return {
    ...payload,
    event,
    time,
    property: { ...property, id: propertyId },
    chat: { ...chat, id: chatId, visitor, messages },
  };
}

function parseEventId(request: Request) {
  const eventId = request.headers.get("X-Hook-Event-Id")?.trim() ?? "";
  if (
    eventId.length === 0 ||
    eventId.length > MAX_EVENT_ID_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(eventId)
  ) {
    throw new ProcessingError("invalid_event_id", 422);
  }
  return eventId;
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]{40}$/i.test(value)) return null;
  const bytes = new Uint8Array(20);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifyTawkSignature(
  rawBody: Uint8Array<ArrayBuffer>,
  suppliedSignature: string | null,
  secret: string,
) {
  const supplied = suppliedSignature
    ? hexToBytes(suppliedSignature.trim())
    : null;
  if (!supplied) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, rawBody),
  );

  let difference = expected.length ^ supplied.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ (supplied[index] ?? 0);
  }
  return difference === 0;
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function createAdminClient() {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

function normalizeVisitorEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

async function resolveIdentity(
  admin: AdminClient,
  visitorName: unknown,
  visitorEmail: unknown,
): Promise<IdentityResolution> {
  const normalizedVisitorEmail = normalizeVisitorEmail(visitorEmail);
  const markerPresent = typeof visitorName === "string" &&
    visitorName.includes("[mz1:");
  let userId: string | null;
  try {
    userId = await verifyTawkIdentityMarker(
      visitorName,
      requiredEnv("TAWK_WEBHOOK_IDENTITY_SECRET"),
    );
  } catch {
    throw new ProcessingError("invalid_env_tawk_webhook_identity_secret", 500);
  }
  if (!userId) {
    return {
      status: "not_found",
      normalizedVisitorEmail,
      userId: null,
      errorCode: markerPresent
        ? "identity_marker_invalid"
        : "identity_marker_missing",
    };
  }

  const [identityResult, profileResult] = await Promise.all([
    admin
      .from("support_user_identities")
      .select("normalized_email")
      .eq("user_id", userId)
      .is("valid_to", null)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (identityResult.error || profileResult.error) {
    throw new ProcessingError("identity_lookup_failed");
  }
  const currentIdentity = asObject(identityResult.data);
  if (!currentIdentity || !profileResult.data) {
    return {
      status: "not_found",
      normalizedVisitorEmail,
      userId: null,
      errorCode: "identity_marker_user_not_found",
    };
  }
  const currentEmail = normalizeVisitorEmail(currentIdentity.normalized_email);
  if (!currentEmail) {
    throw new ProcessingError("current_identity_email_invalid");
  }

  return {
    status: "resolved",
    normalizedVisitorEmail,
    userId,
    errorCode: !normalizedVisitorEmail
      ? "visitor_email_missing_or_invalid"
      : normalizedVisitorEmail !== currentEmail
      ? "visitor_email_mismatch"
      : null,
  };
}

const transcriptColumns = [
  "id",
  "user_id",
  "tawk_event_id",
  "tawk_property_id",
  "tawk_chat_id",
  "visitor_email_normalized",
  "identity_status",
  "notification_email",
  "notification_language",
  "notification_display_name",
  "event_at",
  "payload",
  "raw_body_sha256",
  "email_request_payload",
  "email_status",
  "email_attempts",
  "completed_at",
].join(",");

async function findTranscript(admin: AdminClient, eventId: string) {
  const { data, error } = await admin
    .from("support_transcripts")
    .select(transcriptColumns)
    .eq("tawk_event_id", eventId)
    .maybeSingle();
  if (error) throw new ProcessingError("transcript_lookup_failed");
  return data as TranscriptRow | null;
}

async function findTranscriptByRawHash(
  admin: AdminClient,
  rawBodySha256: string,
) {
  const { data, error } = await admin
    .from("support_transcripts")
    .select(transcriptColumns)
    .eq("raw_body_sha256", rawBodySha256)
    .maybeSingle();
  if (error) throw new ProcessingError("transcript_hash_lookup_failed");
  return data as TranscriptRow | null;
}

function assertIdempotentMatch(
  transcript: TranscriptRow,
  rawBodySha256: string,
  propertyId: string,
  chatId: string,
) {
  if (
    transcript.raw_body_sha256 !== rawBodySha256 ||
    transcript.tawk_property_id !== propertyId ||
    transcript.tawk_chat_id !== chatId
  ) {
    throw new ProcessingError("event_id_payload_conflict", 409);
  }
}

async function archiveTranscript(
  admin: AdminClient,
  eventId: string,
  payload: TranscriptPayload,
  rawBody: string,
  rawBodySha256: string,
  identity: IdentityResolution,
) {
  const eventAt = new Date(payload.time).toISOString();
  const unresolved = identity.status !== "resolved";
  const { data, error } = await admin
    .from("support_transcripts")
    .insert({
      user_id: identity.userId,
      tawk_event_id: eventId,
      tawk_property_id: payload.property.id,
      tawk_chat_id: payload.chat.id,
      visitor_email_normalized: identity.normalizedVisitorEmail,
      identity_status: identity.status,
      identity_error: identity.errorCode,
      event_at: eventAt,
      payload,
      raw_body: rawBody,
      raw_body_sha256: rawBodySha256,
      email_status: unresolved ? "skipped" : "pending",
      completed_at: unresolved ? new Date().toISOString() : null,
    })
    .select(transcriptColumns)
    .single();

  if (!error) return data as unknown as TranscriptRow;
  if (error.code !== "23505") {
    throw new ProcessingError("transcript_archive_failed");
  }

  const existing = await findTranscript(admin, eventId) ??
    await findTranscriptByRawHash(admin, rawBodySha256);
  if (!existing) throw new ProcessingError("transcript_race_lookup_failed");
  assertIdempotentMatch(
    existing,
    rawBodySha256,
    payload.property.id,
    payload.chat.id,
  );
  return existing;
}

async function claimTranscript(
  admin: AdminClient,
  transcriptId: string,
  claimToken: string,
) {
  const { data, error } = await admin.rpc("claim_support_transcript", {
    p_transcript_id: transcriptId,
    p_claim_token: claimToken,
  });
  if (error) throw new ProcessingError("transcript_claim_failed");
  return data === true;
}

async function releaseTranscript(
  admin: AdminClient,
  transcriptId: string,
  claimToken: string,
  completed: boolean,
) {
  const { data, error } = await admin.rpc("release_support_transcript_claim", {
    p_transcript_id: transcriptId,
    p_claim_token: claimToken,
    p_completed: completed,
  });
  if (error || data !== true) {
    throw new ProcessingError("transcript_release_failed");
  }
}

async function loadSupportProfile(
  admin: AdminClient,
  userId: string,
): Promise<SupportProfile> {
  const [profileResult, identityResult, staffResult] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id,display_name,preferred_language")
      .eq("user_id", userId)
      .single(),
    admin
      .from("support_user_identities")
      .select("normalized_email")
      .eq("user_id", userId)
      .is("valid_to", null)
      .single(),
    admin
      .from("staff_members")
      .select("user_id")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw new ProcessingError("support_profile_missing");
  if (identityResult.error) {
    throw new ProcessingError("current_delivery_email_missing");
  }
  if (staffResult.error) {
    throw new ProcessingError("support_staff_lookup_failed");
  }

  const profile = asObject(profileResult.data);
  const identity = asObject(identityResult.data);
  const deliveryEmail = normalizeVisitorEmail(identity?.normalized_email);
  const profileUserId = boundedString(profile?.user_id, 100);
  if (!deliveryEmail || profileUserId !== userId) {
    throw new ProcessingError("invalid_support_profile");
  }

  return {
    userId,
    displayName: typeof profile?.display_name === "string"
      ? profile.display_name.trim().slice(0, 200) || null
      : null,
    preferredLanguage: resolveSupportLanguage(
      staffResult.data
        ? SUPPORT_FALLBACK_LANGUAGE
        : profile?.preferred_language,
    ),
    deliveryEmail,
  };
}

function profileFromTranscriptSnapshot(
  transcript: TranscriptRow,
): SupportProfile | null {
  const deliveryEmail = normalizeVisitorEmail(transcript.notification_email);
  if (
    !transcript.user_id ||
    !deliveryEmail ||
    !transcript.notification_language
  ) return null;

  return {
    userId: transcript.user_id,
    displayName: transcript.notification_display_name,
    preferredLanguage: resolveSupportLanguage(
      transcript.notification_language,
    ),
    deliveryEmail,
  };
}

async function ensureSupportProfileSnapshot(
  admin: AdminClient,
  transcript: TranscriptRow,
) {
  const existing = profileFromTranscriptSnapshot(transcript);
  if (existing) return existing;
  if (!transcript.user_id) throw new ProcessingError("resolved_user_missing");

  const current = await loadSupportProfile(admin, transcript.user_id);
  const snapshotValues = {
    notification_email: current.deliveryEmail,
    notification_language: current.preferredLanguage,
    notification_display_name: current.displayName,
  };
  const { data, error } = await admin
    .from("support_transcripts")
    .update(snapshotValues)
    .eq("id", transcript.id)
    .is("notification_email", null)
    .select(
      "notification_email,notification_language,notification_display_name",
    )
    .maybeSingle();
  if (error) throw new ProcessingError("notification_profile_snapshot_failed");

  const stored = asObject(data);
  if (stored) {
    transcript.notification_email =
      typeof stored.notification_email === "string"
        ? stored.notification_email
        : null;
    transcript.notification_language =
      typeof stored.notification_language === "string"
        ? stored.notification_language
        : null;
    transcript.notification_display_name =
      typeof stored.notification_display_name === "string"
        ? stored.notification_display_name
        : null;
  } else {
    const { data: racedData, error: racedError } = await admin
      .from("support_transcripts")
      .select(
        "notification_email,notification_language,notification_display_name",
      )
      .eq("id", transcript.id)
      .single();
    if (racedError) {
      throw new ProcessingError("notification_profile_snapshot_lookup_failed");
    }
    const raced = asObject(racedData);
    transcript.notification_email =
      typeof raced?.notification_email === "string"
        ? raced.notification_email
        : null;
    transcript.notification_language =
      typeof raced?.notification_language === "string"
        ? raced.notification_language
        : null;
    transcript.notification_display_name =
      typeof raced?.notification_display_name === "string"
        ? raced.notification_display_name
        : null;
  }

  const snapshot = profileFromTranscriptSnapshot(transcript);
  if (!snapshot) {
    throw new ProcessingError("invalid_notification_profile_snapshot");
  }
  return snapshot;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function messageSenderLabel(
  message: JsonObject,
  copy: SupportNotificationCopy,
) {
  const sender = asObject(message.sender);
  const senderType = sender?.t;
  const senderName = typeof sender?.n === "string"
    ? sender.n.trim().slice(0, 200)
    : "";
  if (senderType === "v") return copy.visitorSender;
  if (senderType === "a") return senderName || copy.agentSender;
  return senderName || copy.systemSender;
}

function attachmentFiles(message: JsonObject) {
  if (!Array.isArray(message.attchs)) return [];
  return message.attchs.flatMap((attachment) => {
    const file = asObject(asObject(asObject(attachment)?.content)?.file);
    return file ? [file] : [];
  });
}

function formatTranscriptEmail(
  payload: TranscriptPayload,
  profile: SupportProfile,
  brandName: string,
) {
  const sourceCopy = supportNotificationCopy(profile.preferredLanguage);
  const copy: SupportNotificationCopy = {
    ...sourceCopy,
    emailSubject: interpolateSupportCopy(sourceCopy.emailSubject, {
      brandName,
    }),
    emailPreheader: interpolateSupportCopy(sourceCopy.emailPreheader, {
      brandName,
    }),
    footer: interpolateSupportCopy(sourceCopy.footer, { brandName }),
  };
  const formattedDate = new Intl.DateTimeFormat(copy.locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(payload.time));
  const greeting = profile.displayName
    ? interpolateSupportCopy(copy.greeting, { name: profile.displayName })
    : copy.greetingWithoutName;

  const textMessages: string[] = [];
  const htmlMessages: string[] = [];
  payload.chat.messages.forEach((rawMessage) => {
    const message = asObject(rawMessage) ?? {};
    const sender = messageSenderLabel(message, copy);
    const messageTime = typeof message.time === "string" &&
        !Number.isNaN(Date.parse(message.time))
      ? new Intl.DateTimeFormat(copy.locale, {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(message.time))
      : "";
    const body = typeof message.msg === "string" && message.msg.trim()
      ? message.msg
      : copy.unavailableMessage;
    const files = attachmentFiles(message);
    const textAttachments = files.map((file) => {
      const name = typeof file.name === "string"
        ? file.name
        : copy.attachmentLabel;
      const url = safeHttpsUrl(file.url);
      const mime = typeof file.mimeType === "string"
        ? ` (${file.mimeType})`
        : "";
      const size = typeof file.size === "number" ? `, ${file.size} bytes` : "";
      return `${copy.attachmentLabel}: ${name}${mime}${size}${
        url ? ` — ${url}` : ""
      }`;
    });
    textMessages.push(
      `[${messageTime}] ${sender}\n${body}${
        textAttachments.length ? `\n${textAttachments.join("\n")}` : ""
      }`,
    );

    const htmlAttachments = files.map((file) => {
      const name = escapeHtml(
        typeof file.name === "string" ? file.name : copy.attachmentLabel,
      );
      const mime = typeof file.mimeType === "string"
        ? ` · ${escapeHtml(file.mimeType)}`
        : "";
      const size = typeof file.size === "number"
        ? ` · ${escapeHtml(file.size)} bytes`
        : "";
      const safeUrl = safeHttpsUrl(file.url);
      const link = safeUrl
        ? ` · <a href="${escapeHtml(safeUrl)}" style="color:#2563eb">${
          escapeHtml(copy.openAttachmentLabel)
        }</a>`
        : "";
      return `<li><strong>${
        escapeHtml(copy.attachmentLabel)
      }:</strong> ${name}${mime}${size}${link}</li>`;
    }).join("");
    htmlMessages.push(`
      <div style="padding:16px 0;border-bottom:1px solid #e5e7eb">
        <div style="font-size:13px;color:#59649a;margin-bottom:6px"><strong style="color:#0f172a">${
      escapeHtml(sender)
    }</strong>${messageTime ? ` · ${escapeHtml(messageTime)}` : ""}</div>
        <div style="font-size:15px;line-height:1.6;color:#1e293b;white-space:pre-wrap">${
      escapeHtml(body)
    }</div>
        ${
      htmlAttachments
        ? `<ul style="margin:10px 0 0;padding-left:20px">${htmlAttachments}</ul>`
        : ""
    }
      </div>`);
  });

  const text = [
    greeting,
    "",
    copy.emailIntroduction,
    "",
    `${copy.conversationLabel}: ${payload.chat.id}`,
    `${copy.conversationDateLabel}: ${formattedDate} (UTC)`,
    "",
    ...textMessages,
    "",
    copy.footer,
  ].join("\n");

  const html = `<!doctype html>
  <html lang="${escapeHtml(copy.locale.split("-", 1)[0])}">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;background:#f7f8fc;font-family:Arial,sans-serif;color:#0f172a">
      <div style="display:none;max-height:0;overflow:hidden">${
    escapeHtml(copy.emailPreheader)
  }</div>
      <div style="max-width:680px;margin:0 auto;padding:28px 16px">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:4px solid #5138ff;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.08)">
          <div style="padding:28px;background:#0a154f;color:#ffffff">
            <div style="font-size:22px;font-weight:700">${
    escapeHtml(copy.emailHeading)
  }</div>
          </div>
          <div style="padding:28px">
            <p style="font-size:16px;line-height:1.6;margin-top:0">${
    escapeHtml(greeting)
  }</p>
            <p style="font-size:15px;line-height:1.6;color:#59649a">${
    escapeHtml(copy.emailIntroduction)
  }</p>
            <div style="margin:22px 0;padding:14px 16px;background:#f7f8fc;border-radius:12px;font-size:13px;color:#59649a">
              <div><strong>${escapeHtml(copy.conversationLabel)}:</strong> ${
    escapeHtml(payload.chat.id)
  }</div>
              <div style="margin-top:5px"><strong>${
    escapeHtml(copy.conversationDateLabel)
  }:</strong> ${escapeHtml(formattedDate)} (UTC)</div>
            </div>
            <div>${htmlMessages.join("")}</div>
          </div>
          <div style="padding:20px 28px;background:#f7f8fc;color:#59649a;font-size:12px;line-height:1.5">${
    escapeHtml(copy.footer)
  }</div>
        </div>
      </div>
    </body>
  </html>`;

  return { copy, html, text };
}

function boundedError(code: string) {
  return code.slice(0, MAX_STORED_ERROR_LENGTH);
}

async function updateEmailFailure(
  admin: AdminClient,
  transcript: TranscriptRow,
  code: string,
  retryable = true,
) {
  const { error } = await admin
    .from("support_transcripts")
    .update({
      email_status: retryable ? "failed" : "permanent_failed",
      email_attempts: Math.min(100, transcript.email_attempts + 1),
      email_last_error: boundedError(code),
      email_provider_message_id: null,
      email_sent_at: null,
    })
    .eq("id", transcript.id);
  if (error) throw new ProcessingError("email_failure_state_update_failed");
}

function parseStoredEmailRequest(value: unknown): StoredEmailRequest | null {
  const request = asObject(value);
  if (!request || !Array.isArray(request.to) || request.to.length !== 1) {
    return null;
  }
  const from = boundedString(request.from, 500);
  const destination = normalizeVisitorEmail(request.to[0]);
  const subject = boundedString(request.subject, 998);
  const html = typeof request.html === "string" ? request.html : null;
  const text = typeof request.text === "string" ? request.text : null;
  const replyTo = request.reply_to === undefined
    ? undefined
    : normalizeVisitorEmail(request.reply_to) ?? undefined;
  if (
    !from ||
    /[\r\n]/.test(from) ||
    !destination ||
    !subject ||
    /[\r\n]/.test(subject) ||
    html === null ||
    text === null ||
    (request.reply_to !== undefined && !replyTo)
  ) return null;
  return {
    from,
    to: [destination],
    subject,
    html,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };
}

async function ensureEmailRequestSnapshot(
  admin: AdminClient,
  transcript: TranscriptRow,
  payload: TranscriptPayload,
  profile: SupportProfile,
) {
  const existing = parseStoredEmailRequest(transcript.email_request_payload);
  if (existing) return existing;

  const fromEmail = normalizeVisitorEmail(
    requiredEnv("TRANSACTIONAL_EMAIL_FROM_EMAIL"),
  );
  const rawFromName = requiredEnv("TRANSACTIONAL_EMAIL_FROM_NAME");
  const fromName = rawFromName.replace(/[\r\n<>]/g, " ").trim().slice(0, 100);
  const rawReplyTo = Deno.env.get("TRANSACTIONAL_EMAIL_REPLY_TO")?.trim();
  const replyTo = rawReplyTo ? normalizeVisitorEmail(rawReplyTo) : null;
  if (!fromEmail || !fromName || (rawReplyTo && !replyTo)) {
    throw new ProcessingError("invalid_transactional_email_configuration", 500);
  }
  const { copy, html, text } = formatTranscriptEmail(
    payload,
    profile,
    fromName,
  );
  const candidate: StoredEmailRequest = {
    from: `${fromName} <${fromEmail}>`,
    to: [profile.deliveryEmail],
    subject: copy.emailSubject,
    html,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  const { data, error } = await admin
    .from("support_transcripts")
    .update({ email_request_payload: candidate })
    .eq("id", transcript.id)
    .is("email_request_payload", null)
    .select("email_request_payload")
    .maybeSingle();
  if (error) throw new ProcessingError("email_request_snapshot_failed");

  let storedValue = asObject(data)?.email_request_payload;
  if (data === null) {
    const { data: racedData, error: racedError } = await admin
      .from("support_transcripts")
      .select("email_request_payload")
      .eq("id", transcript.id)
      .single();
    if (racedError) {
      throw new ProcessingError("email_request_snapshot_lookup_failed");
    }
    storedValue = asObject(racedData)?.email_request_payload;
  }

  const stored = parseStoredEmailRequest(storedValue);
  if (!stored) throw new ProcessingError("invalid_email_request_snapshot");
  transcript.email_request_payload = storedValue;
  return stored;
}

async function deliverEmail(
  admin: AdminClient,
  transcript: TranscriptRow,
  payload: TranscriptPayload,
  profile: SupportProfile,
) {
  if (
    transcript.email_status === "sent" ||
    transcript.email_status === "permanent_failed"
  ) return true;
  const apiKey = requiredEnv("RESEND_API_KEY");
  const emailRequest = await ensureEmailRequestSnapshot(
    admin,
    transcript,
    payload,
    profile,
  );

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `support-transcript/${transcript.id}`,
        "User-Agent": "Monalyz-Support/1.0",
      },
      body: JSON.stringify(emailRequest),
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
  } catch {
    await updateEmailFailure(admin, transcript, "resend_network_error");
    return false;
  }

  if (!response.ok) {
    const disposition = classifyDeliveryHttpStatus(response.status);
    await updateEmailFailure(
      admin,
      transcript,
      `resend_http_${response.status}`,
      disposition === "retryable_failure",
    );
    return disposition === "permanent_failure";
  }

  let providerMessageId: string | null = null;
  try {
    const responseBody = asObject(await response.json());
    providerMessageId = boundedString(responseBody?.id, 500);
  } catch {
    // A 2xx response is authoritative; the optional provider id is diagnostic.
  }

  const { error } = await admin
    .from("support_transcripts")
    .update({
      email_status: "sent",
      email_attempts: Math.min(100, transcript.email_attempts + 1),
      email_provider_message_id: providerMessageId,
      email_last_error: null,
      email_sent_at: new Date().toISOString(),
    })
    .eq("id", transcript.id);
  if (error) throw new ProcessingError("email_success_state_update_failed");
  return true;
}

function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "push.apple.com" || host.endsWith(".push.apple.com") ||
      host === "notify.windows.com" || host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  const unpadded = value.replace(/=+$/, "");
  const padded = unpadded.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (unpadded.length % 4)) % 4);
  try {
    return Uint8Array.from(
      atob(padded),
      (character) => character.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

function loadVapidConfig(): VapidConfig {
  const subject = requiredEnv("VAPID_SUBJECT");
  const publicKey = requiredEnv("VAPID_PUBLIC_KEY");
  const privateKey = requiredEnv("VAPID_PRIVATE_KEY");
  let subjectUrl: URL;
  try {
    subjectUrl = new URL(subject);
  } catch {
    throw new ProcessingError("invalid_env_vapid_subject", 500);
  }
  const decodedPublic = decodeBase64Url(publicKey);
  const decodedPrivate = decodeBase64Url(privateKey);
  const validSubject = !/[\r\n\u0000]/.test(subject) &&
    (subjectUrl.protocol === "https:"
      ? Boolean(
        subjectUrl.hostname && !subjectUrl.username && !subjectUrl.password,
      )
      : subjectUrl.protocol === "mailto:" &&
        /^[^\s@]+@[^\s@]+$/.test(subjectUrl.pathname));
  if (
    !validSubject ||
    decodedPublic?.byteLength !== 65 ||
    decodedPublic[0] !== 4 ||
    decodedPrivate?.byteLength !== 32
  ) {
    throw new ProcessingError("invalid_env_vapid_configuration", 500);
  }
  return { subject, publicKey, privateKey };
}

async function updatePushDelivery(
  admin: AdminClient,
  delivery: PushDeliveryRow,
  values: JsonObject,
) {
  const { error } = await admin
    .from("support_push_deliveries")
    .update({ attempts: Math.min(100, delivery.attempts + 1), ...values })
    .eq("id", delivery.id);
  if (error) throw new ProcessingError("push_delivery_state_update_failed");
}

async function deleteExpiredSubscription(
  admin: AdminClient,
  subscription: PushSubscriptionRow,
) {
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("id", subscription.id)
    .eq("user_id", subscription.user_id)
    .eq("endpoint_hash", subscription.endpoint_hash);
  if (error) throw new ProcessingError("expired_subscription_delete_failed");
}

async function deliverOnePush(
  admin: AdminClient,
  transcript: TranscriptRow,
  subscription: PushSubscriptionRow,
  delivery: PushDeliveryRow,
  payload: string,
  vapid: VapidConfig,
) {
  if (delivery.status === "sent") return true;
  if (
    !isAllowedPushEndpoint(subscription.endpoint) ||
    (subscription.expiration_time !== null &&
      subscription.expiration_time <= Date.now())
  ) {
    await updatePushDelivery(admin, delivery, {
      status: subscription.expiration_time !== null &&
          subscription.expiration_time <= Date.now()
        ? "expired"
        : "invalid",
      last_http_status: null,
      last_error: "invalid_or_expired_subscription",
      sent_at: null,
    });
    await deleteExpiredSubscription(admin, subscription);
    return true;
  }

  let requestDetails: ReturnType<typeof webPush.generateRequestDetails>;
  try {
    requestDetails = webPush.generateRequestDetails(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      },
      payload,
      {
        TTL: 86_400,
        urgency: "normal",
        topic: transcript.id.replaceAll("-", "").slice(0, 32),
        vapidDetails: {
          subject: vapid.subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
      },
    );
  } catch {
    await updatePushDelivery(admin, delivery, {
      status: "invalid",
      last_http_status: null,
      last_error: "web_push_request_generation_failed",
      sent_at: null,
    });
    await deleteExpiredSubscription(admin, subscription);
    return true;
  }

  let response: Response;
  try {
    response = await fetch(requestDetails.endpoint, {
      method: requestDetails.method,
      redirect: "error",
      headers: requestDetails.headers,
      body: requestDetails.body as BodyInit,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
  } catch {
    await updatePushDelivery(admin, delivery, {
      status: "failed",
      last_http_status: null,
      last_error: "web_push_network_error",
      sent_at: null,
    });
    return false;
  }

  if (response.ok) {
    const deliveredAt = new Date().toISOString();
    const [deliveryResult, subscriptionResult] = await Promise.all([
      admin
        .from("support_push_deliveries")
        .update({
          status: "sent",
          attempts: Math.min(100, delivery.attempts + 1),
          last_http_status: response.status,
          last_error: null,
          sent_at: deliveredAt,
        })
        .eq("id", delivery.id),
      admin
        .from("push_subscriptions")
        .update({
          last_success_at: deliveredAt,
          failure_count: 0,
          last_error: null,
        })
        .eq("id", subscription.id)
        .eq("user_id", subscription.user_id)
        .eq("endpoint_hash", subscription.endpoint_hash),
    ]);
    if (deliveryResult.error || subscriptionResult.error) {
      throw new ProcessingError("push_success_state_update_failed");
    }
    return true;
  }

  if (response.status === 404 || response.status === 410) {
    await updatePushDelivery(admin, delivery, {
      status: "expired",
      last_http_status: response.status,
      last_error: `web_push_http_${response.status}`,
      sent_at: null,
    });
    await deleteExpiredSubscription(admin, subscription);
    return true;
  }

  if (classifyDeliveryHttpStatus(response.status) === "permanent_failure") {
    await updatePushDelivery(admin, delivery, {
      status: "invalid",
      last_http_status: response.status,
      last_error: `web_push_http_${response.status}`,
      sent_at: null,
    });
    await deleteExpiredSubscription(admin, subscription);
    return true;
  }

  const [deliveryResult, subscriptionResult] = await Promise.all([
    admin
      .from("support_push_deliveries")
      .update({
        status: "failed",
        attempts: Math.min(100, delivery.attempts + 1),
        last_http_status: response.status,
        last_error: `web_push_http_${response.status}`,
        sent_at: null,
      })
      .eq("id", delivery.id),
    admin
      .from("push_subscriptions")
      .update({
        failure_count: Math.min(1_000_000, subscription.failure_count + 1),
        last_error: `web_push_http_${response.status}`,
      })
      .eq("id", subscription.id)
      .eq("user_id", subscription.user_id)
      .eq("endpoint_hash", subscription.endpoint_hash),
  ]);
  if (deliveryResult.error || subscriptionResult.error) {
    throw new ProcessingError("push_failure_state_update_failed");
  }
  return false;
}

async function deliverPushes(
  admin: AdminClient,
  transcript: TranscriptRow,
  profile: SupportProfile,
) {
  const { data: rawSubscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select(
      "id,user_id,endpoint,endpoint_hash,p256dh,auth_key,expiration_time,failure_count",
    )
    .eq("user_id", profile.userId);
  if (subscriptionsError) {
    throw new ProcessingError("push_subscriptions_lookup_failed");
  }

  const subscriptions = (rawSubscriptions ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) return true;
  const vapid = loadVapidConfig();

  const deliverySeeds = subscriptions.map((subscription) => ({
    transcript_id: transcript.id,
    subscription_id: subscription.id,
    endpoint_hash_snapshot: subscription.endpoint_hash,
  }));
  const { error: seedError } = await admin
    .from("support_push_deliveries")
    .upsert(deliverySeeds, {
      onConflict: "transcript_id,endpoint_hash_snapshot",
      ignoreDuplicates: true,
    });
  if (seedError) throw new ProcessingError("push_deliveries_seed_failed");

  const { data: rawDeliveries, error: deliveriesError } = await admin
    .from("support_push_deliveries")
    .select(
      "id,transcript_id,subscription_id,endpoint_hash_snapshot,status,attempts",
    )
    .eq("transcript_id", transcript.id)
    .in(
      "endpoint_hash_snapshot",
      subscriptions.map((row) => row.endpoint_hash),
    );
  if (deliveriesError) {
    throw new ProcessingError("push_deliveries_lookup_failed");
  }

  const deliveries = new Map(
    ((rawDeliveries ?? []) as PushDeliveryRow[]).map((row) => [
      row.endpoint_hash_snapshot,
      row,
    ]),
  );
  const copy = supportNotificationCopy(profile.preferredLanguage);
  const configuredUrl = Deno.env.get("SUPPORT_PUSH_URL")?.trim() ||
    "/myaccount";
  const url = configuredUrl.startsWith("/") && !configuredUrl.startsWith("//")
    ? configuredUrl
    : "/myaccount";
  const payload = JSON.stringify({
    title: copy.pushTitle,
    body: copy.pushBody,
    url,
    tag: `support-transcript-${transcript.id}`,
  });

  const results = await Promise.all(subscriptions.map((subscription) => {
    const delivery = deliveries.get(subscription.endpoint_hash);
    if (!delivery) throw new ProcessingError("push_delivery_missing");
    return deliverOnePush(
      admin,
      transcript,
      subscription,
      delivery,
      payload,
      vapid,
    );
  }));
  return results.every(Boolean);
}

type TranscriptDeliveryOutcome = "completed" | "retryable" | "busy";

async function deliverArchivedTranscript(
  admin: AdminClient,
  transcript: TranscriptRow,
  payload: TranscriptPayload,
): Promise<TranscriptDeliveryOutcome> {
  if (transcript.completed_at) return "completed";
  const claimToken = crypto.randomUUID();
  if (!await claimTranscript(admin, transcript.id, claimToken)) return "busy";

  let released = false;
  try {
    const profile = await ensureSupportProfileSnapshot(admin, transcript);
    const [emailResult, pushResult] = await Promise.allSettled([
      deliverEmail(admin, transcript, payload, profile),
      deliverPushes(admin, transcript, profile),
    ]);
    const emailTerminal = emailResult.status === "fulfilled" &&
      emailResult.value;
    const pushTerminal = pushResult.status === "fulfilled" && pushResult.value;
    const completed = areAllDeliveryChannelsTerminal(
      emailTerminal,
      pushTerminal,
    );
    await releaseTranscript(admin, transcript.id, claimToken, completed);
    released = true;
    return completed ? "completed" : "retryable";
  } catch (error) {
    if (!released) {
      try {
        await releaseTranscript(admin, transcript.id, claimToken, false);
      } catch {
        // The stale-claim timeout remains a final retry safety net.
      }
    }
    throw error;
  }
}

function constantTimeTokenEqual(expected: string, supplied: string | null) {
  const expectedBytes = textEncoder.encode(expected);
  const suppliedBytes = textEncoder.encode(supplied ?? "");
  let difference = expectedBytes.length ^ suppliedBytes.length;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ (suppliedBytes[index] ?? 0);
  }
  return difference === 0;
}

async function handleDurableRetry(request: Request) {
  const retrySecret = requiredEnv("SUPPORT_TRANSCRIPT_RETRY_SECRET");
  if (retrySecret.length < 32 || /[\r\n\u0000]/.test(retrySecret)) {
    throw new ProcessingError(
      "invalid_env_support_transcript_retry_secret",
      500,
    );
  }
  if (
    !constantTimeTokenEqual(
      retrySecret,
      request.headers.get("X-Support-Retry-Token"),
    )
  ) {
    return jsonResponse(401, "invalid_retry_credentials");
  }

  const requestedLimit = Number(
    new URL(request.url).searchParams.get("limit") ?? "3",
  );
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(5, Math.max(1, requestedLimit))
    : 3;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_transcripts")
    .select(transcriptColumns)
    .eq("identity_status", "resolved")
    .is("completed_at", null)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw new ProcessingError("retry_transcript_lookup_failed");

  const results = await Promise.all((data ?? []).map(async (rawTranscript) => {
    const transcript = rawTranscript as unknown as TranscriptRow;
    try {
      const payload = parsePayload(
        transcript.payload,
        transcript.tawk_property_id,
      );
      return await deliverArchivedTranscript(admin, transcript, payload);
    } catch {
      return "retryable" as const;
    }
  }));
  return jsonResponse(200, "retry_batch_processed", {
    selected: results.length,
    completed: results.filter((value) => value === "completed").length,
    retryable: results.filter((value) => value === "retryable").length,
    busy: results.filter((value) => value === "busy").length,
  });
}

function publicError(error: unknown) {
  if (error instanceof ProcessingError) return error;
  return new ProcessingError("unexpected_processing_error");
}

Deno.serve(async (request) => {
  let eventId = "unverified";
  let transcriptId: string | null = null;

  try {
    if (request.method !== "POST") {
      return jsonResponse(405, "method_not_allowed");
    }
    if (
      new URL(request.url).searchParams.get("mode") === "retry_incomplete"
    ) {
      return await handleDurableRetry(request);
    }
    const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return jsonResponse(413, "payload_too_large");
    }

    const rawBody = new Uint8Array(await request.arrayBuffer());
    if (rawBody.byteLength === 0 || rawBody.byteLength > MAX_BODY_BYTES) {
      return jsonResponse(413, "invalid_payload_size");
    }
    const signatureValid = await verifyTawkSignature(
      rawBody,
      request.headers.get("X-Tawk-Signature"),
      requiredEnv("TAWK_WEBHOOK_SECRET"),
    );
    if (!signatureValid) return jsonResponse(401, "invalid_signature");

    eventId = parseEventId(request);
    let rawBodyText: string;
    try {
      rawBodyText = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
    } catch {
      return jsonResponse(422, "invalid_utf8");
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawBodyText);
    } catch {
      return jsonResponse(422, "invalid_json");
    }
    const payload = parsePayload(
      parsedPayload,
      requiredEnv("TAWK_PROPERTY_ID"),
    );
    const rawBodySha256 = await sha256Hex(rawBody);
    const requestAdmin = createAdminClient();

    let transcript = await findTranscript(requestAdmin, eventId);
    if (transcript) {
      assertIdempotentMatch(
        transcript,
        rawBodySha256,
        payload.property.id,
        payload.chat.id,
      );
    } else {
      const identity = await resolveIdentity(
        requestAdmin,
        payload.chat.visitor.name,
        payload.chat.visitor.email,
      );
      transcript = await archiveTranscript(
        requestAdmin,
        eventId,
        payload,
        rawBodyText,
        rawBodySha256,
        identity,
      );
    }
    transcriptId = transcript.id;

    if (
      transcript.identity_status !== "resolved" || transcript.user_id === null
    ) {
      return jsonResponse(200, "transcript_archived_unresolved", {
        identity_status: transcript.identity_status,
      });
    }
    if (transcript.completed_at) {
      return jsonResponse(200, "transcript_already_delivered");
    }

    const deliveryOutcome = await deliverArchivedTranscript(
      requestAdmin,
      transcript,
      payload,
    );
    if (deliveryOutcome === "busy") {
      throw new ProcessingError("transcript_already_processing", 409);
    }
    if (deliveryOutcome === "retryable") {
      throw new ProcessingError("delivery_incomplete");
    }
    return jsonResponse(200, "transcript_delivered");
  } catch (unknownError) {
    const error = publicError(unknownError);
    console.error(JSON.stringify({
      scope: "tawk_transcript_webhook",
      event_id: eventId,
      transcript_id: transcriptId,
      error_code: error.code,
    }));
    return jsonResponse(error.status, error.code);
  }
});
