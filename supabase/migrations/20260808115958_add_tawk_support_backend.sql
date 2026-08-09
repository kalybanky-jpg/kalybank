-- Server-only support identity history. A signed marker in the tawk.to visitor
-- name supplies the Supabase UUID; this projection validates that it is still a
-- current Auth identity and preserves e-mail tombstones for audit/reuse safety.
create table public.support_user_identities (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately not a foreign key: a deleted user's UUID/e-mail mapping is a
  -- tombstone that prevents a recycled address from being attributed anew.
  user_id uuid not null,
  normalized_email text not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  constraint support_user_identities_email_check check (
    normalized_email = lower(btrim(normalized_email))
    and char_length(normalized_email) between 3 and 254
    and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  constraint support_user_identities_validity_check check (
    valid_to is null or valid_to >= valid_from
  )
);

create unique index support_user_identities_active_user_uidx
on public.support_user_identities (user_id)
where valid_to is null;

create unique index support_user_identities_active_email_uidx
on public.support_user_identities (normalized_email)
where valid_to is null;

create index support_user_identities_email_history_idx
on public.support_user_identities (normalized_email, valid_from desc);

create or replace function private.sync_support_user_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_new_email text := lower(btrim(coalesce(new.email, '')));
  changed_at timestamptz := statement_timestamp();
begin
  update public.support_user_identities
  set valid_to = greatest(changed_at, valid_from)
  where user_id = new.id
    and valid_to is null
    and normalized_email is distinct from normalized_new_email;

  if normalized_new_email = '' then
    return new;
  end if;

  if char_length(normalized_new_email) > 254
     or normalized_new_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
  then
    raise exception 'INVALID_SUPPORT_IDENTITY_EMAIL' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.support_user_identities
    where user_id = new.id
      and normalized_email = normalized_new_email
      and valid_to is null
  ) then
    insert into public.support_user_identities (
      user_id,
      normalized_email,
      valid_from
    )
    values (
      new.id,
      normalized_new_email,
      changed_at
    );
  end if;

  return new;
end;
$$;

insert into public.support_user_identities (
  user_id,
  normalized_email,
  valid_from
)
select
  users.id,
  lower(btrim(users.email)),
  coalesce(users.created_at, now())
from auth.users as users
where nullif(btrim(coalesce(users.email, '')), '') is not null
on conflict do nothing;

create trigger on_auth_user_support_identity_changed
after insert or update of email on auth.users
for each row execute function private.sync_support_user_identity();

create or replace function private.retire_support_user_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_user_identities
  set valid_to = greatest(statement_timestamp(), valid_from)
  where user_id = old.id
    and valid_to is null;

  return old;
end;
$$;

create trigger on_auth_user_support_identity_deleted
after delete on auth.users
for each row execute function private.retire_support_user_identity();

-- A subscription endpoint is a bearer capability. It is globally unique so a
-- browser shared by successive users can never remain attached to both users.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  endpoint text not null,
  endpoint_hash text not null,
  p256dh text not null,
  auth_key text not null,
  expiration_time bigint,
  user_agent text,
  last_success_at timestamptz,
  failure_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_check check (
    char_length(endpoint) between 20 and 2048
    and endpoint ~ '^https://'
  ),
  constraint push_subscriptions_endpoint_hash_check check (
    endpoint_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint push_subscriptions_p256dh_check check (
    char_length(p256dh) between 40 and 200
    and p256dh ~ '^[A-Za-z0-9_-]+={0,2}$'
  ),
  constraint push_subscriptions_auth_key_check check (
    char_length(auth_key) between 10 and 100
    and auth_key ~ '^[A-Za-z0-9_-]+={0,2}$'
  ),
  constraint push_subscriptions_expiration_check check (
    expiration_time is null or expiration_time > 0
  ),
  constraint push_subscriptions_user_agent_check check (
    user_agent is null or char_length(user_agent) <= 500
  ),
  constraint push_subscriptions_failure_count_check check (
    failure_count between 0 and 1000000
  ),
  constraint push_subscriptions_last_error_check check (
    last_error is null or char_length(last_error) <= 1000
  ),
  constraint push_subscriptions_endpoint_hash_key unique (endpoint_hash)
);

create index push_subscriptions_user_updated_idx
on public.push_subscriptions (user_id, updated_at desc);

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function private.set_updated_at();

