# tawk.to transcript webhook

Public Supabase Edge Function ingress for tawk.to's `chat:transcript_created`
webhook. Supabase JWT verification is intentionally disabled in
`supabase/config.toml`; authenticity is instead established from the raw request
bytes with tawk.to's `X-Tawk-Signature` HMAC-SHA1 signature.

## Secrets

Use `.env.example` as the list of project secrets. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are provided to deployed Edge Functions by Supabase.
Run `npm run support:keys` from the project root to generate the VAPID pair,
the identity/retry secrets, and a distinct `TAWK_WEBHOOK_SECRET`. Copy that last
value into the webhook configuration in the tawk.to dashboard.
Generate one VAPID key pair and keep its private key server-only. The public key
is separately exposed to authenticated clients by the application.
`TAWK_WEBHOOK_IDENTITY_SECRET` is a separate secret shared only by the Next.js
server identity route and this Edge Function; it must contain at least 32
characters and must not be exposed to the browser.

## Delivery and retry policy

- `X-Hook-Event-Id`, the raw-body SHA-256, and per-device delivery rows make
  retries idempotent. Resend receives a stable idempotency key per transcript.
- The server-generated tawk visitor name ends with
  `[mz1:<supabase-uuid>:<hmac-sha256-128-bit-hex>]`. The Edge Function verifies
  this suffix with `TAWK_WEBHOOK_IDENTITY_SECRET` and resolves only that UUID. A
  missing, invalid, or unknown marker is archived with the exact UTF-8 body,
  returns 2xx, and never triggers a notification. Visitor e-mail is retained
  only for consistency/audit and is never an identity fallback.
- Transient database, Resend, or Push API failures return a non-2xx response so
  tawk.to retries. Expired Push subscriptions (404/410) are deleted and treated
  as terminal for that device.
- Resend and Web Push are independent channels. HTTP 408, 429, and 5xx remain
  retryable; other 4xx responses are persisted as terminal failures. A permanent
  failure on one channel never prevents the other channel.
- Notification destination is the user's current server-side Auth identity,
  while display name and language come from `profiles` (active back-office staff
  use the application's French fallback). The resolved notification profile and
  exact Resend request are snapshotted before delivery so a retry cannot reuse
  an idempotency key with different parameters.

## Durable retry schedule

The same Edge Function exposes an internal, authenticated batch mode:

```text
POST /functions/v1/tawk-transcript-webhook?mode=retry_incomplete&limit=3
X-Support-Retry-Token: <SUPPORT_TRANSCRIPT_RETRY_SECRET>
```

Schedule this request (for example every five minutes with Supabase Cron). Keep
the token in Supabase Vault and inject it into the request header; never embed
it in a migration, committed cron SQL, or browser bundle. The endpoint claims at
most five incomplete transcripts per invocation and is safe to overlap with
tawk.to retries because both paths use the same database claim and per-channel
idempotency state.

## Localisation

Server notification copy lives in `../_shared/support-i18n.ts`. Add a complete
catalog entry there when the application's supported-language list grows;
unknown and region-qualified values use the existing French fallback.

The visitor interface uses one dedicated tawk.to widget for each Monalyz
language (`fr`, `en`, `de`, and `es`). Configure the language and every
Online/Away/Offline and Pre-Chat content block in the tawk.to dashboard for each
widget. The Next.js server rejects an incomplete or shared locale mapping rather
than silently displaying the wrong language.

## Back-office archive

Completed conversations are available to administrators in Monalyz through the
server-only `/api/admin/support-conversations` projection. The browser never
receives `raw_body`, delivery metadata, or the signed identity marker. The view
is an archive, not a live agent console: tawk.to emits
`chat:transcript_created` only after the conversation ends, and existing tawk.to
history is not backfilled automatically.