create or replace function public.register_push_subscription(
  p_expected_user_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth_key text,
  p_expiration_time bigint default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  normalized_endpoint text := btrim(coalesce(p_endpoint, ''));
  normalized_p256dh text := btrim(coalesce(p_p256dh, ''));
  normalized_auth_key text := btrim(coalesce(p_auth_key, ''));
  normalized_user_agent text := nullif(btrim(coalesce(p_user_agent, '')), '');
  calculated_hash text;
  existing_subscription public.push_subscriptions;
  subscription_id uuid;
  subscription_count integer;
begin
  if p_expected_user_id is null or p_expected_user_id <> caller_id then
    raise exception 'PUSH_SUBSCRIPTION_ACCOUNT_CHANGED' using errcode = '42501';
  end if;

  if char_length(normalized_endpoint) not between 20 and 2048
     or (
       lower(normalized_endpoint) !~ '^https://fcm\.googleapis\.com(:443)?/'
       and lower(normalized_endpoint) !~ '^https://updates\.push\.services\.mozilla\.com(:443)?/'
       and lower(normalized_endpoint) !~ '^https://([a-z0-9-]+\.)*push\.apple\.com(:443)?/'
       and lower(normalized_endpoint) !~ '^https://([a-z0-9-]+\.)*notify\.windows\.com(:443)?/'
     )
  then
    raise exception 'INVALID_PUSH_ENDPOINT' using errcode = '22023';
  end if;

  if char_length(normalized_p256dh) not between 40 and 200
     or normalized_p256dh !~ '^[A-Za-z0-9_-]+={0,2}$'
     or char_length(normalized_auth_key) not between 10 and 100
     or normalized_auth_key !~ '^[A-Za-z0-9_-]+={0,2}$'
     or (p_expiration_time is not null and p_expiration_time <= 0)
     or (normalized_user_agent is not null and char_length(normalized_user_agent) > 500)
  then
    raise exception 'INVALID_PUSH_SUBSCRIPTION' using errcode = '22023';
  end if;

  calculated_hash := encode(
    extensions.digest(convert_to(normalized_endpoint, 'UTF8'), 'sha256'),
    'hex'
  );

  -- Serialize registration, rebind and device-limit checks for this user.
  -- Without this row lock two new endpoints could both observe count < 20.
  perform 1
  from public.profiles
  where user_id = caller_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select subscription.*
  into existing_subscription
  from public.push_subscriptions as subscription
  where subscription.endpoint_hash = calculated_hash
  for update;

  if found then
    if existing_subscription.endpoint is distinct from normalized_endpoint then
      raise exception 'PUSH_ENDPOINT_HASH_COLLISION' using errcode = '23505';
    end if;

    -- Rebinding a browser endpoint between successive authenticated users is
    -- allowed only when both browser-held subscription secrets still match.
    if existing_subscription.user_id <> caller_id
       and (
         existing_subscription.p256dh is distinct from normalized_p256dh
         or existing_subscription.auth_key is distinct from normalized_auth_key
       )
    then
      raise exception 'PUSH_SUBSCRIPTION_OWNERSHIP_MISMATCH' using errcode = '42501';
    end if;

    if existing_subscription.user_id <> caller_id then
      select count(*)
      into subscription_count
      from public.push_subscriptions
      where user_id = caller_id;

      if subscription_count >= 20 then
        raise exception 'PUSH_SUBSCRIPTION_LIMIT_REACHED' using errcode = '54000';
      end if;
    end if;

    update public.push_subscriptions
    set
      user_id = caller_id,
      p256dh = normalized_p256dh,
      auth_key = normalized_auth_key,
      expiration_time = p_expiration_time,
      user_agent = normalized_user_agent,
      last_success_at = case
        when existing_subscription.user_id = caller_id then last_success_at
        else null
      end,
      failure_count = 0,
      last_error = null
    where id = existing_subscription.id
    returning id into subscription_id;

    return subscription_id;
  end if;

  select count(*)
  into subscription_count
  from public.push_subscriptions
  where user_id = caller_id;

  if subscription_count >= 20 then
    raise exception 'PUSH_SUBSCRIPTION_LIMIT_REACHED' using errcode = '54000';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    endpoint_hash,
    p256dh,
    auth_key,
    expiration_time,
    user_agent
  )
  values (
    caller_id,
    normalized_endpoint,
    calculated_hash,
    normalized_p256dh,
    normalized_auth_key,
    p_expiration_time,
    normalized_user_agent
  )
  returning id into subscription_id;

  return subscription_id;
end;
$$;

create or replace function public.unregister_push_subscription(
  p_expected_user_id uuid,
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_endpoint text := btrim(coalesce(p_endpoint, ''));
  calculated_hash text;
  deleted_count integer;
begin
  if caller_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_expected_user_id is null or p_expected_user_id <> caller_id then
    raise exception 'PUSH_SUBSCRIPTION_ACCOUNT_CHANGED' using errcode = '42501';
  end if;

  if char_length(normalized_endpoint) not between 20 and 2048
     or normalized_endpoint !~ '^https://'
  then
    raise exception 'INVALID_PUSH_ENDPOINT' using errcode = '22023';
  end if;

  calculated_hash := encode(
    extensions.digest(convert_to(normalized_endpoint, 'UTF8'), 'sha256'),
    'hex'
  );

  delete from public.push_subscriptions
  where user_id = caller_id
    and endpoint_hash = calculated_hash
    and endpoint = normalized_endpoint;

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

create table public.support_transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  tawk_event_id text not null unique,
  tawk_property_id text not null,
  tawk_chat_id text not null,
  visitor_email_normalized text,
  identity_status text not null,
  identity_error text,
  notification_email text,
  notification_language text,
  notification_display_name text,
  event_at timestamptz not null,
  payload jsonb not null,
  raw_body text not null,
  raw_body_sha256 text not null,
  email_request_payload jsonb,
  email_status text not null default 'pending',
  email_attempts integer not null default 0,
  email_provider_message_id text,
  email_last_error text,
  email_sent_at timestamptz,
  processing_token uuid,
  processing_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_transcripts_event_id_check check (
    char_length(tawk_event_id) between 1 and 200
  ),
  constraint support_transcripts_property_id_check check (
    char_length(tawk_property_id) between 1 and 200
  ),
  constraint support_transcripts_chat_id_check check (
    char_length(tawk_chat_id) between 1 and 200
  ),
  constraint support_transcripts_visitor_email_check check (
    visitor_email_normalized is null
    or (
      visitor_email_normalized = lower(btrim(visitor_email_normalized))
      and char_length(visitor_email_normalized) between 3 and 254
    )
  ),
  constraint support_transcripts_identity_status_check check (
    identity_status in ('resolved', 'missing_email', 'not_found', 'ambiguous')
  ),
  constraint support_transcripts_identity_consistency_check check (
    (
      identity_status = 'resolved'
      and user_id is not null
    )
    or (
      identity_status <> 'resolved'
      and user_id is null
    )
  ),
  constraint support_transcripts_identity_error_check check (
    identity_error is null or char_length(identity_error) <= 1000
  ),
  constraint support_transcripts_notification_email_check check (
    notification_email is null
    or (
      notification_email = lower(btrim(notification_email))
      and char_length(notification_email) between 3 and 254
      and notification_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
    )
  ),
  constraint support_transcripts_notification_language_check check (
    notification_language is null
    or (
      notification_language = lower(btrim(notification_language))
      and char_length(notification_language) between 2 and 35
    )
  ),
  constraint support_transcripts_notification_name_check check (
    notification_display_name is null
    or char_length(notification_display_name) <= 200
  ),
  constraint support_transcripts_notification_snapshot_check check (
    (notification_email is null) = (notification_language is null)
    and (notification_email is not null or notification_display_name is null)
    and (identity_status = 'resolved' or notification_email is null)
  ),
  constraint support_transcripts_payload_check check (
    jsonb_typeof(payload) = 'object'
  ),
  constraint support_transcripts_raw_body_check check (
    octet_length(raw_body) between 2 and 5242880
  ),
  constraint support_transcripts_raw_hash_check check (
    raw_body_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint support_transcripts_raw_hash_key unique (raw_body_sha256),
  constraint support_transcripts_email_request_check check (
    email_request_payload is null
    or (
      identity_status = 'resolved'
      and notification_email is not null
      and jsonb_typeof(email_request_payload) = 'object'
    )
  ),
  constraint support_transcripts_email_status_check check (
    email_status in ('pending', 'failed', 'permanent_failed', 'sent', 'skipped')
  ),
  constraint support_transcripts_email_identity_check check (
    (email_status = 'skipped') = (identity_status <> 'resolved')
  ),
  constraint support_transcripts_email_attempts_check check (
    email_attempts between 0 and 100
  ),
  constraint support_transcripts_email_provider_id_check check (
    email_provider_message_id is null
    or char_length(email_provider_message_id) <= 500
  ),
  constraint support_transcripts_email_last_error_check check (
    email_last_error is null or char_length(email_last_error) <= 1000
  ),
  constraint support_transcripts_email_sent_check check (
    (email_status = 'sent') = (email_sent_at is not null)
  ),
  constraint support_transcripts_processing_check check (
    (processing_token is null) = (processing_started_at is null)
    and (identity_status = 'resolved' or processing_token is null)
  )
);

create index support_transcripts_user_created_idx
on public.support_transcripts (user_id, created_at desc);

create index support_transcripts_chat_idx
on public.support_transcripts (tawk_property_id, tawk_chat_id);

create index support_transcripts_incomplete_idx
on public.support_transcripts (updated_at)
where completed_at is null;

create trigger support_transcripts_set_updated_at
before update on public.support_transcripts
for each row execute function private.set_updated_at();

create table public.support_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null
    references public.support_transcripts(id) on delete cascade,
  subscription_id uuid
    references public.push_subscriptions(id) on delete set null,
  endpoint_hash_snapshot text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_http_status integer,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_push_deliveries_status_check check (
    status in ('pending', 'failed', 'sent', 'expired', 'invalid')
  ),
  constraint support_push_deliveries_attempts_check check (
    attempts between 0 and 100
  ),
  constraint support_push_deliveries_http_status_check check (
    last_http_status is null or last_http_status between 100 and 599
  ),
  constraint support_push_deliveries_last_error_check check (
    last_error is null or char_length(last_error) <= 1000
  ),
  constraint support_push_deliveries_endpoint_hash_check check (
    endpoint_hash_snapshot ~ '^[0-9a-f]{64}$'
  ),
  constraint support_push_deliveries_sent_check check (
    (status = 'sent') = (sent_at is not null)
  ),
  constraint support_push_deliveries_transcript_endpoint_key unique (
    transcript_id,
    endpoint_hash_snapshot
  )
);

create index support_push_deliveries_transcript_status_idx
on public.support_push_deliveries (transcript_id, status);

create index support_push_deliveries_subscription_idx
on public.support_push_deliveries (subscription_id)
where subscription_id is not null;

create trigger support_push_deliveries_set_updated_at
before update on public.support_push_deliveries
for each row execute function private.set_updated_at();

create or replace function public.claim_support_transcript(
  p_transcript_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_role text := coalesce((select auth.jwt() ->> 'role'), '');
  claimed_count integer;
begin
  if worker_role <> 'service_role' then
    raise exception 'SUPPORT_WORKER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_transcript_id is null or p_claim_token is null then
    raise exception 'INVALID_SUPPORT_TRANSCRIPT_CLAIM' using errcode = '22023';
  end if;

  update public.support_transcripts
  set
    processing_token = p_claim_token,
    processing_started_at = now()
  where id = p_transcript_id
    and completed_at is null
    and (
      processing_token is null
      or processing_started_at < now() - interval '5 minutes'
    );

  get diagnostics claimed_count = row_count;
  return claimed_count = 1;
end;
$$;

create or replace function public.release_support_transcript_claim(
  p_transcript_id uuid,
  p_claim_token uuid,
  p_completed boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_role text := coalesce((select auth.jwt() ->> 'role'), '');
  released_count integer;
begin
  if worker_role <> 'service_role' then
    raise exception 'SUPPORT_WORKER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  update public.support_transcripts
  set
    processing_token = null,
    processing_started_at = null,
    completed_at = case
      when coalesce(p_completed, false) then coalesce(completed_at, now())
      else completed_at
    end
  where id = p_transcript_id
    and processing_token = p_claim_token;

  get diagnostics released_count = row_count;
  return released_count = 1;
end;
$$;

alter table public.support_user_identities enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.support_transcripts enable row level security;
alter table public.support_push_deliveries enable row level security;

revoke all on table public.support_user_identities
from public, anon, authenticated;
revoke all on table public.push_subscriptions
from public, anon, authenticated;
revoke all on table public.support_transcripts
from public, anon, authenticated;
revoke all on table public.support_push_deliveries
from public, anon, authenticated;

grant select on table public.support_user_identities to service_role;
grant select, insert, update, delete
on table public.push_subscriptions to service_role;
grant select, insert, update, delete
on table public.support_transcripts to service_role;
grant select, insert, update, delete
on table public.support_push_deliveries to service_role;

revoke all on function private.sync_support_user_identity()
from public, anon, authenticated;
grant execute on function private.sync_support_user_identity()
to service_role;

revoke all on function private.retire_support_user_identity()
from public, anon, authenticated;
grant execute on function private.retire_support_user_identity()
to service_role;

revoke all on function public.register_push_subscription(
  uuid,
  text,
  text,
  text,
  bigint,
  text
)
from public, anon, authenticated;
grant execute on function public.register_push_subscription(
  uuid,
  text,
  text,
  text,
  bigint,
  text
)
to authenticated, service_role;

revoke all on function public.unregister_push_subscription(uuid, text)
from public, anon, authenticated;
grant execute on function public.unregister_push_subscription(uuid, text)
to authenticated, service_role;

revoke all on function public.claim_support_transcript(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.claim_support_transcript(uuid, uuid)
to service_role;

revoke all on function public.release_support_transcript_claim(
  uuid,
  uuid,
  boolean
)
from public, anon, authenticated;
grant execute on function public.release_support_transcript_claim(
  uuid,
  uuid,
  boolean
)
to service_role;

comment on table public.support_user_identities is
  'Server-only, versioned auth e-mail mapping for fail-closed tawk.to transcript correlation.';
comment on table public.push_subscriptions is
  'Server-managed Web Push subscriptions; one endpoint belongs to exactly one current user.';
comment on table public.support_transcripts is
  'Signed and idempotent tawk.to chat transcript archive.';
comment on table public.support_push_deliveries is
  'Per-device idempotent Web Push delivery state for support transcripts.';
