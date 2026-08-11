-- Guarded, resumable and trace-free customer erasure.
-- Storage objects are deliberately not touched here: Supabase Storage must be
-- cleaned through its API before the relational phase is allowed to start.

create table private.client_purge_operations (
  challenge_id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_user_id uuid not null,
  challenge_digest text not null
    check (challenge_digest ~ '^[0-9a-f]{64}$'),
  target_email_digest text not null
    check (target_email_digest ~ '^[0-9a-f]{64}$'),
  target_email text not null
    check (
      char_length(target_email) between 3 and 254
      and target_email = btrim(target_email)
    ),
  idempotency_key uuid not null unique,
  status text not null default 'preview'
    check (status in ('preview', 'running', 'failed', 'waiting_sweep')),
  stage text not null default 'preview'
    check (
      stage in (
        'preview',
        'storage',
        'database',
        'waiting_sweep',
        'storage_sweep',
        'auth',
        'verify'
      )
    ),
  support_email_manifest jsonb not null default '[]'::jsonb
    check (jsonb_typeof(support_email_manifest) = 'array'),
  scope_digest text
    check (scope_digest is null or scope_digest ~ '^[0-9a-f]{64}$'),
  storage_cycle_stage text
    check (storage_cycle_stage in ('preview', 'storage', 'storage_sweep', 'verify')),
  storage_phase text not null default 'idle'
    check (
      storage_phase in (
        'idle', 'references', 'scan', 'delete', 'verify_manifest',
        'verify_prefix', 'complete'
      )
    ),
  reference_after_bucket text,
  reference_after_object_path text,
  reference_claim_token uuid,
  reference_claimed_at timestamptz,
  verify_prefix_index integer not null default 0
    check (verify_prefix_index between 0 and 4),
  prefix_claim_token uuid,
  prefix_claimed_at timestamptz,
  ignored_unsafe_storage_references bigint not null default 0
    check (ignored_unsafe_storage_references >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  sweep_not_before timestamptz,
  retry_after timestamptz,
  last_error_code text
    check (last_error_code is null or char_length(last_error_code) <= 100),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (expires_at > created_at),
  check ((status = 'preview') = (consumed_at is null)),
  check (
    (reference_after_bucket is null) = (reference_after_object_path is null)
  ),
  check ((reference_claim_token is null) = (reference_claimed_at is null)),
  check ((prefix_claim_token is null) = (prefix_claimed_at is null)),
  check (
    sweep_not_before is null
    or stage in ('waiting_sweep', 'storage_sweep', 'auth', 'verify')
  )
);

comment on table private.client_purge_operations is
  'Ephemeral private state for one-use erasure challenges and resumable failures. Deleted after success.';

create index client_purge_operations_retry_idx
on private.client_purge_operations (retry_after, updated_at)
where status in ('running', 'failed', 'waiting_sweep');

create unique index client_purge_operations_target_uidx
on private.client_purge_operations (target_user_id);

revoke all on table private.client_purge_operations
from public, anon, authenticated, service_role;

create table private.client_purge_storage_manifest (
  challenge_id uuid not null
    references private.client_purge_operations(challenge_id) on delete cascade,
  bucket text not null
    check (
      bucket in (
        'upload-staging',
        'kyc-evidence',
        'loan-evidence',
        'external-execution-evidence',
        'official-documents'
      )
    ),
  object_path text not null
    check (char_length(object_path) between 1 and 500),
  ownership_scope text not null
    check (ownership_scope in ('target_prefix', 'relational')),
  processing_status text not null default 'pending'
    check (
      processing_status in (
        'pending', 'delete_claimed', 'deleted', 'verify_claimed', 'verified'
      )
    ),
  claim_token uuid,
  claimed_at timestamptz,
  deleted_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (
    (ownership_scope = 'relational')
    = (bucket = 'external-execution-evidence')
  ),
  check (
    (processing_status in ('delete_claimed', 'verify_claimed'))
    = (claim_token is not null and claimed_at is not null)
  ),
  primary key (challenge_id, bucket, object_path)
);

create index client_purge_storage_manifest_work_idx
on private.client_purge_storage_manifest (
  challenge_id, processing_status, bucket, object_path
);

create index client_purge_storage_manifest_expired_claim_idx
on private.client_purge_storage_manifest (
  challenge_id, processing_status, claimed_at
)
where processing_status in ('delete_claimed', 'verify_claimed');

create index client_purge_storage_manifest_relational_path_idx
on private.client_purge_storage_manifest (bucket, object_path, challenge_id)
where ownership_scope = 'relational';

create index if not exists external_transfer_execution_evidence_path_idx
on public.external_transfer_executions (evidence_object_path);

create index if not exists external_loan_funding_evidence_path_idx
on public.external_loan_fundings (evidence_object_path);

comment on table private.client_purge_storage_manifest is
  'Normalized, page-written Storage inventory retained only until guarded erasure succeeds.';

revoke all on table private.client_purge_storage_manifest
from public, anon, authenticated, service_role;

create table private.client_purge_storage_scan_queue (
  id bigint generated always as identity primary key,
  challenge_id uuid not null
    references private.client_purge_operations(challenge_id) on delete cascade,
  cycle_stage text not null
    check (cycle_stage in ('preview', 'storage', 'storage_sweep', 'verify')),
  bucket text not null
    check (bucket in ('upload-staging', 'kyc-evidence', 'loan-evidence', 'official-documents')),
  prefix text not null check (char_length(prefix) between 1 and 500),
  next_offset integer not null default 0 check (next_offset >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'done')),
  claim_token uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check ((status = 'claimed') = (claim_token is not null and claimed_at is not null)),
  unique (challenge_id, cycle_stage, bucket, prefix)
);

create index client_purge_storage_scan_queue_claim_idx
on private.client_purge_storage_scan_queue (challenge_id, cycle_stage, status, id);

revoke all on table private.client_purge_storage_scan_queue
from public, anon, authenticated, service_role;

create table private.client_purge_entity_manifest (
  challenge_id uuid not null
    references private.client_purge_operations(challenge_id) on delete cascade,
  entity_type text not null,
  entity_id text not null check (char_length(entity_id) between 1 and 100),
  primary key (challenge_id, entity_type, entity_id)
);

revoke all on table private.client_purge_entity_manifest
from public, anon, authenticated, service_role;

create or replace function private.require_active_purge_admin(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or not exists (
    select 1
    from public.staff_members as staff
    join auth.users as users on users.id = staff.user_id
    where staff.user_id = p_actor_id
      and staff.role = 'admin'
      and staff.active
  ) then
    raise exception 'ACTIVE_ADMIN_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function private.require_active_purge_admin(uuid)
from public, anon, authenticated, service_role;

-- Server-side identity, notification, document and support paths need a
-- read-only view of profiles, while purge authorization must classify every
-- staff row (including inactive staff). Keep both tables unavailable for any
-- service-role mutation: privileged writes remain confined to audited RPCs.
revoke all on table public.profiles, public.staff_members from service_role;
grant select on table public.profiles, public.staff_members to service_role;

create or replace function private.is_client_storage_path(
  p_path text,
  p_owner_id uuid
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select char_length(p_path) between 1 and 500
    and p_path = btrim(p_path)
    and p_path not like '/%'
    and pg_catalog.strpos(p_path, pg_catalog.chr(92)) = 0
    and p_path !~ '(^|/)\.\.?(/|$)'
    and p_path like p_owner_id::text || '/%';
$$;

create or replace function private.is_client_storage_object_key(
  p_path text,
  p_owner_id uuid
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select char_length(p_path) between 1 and 500
    and p_path not like '/%'
    and p_path !~ '(^|/)\.\.?(/|$)'
    and p_path like p_owner_id::text || '/%';
$$;

create or replace function private.client_purge_storage_references(
  p_target_user_id uuid
)
returns table (
  bucket text,
  object_path text,
  ownership_scope text,
  ownership_valid boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with external_references as (
    select
      'external-execution-evidence'::text as bucket,
      execution.evidence_object_path as object_path,
      execution.executed_by,
      transfer.owner_id
    from public.external_transfer_executions execution
    join public.transfer_intents transfer on transfer.id = execution.transfer_id
    union all
    select
      'external-execution-evidence'::text,
      funding.evidence_object_path,
      funding.executed_by,
      loan.owner_id
    from public.external_loan_fundings funding
    join public.loan_applications loan on loan.id = funding.loan_id
  ),
  storage_references as (
    select 'kyc-evidence'::text as bucket, value as object_path,
      'target_prefix'::text as ownership_scope
    from public.kyc_applications kyc,
      lateral jsonb_each_text(kyc.document_object_paths)
    where kyc.owner_id = p_target_user_id
    union all
    select 'kyc-evidence'::text, value, 'target_prefix'::text
    from public.kyc_drafts draft,
      lateral jsonb_each_text(draft.document_object_paths)
    where draft.owner_id = p_target_user_id
    union all
    select 'loan-evidence'::text, jsonb_array_elements_text(loan.document_object_paths),
      'target_prefix'::text
    from public.loan_applications loan
    where loan.owner_id = p_target_user_id
    union all
    select external.bucket, external.object_path, 'relational'::text
    from external_references external
    where external.owner_id = p_target_user_id
    union all
    select 'official-documents'::text, document.storage_path, 'target_prefix'::text
    from public.official_documents document
    where document.owner_id = p_target_user_id and document.storage_path is not null
  )
  select distinct
    reference.bucket,
    reference.object_path,
    reference.ownership_scope,
    case
      when reference.ownership_scope = 'target_prefix' then
        private.is_client_storage_path(reference.object_path, p_target_user_id)
      else exists (
        select 1
        from external_references matching
        where matching.owner_id = p_target_user_id
          and matching.object_path = reference.object_path
          and private.is_client_storage_object_key(
            matching.object_path,
            matching.executed_by
          )
      ) and not exists (
        select 1
        from external_references foreign_reference
        where foreign_reference.object_path = reference.object_path
          and foreign_reference.owner_id is distinct from p_target_user_id
      )
    end as ownership_valid
  from storage_references reference
  where reference.object_path is not null and btrim(reference.object_path) <> '';
$$;

create or replace function private.new_document_paths_are_owned(
  p_owner_id uuid,
  p_new_paths jsonb,
  p_old_paths jsonb default null
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  items jsonb;
  old_contains_item boolean;
begin
  if p_owner_id is null
     or jsonb_typeof(p_new_paths) not in ('object', 'array') then
    return false;
  end if;

  if jsonb_typeof(p_new_paths) = 'object' then
    select coalesce(jsonb_agg(value), '[]'::jsonb)
    into items from jsonb_each(p_new_paths);
  else
    items := p_new_paths;
  end if;

  for item in select value from jsonb_array_elements(items)
  loop
    if jsonb_typeof(item) is distinct from 'string' then
      return false;
    end if;
    if private.is_client_storage_path(item #>> '{}', p_owner_id) then
      continue;
    end if;

    old_contains_item := false;
    if jsonb_typeof(p_old_paths) = 'object' then
      select exists (select 1 from jsonb_each(p_old_paths) old where old.value = item)
      into old_contains_item;
    elsif jsonb_typeof(p_old_paths) = 'array' then
      select exists (
        select 1 from jsonb_array_elements(p_old_paths) old where old.value = item
      ) into old_contains_item;
    end if;
    if not old_contains_item then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function private.enforce_client_document_path_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  historical_paths jsonb := null;
begin
  if exists (
    select 1 from private.client_purge_operations operation
    where operation.target_user_id = new.owner_id
      and operation.consumed_at is not null
  ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and new.owner_id = old.owner_id then
    historical_paths := old.document_object_paths;
  end if;
  if not private.new_document_paths_are_owned(
    new.owner_id,
    new.document_object_paths,
    historical_paths
  ) then
    raise exception 'DOCUMENT_PATH_OWNER_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger kyc_applications_enforce_document_path_owner
before insert or update of owner_id, document_object_paths
on public.kyc_applications
for each row execute function private.enforce_client_document_path_ownership();

create trigger kyc_drafts_enforce_document_path_owner
before insert or update of owner_id, document_object_paths
on public.kyc_drafts
for each row execute function private.enforce_client_document_path_ownership();

create trigger loan_applications_enforce_document_path_owner
before insert or update of owner_id, document_object_paths
on public.loan_applications
for each row execute function private.enforce_client_document_path_ownership();

create or replace function private.enforce_external_evidence_path_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner_id uuid;
begin
  if tg_op = 'UPDATE'
     and new.executed_by = old.executed_by
     and new.evidence_object_path = old.evidence_object_path then
    return new;
  end if;
  if tg_table_name = 'external_transfer_executions' then
    select transfer.owner_id into target_owner_id
    from public.transfer_intents transfer
    where transfer.id = (to_jsonb(new) ->> 'transfer_id')::uuid;
  else
    select loan.owner_id into target_owner_id
    from public.loan_applications loan
    where loan.id = (to_jsonb(new) ->> 'loan_id')::uuid;
  end if;
  if exists (
    select 1 from private.client_purge_operations operation
    where operation.target_user_id = target_owner_id
      and operation.consumed_at is not null
  ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if not private.is_client_storage_path(
    new.evidence_object_path,
    new.executed_by
  ) then
    raise exception 'EVIDENCE_PATH_OWNER_MISMATCH' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.evidence_object_path, 847232)
  );
  if exists (
    select 1 from public.external_transfer_executions execution
    where execution.evidence_object_path = new.evidence_object_path
      and (tg_table_name <> 'external_transfer_executions'
        or execution.transfer_id is distinct from
          (to_jsonb(new) ->> 'transfer_id')::uuid)
  ) or exists (
    select 1 from public.external_loan_fundings funding
    where funding.evidence_object_path = new.evidence_object_path
      and (tg_table_name <> 'external_loan_fundings'
        or funding.loan_id is distinct from (to_jsonb(new) ->> 'loan_id')::uuid)
  ) then
    raise exception 'EVIDENCE_PATH_ALREADY_REFERENCED' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger external_transfer_evidence_enforce_path_owner
before insert or update of executed_by, evidence_object_path
on public.external_transfer_executions
for each row execute function private.enforce_external_evidence_path_ownership();

create trigger external_loan_evidence_enforce_path_owner
before insert or update of executed_by, evidence_object_path
on public.external_loan_fundings
for each row execute function private.enforce_external_evidence_path_ownership();

create or replace function private.enforce_official_document_path_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from private.client_purge_operations operation
    where operation.target_user_id = new.owner_id
      and operation.consumed_at is not null
  ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if new.storage_path is null
     or (
       tg_op = 'UPDATE'
       and new.owner_id = old.owner_id
       and new.storage_path is not distinct from old.storage_path
     ) then
    return new;
  end if;
  if not private.is_client_storage_path(new.storage_path, new.owner_id) then
    raise exception 'DOCUMENT_PATH_OWNER_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger official_documents_enforce_storage_path_owner
before insert or update of owner_id, storage_path
on public.official_documents
for each row execute function private.enforce_official_document_path_ownership();

create or replace function private.freeze_profile_during_client_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from private.client_purge_operations operation
    where operation.target_user_id = new.user_id
      and operation.consumed_at is not null
  ) then
    new.access_status := 'frozen';
    new.access_status_reason := 'Suppression administrative sécurisée en cours.';
  end if;
  return new;
end;
$$;

create trigger profiles_freeze_during_client_purge
before insert or update of access_status
on public.profiles
for each row execute function private.freeze_profile_during_client_purge();

revoke execute on function private.is_client_storage_path(text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.is_client_storage_object_key(text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.client_purge_storage_references(uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.new_document_paths_are_owned(uuid, jsonb, jsonb)
from public, anon, authenticated, service_role;
revoke execute on function private.enforce_client_document_path_ownership()
from public, anon, authenticated, service_role;
revoke execute on function private.enforce_external_evidence_path_ownership()
from public, anon, authenticated, service_role;
revoke execute on function private.enforce_official_document_path_ownership()
from public, anon, authenticated, service_role;
revoke execute on function private.freeze_profile_during_client_purge()
from public, anon, authenticated, service_role;

create or replace function public.admin_list_client_purge_candidates(
  p_actor_id uuid,
  p_search text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  access_status text,
  created_at timestamptz,
  kyc_status text,
  account_count bigint,
  loan_count bigint,
  transfer_count bigint,
  document_count bigint,
  purge_status text,
  purge_stage text,
  purge_sweep_not_before timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_search text := btrim(coalesce(p_search, ''));
begin
  perform private.require_active_purge_admin(p_actor_id);

  if p_limit is null or p_offset is null
     or p_limit not between 1 and 50 or p_offset not between 0 and 100000
     or char_length(normalized_search) > 100 then
    raise exception 'INVALID_CLIENT_PAGE' using errcode = '22023';
  end if;

  return query
  select
    users.id,
    users.email::text,
    coalesce(
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
      split_part(users.email, '@', 1)
    )::text,
    coalesce(profile.access_status, 'missing')::text,
    users.created_at,
    latest_kyc.status::text,
    (select count(*) from public.financial_positions fp where fp.owner_id = users.id),
    (select count(*) from public.loan_applications loan where loan.owner_id = users.id),
    (select count(*) from public.transfer_intents transfer where transfer.owner_id = users.id),
    (select count(*) from public.official_documents document where document.owner_id = users.id),
    purge.status::text,
    purge.stage::text,
    purge.sweep_not_before,
    count(*) over ()
  from auth.users as users
  left join public.profiles as profile on profile.user_id = users.id
  left join lateral (
    select application.status
    from public.kyc_applications as application
    where application.owner_id = users.id
    order by application.submitted_at desc
    limit 1
  ) as latest_kyc on true
  left join lateral (
    select operation.status, operation.stage, operation.sweep_not_before
    from private.client_purge_operations operation
    where operation.target_user_id = users.id
    limit 1
  ) as purge on true
  where not exists (
    select 1 from public.staff_members staff where staff.user_id = users.id
  )
    and nullif(btrim(coalesce(users.email, '')), '') is not null
    and (
      normalized_search = ''
      or coalesce(profile.display_name, '') ilike '%' || normalized_search || '%'
      or users.email ilike '%' || normalized_search || '%'
    )
  order by users.created_at desc, users.id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_prepare_client_purge(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_digest text,
  p_target_email_digest text,
  p_target_email text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge_id uuid := gen_random_uuid();
  expiration timestamptz := statement_timestamp() + interval '5 minutes';
  existing_preview private.client_purge_operations;
  impact jsonb;
  storage_references bigint;
  unsafe_storage_references bigint;
  canonical_target_email text;
  support_emails text[];
  current_scope_digest text;
  previous_scope_digest text;
begin
  perform private.require_active_purge_admin(p_actor_id);

  if p_target_user_id is null or p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  select users.email into canonical_target_email
  from auth.users users where users.id = p_target_user_id;
  if not found or canonical_target_email is null then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_challenge_digest is null
     or p_target_email_digest is null
     or p_target_email is null
     or p_challenge_digest !~ '^[0-9a-f]{64}$'
     or p_target_email_digest !~ '^[0-9a-f]{64}$'
     or p_target_email is distinct from canonical_target_email
     or encode(
       extensions.digest(convert_to(p_target_email, 'UTF8'), 'sha256'), 'hex'
     ) is distinct from p_target_email_digest
     or p_idempotency_key is null then
    raise exception 'INVALID_PURGE_CHALLENGE' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_target_user_id::text, 847231)
  );

  select * into existing_preview
  from private.client_purge_operations
  where target_user_id = p_target_user_id
  for update;

  if found and existing_preview.consumed_at is not null then
    raise exception 'PURGE_ALREADY_STARTED' using errcode = '55000';
  end if;

  if found and existing_preview.status = 'preview'
     and existing_preview.expires_at > statement_timestamp() then
    if existing_preview.actor_id = p_actor_id
       and existing_preview.idempotency_key = p_idempotency_key
       and existing_preview.challenge_digest = p_challenge_digest
       and existing_preview.target_email_digest = p_target_email_digest
       and existing_preview.target_email = p_target_email then
      -- Exact retries and lost responses retain the same durable scan cursor.
      v_challenge_id := existing_preview.challenge_id;
      expiration := existing_preview.expires_at;
    else
      raise exception 'PURGE_PREVIEW_EXISTS' using errcode = '55000';
    end if;
  else
    -- Only an expired unconsumed preview may be atomically rotated.
    delete from private.client_purge_operations
    where target_user_id = p_target_user_id
      and status = 'preview'
      and expires_at <= statement_timestamp();

    insert into private.client_purge_operations (
      challenge_id,
      actor_id,
      target_user_id,
      challenge_digest,
      target_email_digest,
      target_email,
      idempotency_key,
      expires_at,
      storage_cycle_stage,
      storage_phase
    ) values (
      v_challenge_id,
      p_actor_id,
      p_target_user_id,
      p_challenge_digest,
      p_target_email_digest,
      p_target_email,
      p_idempotency_key,
      expiration,
      'preview',
      'references'
    );
  end if;

  perform private.refresh_client_purge_entity_manifest(
    v_challenge_id, p_target_user_id
  );

  select
    count(*) filter (where reference.ownership_valid is true),
    count(*) filter (where reference.ownership_valid is not true)
  into storage_references, unsafe_storage_references
  from private.client_purge_storage_references(p_target_user_id) reference;

  canonical_target_email := lower(btrim(canonical_target_email));
  select coalesce(array_agg(email order by email), array[]::text[])
  into support_emails
  from (
    select candidate.email
    from (
      select identity.normalized_email as email
      from public.support_user_identities identity
      where identity.user_id = p_target_user_id
      union
      select canonical_target_email where canonical_target_email is not null
    ) candidate
    where not exists (
      select 1
      from public.support_user_identities active_identity
      where active_identity.normalized_email = candidate.email
        and active_identity.valid_to is null
        and active_identity.user_id <> p_target_user_id
    )
  ) unambiguous_emails;

  current_scope_digest := private.client_purge_scope_digest(
    v_challenge_id, p_target_user_id, to_jsonb(support_emails)
  );
  select operation.scope_digest into previous_scope_digest
  from private.client_purge_operations operation
  where operation.challenge_id = v_challenge_id;

  if previous_scope_digest is not null
     and previous_scope_digest is distinct from current_scope_digest then
    -- A recovered preview must restart its bounded Storage inventory when the
    -- confirmed relational scope changed. This makes a fresh preview the only
    -- way to consume the challenge after PURGE_PREVIEW_STALE.
    delete from private.client_purge_storage_scan_queue queue
    where queue.challenge_id = v_challenge_id;
    delete from private.client_purge_storage_manifest manifest
    where manifest.challenge_id = v_challenge_id;
    update private.client_purge_operations operation
    set storage_cycle_stage = null,
        storage_phase = 'idle',
        reference_after_bucket = null,
        reference_after_object_path = null,
        reference_claim_token = null,
        reference_claimed_at = null,
        verify_prefix_index = 0,
        prefix_claim_token = null,
        prefix_claimed_at = null,
        ignored_unsafe_storage_references = 0
    where operation.challenge_id = v_challenge_id;
  end if;

  update private.client_purge_operations operation
  set support_email_manifest = to_jsonb(support_emails),
      scope_digest = current_scope_digest,
      updated_at = statement_timestamp()
  where operation.idempotency_key = p_idempotency_key
    and operation.actor_id = p_actor_id
    and operation.target_user_id = p_target_user_id
    and operation.consumed_at is null;

  impact := jsonb_build_object(
    'preservedAdmins', (
      select count(*)
      from public.staff_members staff
      join auth.users users on users.id = staff.user_id
      where staff.role = 'admin'
    ),
    'kycApplications', (select count(*) from public.kyc_applications where owner_id = p_target_user_id),
    'kycDrafts', (select count(*) from public.kyc_drafts where owner_id = p_target_user_id),
    'accounts', (select count(*) from public.financial_positions where owner_id = p_target_user_id),
    'ledgerEntries', (select count(*) from public.financial_ledger_entries where owner_id = p_target_user_id),
    'loans', (select count(*) from public.loan_applications where owner_id = p_target_user_id),
    'transfers', (select count(*) from public.transfer_intents where owner_id = p_target_user_id),
    'documents', (select count(*) from public.official_documents where owner_id = p_target_user_id),
    'notifications', (select count(*) from public.notifications where recipient_id = p_target_user_id),
    'emailOutbox', (
      select count(*) from public.transactional_email_outbox
      where recipient_id = p_target_user_id or claimed_by = p_target_user_id
    ),
    'pushSubscriptions', (select count(*) from public.push_subscriptions where user_id = p_target_user_id),
    'supportIdentities', (select count(*) from public.support_user_identities where user_id = p_target_user_id),
    'supportTranscripts', (
      select count(*) from public.support_transcripts transcript
      where transcript.user_id = p_target_user_id
         or (
           transcript.user_id is null
           and (
             transcript.visitor_email_normalized = any(support_emails)
             or transcript.notification_email = any(support_emails)
           )
           and not exists (
             select 1 from public.support_user_identities active_identity
             where active_identity.valid_to is null
               and active_identity.user_id <> p_target_user_id
               and active_identity.normalized_email in (
                 transcript.visitor_email_normalized,
                 transcript.notification_email
               )
           )
         )
    ),
    'auditEvents', (
      select count(*) from public.audit_events event
      where private.audit_event_matches_client(
        event.actor_id, event.entity_type, event.entity_id, event.metadata,
        p_target_user_id, v_challenge_id
      )
    ),
    'workflowEvents', (
      (select count(*) from public.kyc_events event
        where event.actor_id = p_target_user_id
          or event.kyc_id in (
            select id from public.kyc_applications where owner_id = p_target_user_id
          ))
      + (select count(*) from public.loan_events event
        where event.actor_id = p_target_user_id
          or event.loan_id in (
            select id from public.loan_applications where owner_id = p_target_user_id
          ))
      + (select count(*) from public.transfer_events event
        where event.actor_id = p_target_user_id
          or event.transfer_id in (
            select id from public.transfer_intents where owner_id = p_target_user_id
          ))
    ),
    'externalExecutions', (
      (select count(*) from public.external_transfer_executions execution
        join public.transfer_intents transfer on transfer.id = execution.transfer_id
        where transfer.owner_id = p_target_user_id)
      + (select count(*) from public.external_loan_fundings funding
        join public.loan_applications loan on loan.id = funding.loan_id
        where loan.owner_id = p_target_user_id)
    ),
    'profileRecords', (select count(*) from public.profiles where user_id = p_target_user_id),
    'authRecords', 1,
    'storageReferences', storage_references,
    'unsafeStorageReferences', unsafe_storage_references,
    'storageObjects', (
      select count(*) from private.client_purge_storage_manifest manifest
      where manifest.challenge_id = v_challenge_id
    )
  );

  return jsonb_build_object(
    'challengeId', v_challenge_id,
    'expiresAt', expiration,
    'inventoryComplete', (
      select operation.storage_phase = 'complete'
      from private.client_purge_operations operation
      where operation.challenge_id = v_challenge_id
    ),
    'impact', impact
  );
end;
$$;

create or replace function public.admin_begin_client_purge(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid,
  p_challenge_digest text,
  p_target_email_digest text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  frozen_profile_count integer;
  current_target_email text;
  support_emails text[];
  current_scope_digest text;
  evidence_path text;
begin
  perform private.require_active_purge_admin(p_actor_id);

  if p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into operation
  from private.client_purge_operations
  where challenge_id = p_challenge_id
  for update;

  if not found
     or operation.actor_id is distinct from p_actor_id
     or operation.target_user_id is distinct from p_target_user_id
     or operation.challenge_digest is distinct from p_challenge_digest
     or operation.target_email_digest is distinct from p_target_email_digest
     or operation.idempotency_key is distinct from p_idempotency_key then
    raise exception 'PURGE_CHALLENGE_INVALID' using errcode = '42501';
  end if;
  if operation.status <> 'preview'
     and operation.stage in ('storage', 'database', 'waiting_sweep', 'storage_sweep')
     and exists (
       select 1 from public.profiles
       where user_id = p_target_user_id and access_status <> 'frozen'
     ) then
    raise exception 'PURGE_TARGET_NOT_FROZEN' using errcode = '55000';
  end if;

  if operation.status = 'preview' then
    if operation.expires_at <= statement_timestamp() then
      raise exception 'PURGE_CHALLENGE_EXPIRED' using errcode = '22023';
    end if;
    if operation.storage_cycle_stage is distinct from 'preview'
       or operation.storage_phase is distinct from 'complete' then
      raise exception 'PURGE_PREVIEW_INCOMPLETE' using errcode = '55000';
    end if;
    select users.email into current_target_email
    from auth.users users where users.id = p_target_user_id for update;
    if not found then
      raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0002';
    end if;
    if current_target_email is null
       or current_target_email is distinct from operation.target_email then
      raise exception 'PURGE_TARGET_EMAIL_CHANGED' using errcode = '55000';
    end if;

    for evidence_path in
      select target_path.object_path
      from (
        select execution.evidence_object_path as object_path
        from public.external_transfer_executions execution
        join public.transfer_intents transfer on transfer.id = execution.transfer_id
        where transfer.owner_id = p_target_user_id
        union
        select funding.evidence_object_path
        from public.external_loan_fundings funding
        join public.loan_applications loan on loan.id = funding.loan_id
        where loan.owner_id = p_target_user_id
      ) target_path
      order by target_path.object_path
    loop
      perform pg_catalog.pg_advisory_xact_lock(
        private.client_purge_storage_lock_key(
          'external-execution-evidence', evidence_path
        )
      );
    end loop;

    if exists (
      with target_path as (
        select execution.evidence_object_path as object_path
        from public.external_transfer_executions execution
        join public.transfer_intents transfer on transfer.id = execution.transfer_id
        where transfer.owner_id = p_target_user_id
        union
        select funding.evidence_object_path
        from public.external_loan_fundings funding
        join public.loan_applications loan on loan.id = funding.loan_id
        where loan.owner_id = p_target_user_id
      )
      select 1
      from target_path
      where exists (
        select 1
        from public.external_transfer_executions execution
        join public.transfer_intents transfer on transfer.id = execution.transfer_id
        where transfer.owner_id <> p_target_user_id
          and execution.evidence_object_path = target_path.object_path
      ) or exists (
        select 1
        from public.external_loan_fundings funding
        join public.loan_applications loan on loan.id = funding.loan_id
        where loan.owner_id <> p_target_user_id
          and funding.evidence_object_path = target_path.object_path
      )
    ) then
      raise exception 'PURGE_PREVIEW_STALE' using errcode = '55000';
    end if;

    select coalesce(array_agg(email order by email), array[]::text[])
    into support_emails
    from (
      select candidate.email
      from (
        select identity.normalized_email as email
        from public.support_user_identities identity
        where identity.user_id = p_target_user_id
        union
        select lower(btrim(current_target_email))
      ) candidate
      where not exists (
        select 1
        from public.support_user_identities active_identity
        where active_identity.normalized_email = candidate.email
          and active_identity.valid_to is null
          and active_identity.user_id <> p_target_user_id
      )
    ) unambiguous_emails;
    perform private.refresh_client_purge_entity_manifest(
      p_challenge_id, p_target_user_id
    );
    current_scope_digest := private.client_purge_scope_digest(
      p_challenge_id, p_target_user_id, to_jsonb(support_emails)
    );
    if operation.scope_digest is null
       or operation.scope_digest is distinct from current_scope_digest then
      raise exception 'PURGE_PREVIEW_STALE' using errcode = '55000';
    end if;
    update public.profiles
    set access_status = 'frozen',
        access_status_reason = 'Suppression administrative sécurisée en cours.'
    where user_id = p_target_user_id;
    get diagnostics frozen_profile_count = row_count;
    if frozen_profile_count > 1 then
      raise exception 'PURGE_PROFILE_CARDINALITY_INVALID' using errcode = '21000';
    end if;
    update private.client_purge_operations
    set status = 'running', stage = 'storage', consumed_at = statement_timestamp(),
        support_email_manifest = to_jsonb(support_emails),
        scope_digest = current_scope_digest,
        retry_after = statement_timestamp() + interval '5 minutes',
        last_error_code = null, updated_at = statement_timestamp()
    where challenge_id = p_challenge_id;

    -- Discard every preview-era relational path while the target's exclusive
    -- owner lock is held. The bounded Storage phase will repopulate only
    -- current references after the account has been frozen.
    perform private.initialize_client_purge_storage_cycle(
      p_challenge_id, 'storage', p_target_user_id
    );

    return jsonb_build_object(
      'status', 'running',
      'stage', 'storage',
      'sweepNotBefore', null
    );
  end if;

  if operation.status = 'waiting_sweep' then
    if operation.sweep_not_before > statement_timestamp() then
      return jsonb_build_object(
        'status', 'waiting_sweep',
        'stage', 'waiting_sweep',
        'sweepNotBefore', operation.sweep_not_before
      );
    end if;
    update private.client_purge_operations
    set status = 'running', stage = 'storage_sweep',
        retry_after = statement_timestamp() + interval '5 minutes',
        last_error_code = null, updated_at = statement_timestamp()
    where challenge_id = p_challenge_id;
    return jsonb_build_object(
      'status', 'running',
      'stage', 'storage_sweep',
      'sweepNotBefore', operation.sweep_not_before
    );
  end if;

  -- The challenge is one-use, but the exact idempotent operation can resume.
  if operation.status = 'running'
     and operation.retry_after is not null
     and operation.retry_after > statement_timestamp() then
    raise exception 'PURGE_OPERATION_IN_PROGRESS' using errcode = '55000';
  end if;
  update private.client_purge_operations
  set status = 'running',
      retry_after = statement_timestamp() + interval '5 minutes',
      last_error_code = null,
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id;
  return jsonb_build_object(
    'status', 'running',
    'stage', operation.stage,
    'sweepNotBefore', operation.sweep_not_before
  );
end;
$$;

create or replace function public.admin_resume_client_purge(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_target_email_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into operation
  from private.client_purge_operations
  where target_user_id = p_target_user_id
  for update;
  if not found or operation.consumed_at is null
     or operation.target_email_digest is distinct from p_target_email_digest then
    raise exception 'PURGE_RESUME_INVALID' using errcode = '42501';
  end if;
  if operation.stage in ('storage', 'database', 'waiting_sweep', 'storage_sweep')
     and exists (
       select 1 from public.profiles
       where user_id = p_target_user_id and access_status <> 'frozen'
     ) then
    raise exception 'PURGE_TARGET_NOT_FROZEN' using errcode = '55000';
  end if;

  if operation.status = 'waiting_sweep'
     and operation.sweep_not_before > statement_timestamp() then
    return jsonb_build_object(
      'status', 'waiting_sweep',
      'stage', 'waiting_sweep',
      'challengeId', operation.challenge_id,
      'sweepNotBefore', operation.sweep_not_before
    );
  end if;
  if operation.status = 'running'
     and operation.retry_after > statement_timestamp() then
    raise exception 'PURGE_OPERATION_IN_PROGRESS' using errcode = '55000';
  end if;

  update private.client_purge_operations
  set actor_id = p_actor_id,
      status = 'running',
      stage = case
        when operation.stage = 'waiting_sweep' then 'storage_sweep'
        else operation.stage
      end,
      retry_after = statement_timestamp() + interval '5 minutes',
      last_error_code = null,
      updated_at = statement_timestamp()
  where challenge_id = operation.challenge_id;

  return jsonb_build_object(
    'status', 'running',
    'stage', case
      when operation.stage = 'waiting_sweep' then 'storage_sweep'
      else operation.stage
    end,
    'challengeId', operation.challenge_id,
    'sweepNotBefore', operation.sweep_not_before
  );
end;
$$;

create or replace function public.admin_mark_client_purge_stage(
  p_actor_id uuid,
  p_challenge_id uuid,
  p_stage text,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_stage is null
     or p_stage not in ('storage', 'database', 'storage_sweep', 'auth', 'verify')
     or (p_error_code is not null and char_length(p_error_code) > 100) then
    raise exception 'INVALID_PURGE_STAGE' using errcode = '22023';
  end if;

  select * into operation
  from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and consumed_at is not null
  for update;
  if not found then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_stage <> operation.stage and not (
    (operation.stage = 'storage' and p_stage = 'database')
    or (operation.stage = 'storage_sweep' and p_stage = 'auth')
    or (operation.stage = 'auth' and p_stage = 'verify')
  ) then
    raise exception 'INVALID_PURGE_STAGE_TRANSITION' using errcode = '55000';
  end if;

  update private.client_purge_operations
  set stage = p_stage,
      status = case when p_error_code is null then 'running' else 'failed' end,
      last_error_code = p_error_code,
      retry_after = statement_timestamp() + case
        when p_error_code is null then interval '0 seconds'
        else interval '15 minutes'
      end,
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id;
end;
$$;

create or replace function public.admin_store_client_purge_manifest(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid,
  p_manifest jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  item jsonb;
  item_bucket text;
  item_path text;
  item_scope text;
begin
  perform private.require_active_purge_admin(p_actor_id);
  select * into operation
  from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and target_user_id = p_target_user_id
    and consumed_at is not null
  for update;
  if not found or operation.stage not in ('storage', 'storage_sweep', 'verify') then
    raise exception 'PURGE_MANIFEST_STAGE_INVALID' using errcode = '55000';
  end if;
  if p_manifest is null
     or jsonb_typeof(p_manifest) is distinct from 'array' then
    raise exception 'PURGE_MANIFEST_INVALID' using errcode = '22023';
  end if;
  if jsonb_array_length(p_manifest) > 1000 then
    raise exception 'PURGE_MANIFEST_BATCH_TOO_LARGE' using errcode = '54000';
  end if;

  for item in select value from jsonb_array_elements(p_manifest)
  loop
    if jsonb_typeof(item) is distinct from 'object'
       or not (item ? 'bucket' and item ? 'objectPath' and item ? 'ownershipScope')
       or (select count(*) from jsonb_object_keys(item)) <> 3
       or jsonb_typeof(item -> 'bucket') is distinct from 'string'
       or jsonb_typeof(item -> 'objectPath') is distinct from 'string'
       or jsonb_typeof(item -> 'ownershipScope') is distinct from 'string' then
      raise exception 'PURGE_MANIFEST_INVALID' using errcode = '22023';
    end if;

    item_bucket := item ->> 'bucket';
    item_path := item ->> 'objectPath';
    item_scope := item ->> 'ownershipScope';
    if item_scope = 'target_prefix' then
      if item_bucket not in (
           'upload-staging', 'kyc-evidence', 'loan-evidence', 'official-documents'
         ) or not private.is_client_storage_object_key(item_path, p_target_user_id) then
        raise exception 'PURGE_MANIFEST_OWNERSHIP_INVALID' using errcode = '42501';
      end if;
    elsif item_scope = 'relational' then
      if item_bucket <> 'external-execution-evidence'
         or not (
           exists (
             select 1
             from private.client_purge_storage_manifest stored
             where stored.challenge_id = p_challenge_id
               and stored.bucket = item_bucket
               and stored.object_path = item_path
               and stored.ownership_scope = item_scope
           )
           or exists (
             select 1
             from private.client_purge_storage_references(p_target_user_id) reference
             where reference.bucket = item_bucket
               and reference.object_path = item_path
               and reference.ownership_scope = 'relational'
               and reference.ownership_valid is true
           )
         ) then
        raise exception 'PURGE_MANIFEST_OWNERSHIP_INVALID' using errcode = '42501';
      end if;
    else
      raise exception 'PURGE_MANIFEST_OWNERSHIP_INVALID' using errcode = '42501';
    end if;
  end loop;

  insert into private.client_purge_storage_manifest (
    challenge_id, bucket, object_path, ownership_scope
  )
  select distinct
    p_challenge_id,
    item ->> 'bucket',
    item ->> 'objectPath',
    item ->> 'ownershipScope'
  from jsonb_array_elements(p_manifest) item
  on conflict (challenge_id, bucket, object_path) do nothing;

  update private.client_purge_operations
  set retry_after = statement_timestamp() + interval '30 minutes',
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id;
  return jsonb_array_length(p_manifest);
end;
$$;

create or replace function public.admin_get_client_purge_status(
  p_actor_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
begin
  perform private.require_active_purge_admin(p_actor_id);
  select * into operation
  from private.client_purge_operations
  where target_user_id = p_target_user_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'status', operation.status,
    'stage', operation.stage,
    'storagePhase', operation.storage_phase,
    'targetEmail', operation.target_email,
    'authDeleted', not exists (
      select 1 from auth.users users where users.id = p_target_user_id
    ),
    'ignoredUnsafeStorageReferences', operation.ignored_unsafe_storage_references,
    'sweepNotBefore', operation.sweep_not_before,
    'expiresAt', case when operation.status = 'preview' then operation.expires_at else null end,
    'canResume', operation.status = 'failed'
      or (operation.status = 'running' and operation.retry_after <= statement_timestamp())
      or (operation.status = 'waiting_sweep' and operation.sweep_not_before <= statement_timestamp())
  );
end;
$$;

create or replace function public.admin_client_purge_storage_paths(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid,
  p_source text default 'references',
  p_limit integer default 1000,
  p_after_bucket text default null,
  p_after_object_path text default null
)
returns table (
  bucket text,
  object_path text,
  ownership_scope text,
  ownership_valid boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'INVALID_STORAGE_PATH_PAGE_LIMIT' using errcode = '22023';
  end if;
  if p_source is null or p_source not in ('references', 'manifest') then
    raise exception 'INVALID_STORAGE_PATH_SOURCE' using errcode = '22023';
  end if;
  if (p_after_bucket is null) <> (p_after_object_path is null) then
    raise exception 'INVALID_STORAGE_PATH_CURSOR' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from private.client_purge_operations operation
    where operation.challenge_id = p_challenge_id
      and operation.actor_id = p_actor_id
      and operation.target_user_id = p_target_user_id
      and (
        operation.consumed_at is not null
        or (
          operation.status = 'preview'
          and operation.expires_at > statement_timestamp()
        )
      )
  ) then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_source = 'manifest' then
    return query
    select stored.bucket, stored.object_path, stored.ownership_scope, true
    from private.client_purge_storage_manifest stored
    where stored.challenge_id = p_challenge_id
      and (
        p_after_bucket is null
        or (stored.bucket, stored.object_path)
        > (p_after_bucket, p_after_object_path)
      )
    order by stored.bucket, stored.object_path
    limit p_limit;
    return;
  end if;

  return query
  select reference.bucket, reference.object_path,
    reference.ownership_scope, reference.ownership_valid
  from private.client_purge_storage_references(p_target_user_id) reference
  where reference.object_path is not null
    and char_length(reference.object_path) > 0
    and (
      p_after_bucket is null
      or (reference.bucket, reference.object_path)
        > (p_after_bucket, p_after_object_path)
    )
  order by reference.bucket, reference.object_path
  limit p_limit;
end;
$$;

create or replace function public.admin_purge_client_relational_data(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  target_email text;
  support_emails jsonb;
  purge_completed_at timestamptz;
  sweep_time timestamptz;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into operation
  from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and target_user_id = p_target_user_id
    and consumed_at is not null
  for update;
  if not found or operation.stage <> 'database' then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1 from public.profiles where user_id = p_target_user_id for update;
  if exists (
    select 1 from public.profiles
    where user_id = p_target_user_id and access_status <> 'frozen'
  ) then
    raise exception 'PURGE_TARGET_NOT_FROZEN' using errcode = '55000';
  end if;
  select lower(btrim(users.email)) into target_email
  from auth.users users where users.id = p_target_user_id;
  target_email := coalesce(target_email, lower(btrim(operation.target_email)));
  perform private.refresh_client_purge_entity_manifest(
    p_challenge_id, p_target_user_id
  );

  select coalesce(jsonb_agg(email order by email), '[]'::jsonb)
  into support_emails
  from (
    select candidate.email
    from (
      select identity.normalized_email as email
      from public.support_user_identities identity
      where identity.user_id = p_target_user_id
      union
      select target_email where target_email is not null
    ) candidate
    where not exists (
      select 1
      from public.support_user_identities active_identity
      where active_identity.normalized_email = candidate.email
        and active_identity.valid_to is null
        and active_identity.user_id <> p_target_user_id
    )
  ) unambiguous_emails;

  -- Audit/transcript matching below must read the authoritative aliases from
  -- this locked execution snapshot, never the stale preview snapshot.
  update private.client_purge_operations
  set support_email_manifest = support_emails,
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id;

  operation.support_email_manifest := support_emails;

  perform pg_catalog.set_config('monalyz.allow_ledger_maintenance', 'on', true);
  perform pg_catalog.set_config('monalyz.allow_official_document_maintenance', 'on', true);
  perform pg_catalog.set_config('monalyz.client_purge_maintenance', 'on', true);

  delete from public.support_transcripts transcript
  where transcript.user_id = p_target_user_id
     or (
       transcript.user_id is null
       and (
         transcript.visitor_email_normalized in (
           select jsonb_array_elements_text(support_emails)
         )
         or transcript.notification_email in (
           select jsonb_array_elements_text(support_emails)
         )
       )
       and not exists (
         select 1 from public.support_user_identities active_identity
         where active_identity.valid_to is null
           and active_identity.user_id <> p_target_user_id
           and active_identity.normalized_email in (
             transcript.visitor_email_normalized,
             transcript.notification_email
           )
       )
     );
  delete from public.support_user_identities where user_id = p_target_user_id;
  delete from public.transactional_email_outbox where recipient_id = p_target_user_id;
  update public.transactional_email_outbox set claimed_by = null where claimed_by = p_target_user_id;
  delete from public.notifications where recipient_id = p_target_user_id;
  delete from public.push_subscriptions where user_id = p_target_user_id;

  delete from public.audit_events
  where private.audit_event_matches_client(
    actor_id, entity_type, entity_id, metadata, p_target_user_id, p_challenge_id
  );
  delete from public.kyc_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'kyc_event'
      and entity.entity_id = event.id::text
  );
  delete from public.loan_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'loan_event'
      and entity.entity_id = event.id::text
  );
  delete from public.transfer_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'transfer_event'
      and entity.entity_id = event.id::text
  );
  delete from public.loan_review_checks review
  where exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'loan_review_check'
      and entity.entity_id = review.id::text
  );
  delete from public.transfer_review_checks review
  where exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'transfer_review_check'
      and entity.entity_id = review.id::text
  );

  delete from public.official_documents where owner_id = p_target_user_id;
  delete from public.financial_ledger_entries where owner_id = p_target_user_id;
  delete from public.external_transfer_executions
  where transfer_id in (
    select transfer.id from public.transfer_intents transfer
    where transfer.owner_id = p_target_user_id
  );
  delete from public.external_loan_fundings
  where loan_id in (
    select loan.id from public.loan_applications loan
    where loan.owner_id = p_target_user_id
  );
  delete from public.transfer_intents where owner_id = p_target_user_id;
  delete from public.loan_applications where owner_id = p_target_user_id;
  delete from public.financial_positions where owner_id = p_target_user_id;
  delete from public.kyc_drafts where owner_id = p_target_user_id;
  delete from public.kyc_applications where owner_id = p_target_user_id;

  purge_completed_at := pg_catalog.clock_timestamp();
  -- Signed upload URLs live for at most two hours. The extra five minutes are
  -- intentional clock/network margin before the final two Storage sweeps.
  sweep_time := purge_completed_at + interval '2 hours 5 minutes';
  update private.client_purge_operations
  set stage = 'waiting_sweep', status = 'waiting_sweep',
      sweep_not_before = sweep_time, retry_after = sweep_time,
      last_error_code = null, updated_at = purge_completed_at
  where challenge_id = p_challenge_id;

  return jsonb_build_object(
    'status', 'waiting_sweep',
    'stage', 'waiting_sweep',
    'sweepNotBefore', sweep_time,
    'ignoredUnsafeStorageReferences', operation.ignored_unsafe_storage_references
  );
end;
$$;

create or replace function public.admin_finalize_client_purge(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  residual record;
  residuals jsonb;
begin
  perform private.require_active_purge_admin(p_actor_id);
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  select * into operation
  from private.client_purge_operations
    where challenge_id = p_challenge_id
      and actor_id = p_actor_id
      and target_user_id = p_target_user_id
      and stage = 'verify'
      and consumed_at is not null
  for update;
  if not found then
    raise exception 'PURGE_FINALIZE_STAGE_INVALID' using errcode = '55000';
  end if;
  if operation.storage_cycle_stage <> 'verify'
     or operation.storage_phase <> 'complete' then
    raise exception 'PURGE_STORAGE_VERIFICATION_INCOMPLETE' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('monalyz.client_purge_maintenance', 'on', true);

  -- Auth deletion retires (but intentionally does not erase) support identity
  -- history. Remove any identity recreated during the signed-URL grace period,
  -- and every transcript linked to the current or historical e-mail manifest.
  with candidate_emails as (
    select jsonb_array_elements_text(operation.support_email_manifest) as email
    union
    select identity.normalized_email
    from public.support_user_identities identity
    where identity.user_id = p_target_user_id
  ), support_emails as (
    select candidate.email
    from candidate_emails candidate
    where not exists (
      select 1
      from public.support_user_identities active_identity
      where active_identity.normalized_email = candidate.email
        and active_identity.valid_to is null
        and active_identity.user_id <> p_target_user_id
    )
  )
  delete from public.support_transcripts transcript
  where transcript.user_id = p_target_user_id
     or (
       transcript.user_id is null
       and (
         transcript.visitor_email_normalized in (select email from support_emails)
         or transcript.notification_email in (select email from support_emails)
       )
       and not exists (
         select 1 from public.support_user_identities active_identity
         where active_identity.valid_to is null
           and active_identity.user_id <> p_target_user_id
           and active_identity.normalized_email in (
             transcript.visitor_email_normalized,
             transcript.notification_email
           )
       )
     );
  delete from public.support_user_identities where user_id = p_target_user_id;
  -- Foreign parents are never deleted merely because they reused a quarantined
  -- path. Such a row is reported by residual verification and must be resolved
  -- explicitly before the purge can complete.

  delete from public.audit_events event
  where private.audit_event_matches_client(
    event.actor_id, event.entity_type, event.entity_id, event.metadata,
    p_target_user_id, p_challenge_id
  );
  delete from public.kyc_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'kyc_event'
      and entity.entity_id = event.id::text
  );
  delete from public.loan_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'loan_event'
      and entity.entity_id = event.id::text
  );
  delete from public.transfer_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'transfer_event'
      and entity.entity_id = event.id::text
  );
  delete from public.loan_review_checks review
  where exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'loan_review_check'
      and entity.entity_id = review.id::text
  );
  delete from public.transfer_review_checks review
  where exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'transfer_review_check'
      and entity.entity_id = review.id::text
  );

  residuals := private.client_purge_residuals(p_challenge_id, p_target_user_id);
  for residual in select key, value from jsonb_each_text(residuals)
  loop
    if residual.value::bigint <> 0 then
      raise exception 'PURGE_VERIFICATION_FAILED:%=%', residual.key, residual.value
        using errcode = '55000', detail = residuals::text;
    end if;
  end loop;

  delete from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and target_user_id = p_target_user_id
    and consumed_at is not null;
  return found;
end;
$$;

create or replace function public.admin_list_pending_client_purges(
  p_limit integer default 20
)
returns table (
  challenge_id uuid,
  actor_id uuid,
  target_user_id uuid,
  challenge_digest text,
  target_email_digest text,
  idempotency_key uuid,
  stage text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'INVALID_SWEEP_LIMIT' using errcode = '22023';
  end if;

  delete from private.client_purge_operations
  where status = 'preview' and expires_at <= statement_timestamp();

  return query
  with candidates as (
    select operation.challenge_id, resume_admin.user_id as actor_id
    from private.client_purge_operations operation
    cross join lateral (
      select staff.user_id
      from public.staff_members staff
      join auth.users users on users.id = staff.user_id
      where staff.role = 'admin' and staff.active
      order by (staff.user_id = operation.actor_id) desc, staff.user_id
      limit 1
    ) resume_admin
    where operation.consumed_at is not null
      and (
        (
          operation.status = 'waiting_sweep'
          and operation.sweep_not_before <= statement_timestamp()
        )
        or (
          operation.status in ('running', 'failed')
          and operation.retry_after <= statement_timestamp()
        )
      )
      and (
        operation.stage in ('auth', 'verify')
        or not exists (
          select 1 from public.profiles profile
          where profile.user_id = operation.target_user_id
            and profile.access_status <> 'frozen'
        )
      )
    order by operation.updated_at
    limit p_limit
    for update skip locked
  )
  update private.client_purge_operations operation
  set actor_id = candidates.actor_id,
      status = 'running',
      stage = case
        when operation.stage = 'waiting_sweep' then 'storage_sweep'
        else operation.stage
      end,
      retry_after = statement_timestamp() + interval '30 minutes',
      updated_at = statement_timestamp()
  from candidates
  where operation.challenge_id = candidates.challenge_id
  returning operation.challenge_id, operation.actor_id, operation.target_user_id,
    operation.challenge_digest, operation.target_email_digest,
    operation.idempotency_key, operation.stage;
end;
$$;

-- Every owner mutation and the destructive purge use this single advisory-lock
-- namespace. Business RPCs acquire the shared form before row locks; row
-- triggers use the non-blocking form as a final defence so they can never form
-- a row-lock/advisory-lock deadlock with a purge already in progress.
create or replace function private.client_purge_lock_key(p_owner_id uuid)
returns bigint
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.hashtextextended(p_owner_id::text, 847231);
$$;

create or replace function private.client_purge_storage_lock_key(
  p_bucket text,
  p_object_path text
)
returns bigint
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.hashtextextended(
    char_length(p_bucket)::text || ':' || p_bucket || ':'
      || char_length(p_object_path)::text || ':' || p_object_path,
    847239
  );
$$;

create or replace function private.uuid_or_null(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then p_value::uuid
    else null
  end;
$$;

create or replace function private.lock_client_mutation(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner_id is null then
    raise exception 'CLIENT_OWNER_REQUIRED' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    private.client_purge_lock_key(p_owner_id)
  );
  if exists (
    select 1 from private.client_purge_operations operation
    where operation.target_user_id = p_owner_id
      and operation.consumed_at is not null
  ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
end;
$$;

create or replace function private.try_guard_client_mutation(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner_id is null
     or current_setting('monalyz.client_purge_maintenance', true) = 'on' then
    return;
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(
    private.client_purge_lock_key(p_owner_id)
  ) then
    raise exception 'PURGE_TARGET_MUTATION_BUSY' using errcode = '55P03';
  end if;
  if exists (
    select 1 from private.client_purge_operations operation
    where operation.target_user_id = p_owner_id
      and operation.consumed_at is not null
  ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
end;
$$;

create or replace function private.guard_direct_client_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_owner uuid;
  new_owner uuid;
begin
  if (tg_op = 'DELETE' and pg_trigger_depth() > 1)
     or (tg_table_name = 'support_user_identities' and pg_trigger_depth() > 1) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op <> 'INSERT' then
    old_owner := nullif(to_jsonb(old) ->> tg_argv[0], '')::uuid;
  end if;
  if tg_op <> 'DELETE' then
    new_owner := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  end if;
  -- Deterministic UUID order also covers the rare ownership transfer update.
  if old_owner is not null and (new_owner is null or old_owner::text <= new_owner::text) then
    perform private.try_guard_client_mutation(old_owner);
  end if;
  if new_owner is not null and new_owner is distinct from old_owner then
    perform private.try_guard_client_mutation(new_owner);
  end if;
  if old_owner is not null and new_owner is not null and old_owner::text > new_owner::text then
    perform private.try_guard_client_mutation(old_owner);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.guard_indirect_client_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_relation_id uuid := case when tg_op <> 'INSERT' then
    private.uuid_or_null(to_jsonb(old) ->> tg_argv[1]) else null end;
  new_relation_id uuid := case when tg_op <> 'DELETE' then
    private.uuid_or_null(to_jsonb(new) ->> tg_argv[1]) else null end;
  old_owner_id uuid;
  new_owner_id uuid;
  evidence_path text;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_argv[0] not in ('kyc', 'loan', 'transfer', 'transcript', 'subscription') then
    raise exception 'CLIENT_MUTATION_GUARD_CONFIG_INVALID' using errcode = '22023';
  end if;

  if old_relation_id is not null then
    if tg_argv[0] = 'kyc' then
      select application.owner_id into old_owner_id
      from public.kyc_applications application where application.id = old_relation_id;
    elsif tg_argv[0] = 'loan' then
      select loan.owner_id into old_owner_id
      from public.loan_applications loan where loan.id = old_relation_id;
    elsif tg_argv[0] = 'transfer' then
      select transfer.owner_id into old_owner_id
      from public.transfer_intents transfer where transfer.id = old_relation_id;
    elsif tg_argv[0] = 'transcript' then
      select transcript.user_id into old_owner_id
      from public.support_transcripts transcript where transcript.id = old_relation_id;
    else
      select subscription.user_id into old_owner_id
      from public.push_subscriptions subscription where subscription.id = old_relation_id;
    end if;
  end if;
  if new_relation_id is not null and new_relation_id is distinct from old_relation_id then
    if tg_argv[0] = 'kyc' then
      select application.owner_id into new_owner_id
      from public.kyc_applications application where application.id = new_relation_id;
    elsif tg_argv[0] = 'loan' then
      select loan.owner_id into new_owner_id
      from public.loan_applications loan where loan.id = new_relation_id;
    elsif tg_argv[0] = 'transfer' then
      select transfer.owner_id into new_owner_id
      from public.transfer_intents transfer where transfer.id = new_relation_id;
    elsif tg_argv[0] = 'transcript' then
      select transcript.user_id into new_owner_id
      from public.support_transcripts transcript where transcript.id = new_relation_id;
    else
      select subscription.user_id into new_owner_id
      from public.push_subscriptions subscription where subscription.id = new_relation_id;
    end if;
  else
    new_owner_id := old_owner_id;
  end if;

  if old_owner_id is not null
     and (new_owner_id is null or old_owner_id::text <= new_owner_id::text) then
    perform private.try_guard_client_mutation(old_owner_id);
  end if;
  if new_owner_id is not null and new_owner_id is distinct from old_owner_id then
    perform private.try_guard_client_mutation(new_owner_id);
  end if;
  if old_owner_id is not null and new_owner_id is not null
     and old_owner_id::text > new_owner_id::text then
    perform private.try_guard_client_mutation(old_owner_id);
  end if;
  if tg_op <> 'INSERT' then
    perform private.try_guard_client_mutation(
      private.uuid_or_null(to_jsonb(old) ->> 'actor_id')
    );
  end if;
  if tg_op <> 'DELETE' then
    perform private.try_guard_client_mutation(
      private.uuid_or_null(to_jsonb(new) ->> 'actor_id')
    );
  end if;

  if tg_table_name in ('external_transfer_executions', 'external_loan_fundings')
     and tg_op <> 'DELETE'
     and current_setting('monalyz.client_purge_maintenance', true) is distinct from 'on' then
    for evidence_path in
      select distinct candidate.path
      from unnest(array[
        case when tg_op <> 'INSERT' then to_jsonb(old) ->> 'evidence_object_path' end,
        to_jsonb(new) ->> 'evidence_object_path'
      ]) candidate(path)
      where candidate.path is not null
      order by candidate.path
    loop
      perform pg_catalog.pg_advisory_xact_lock_shared(
        private.client_purge_storage_lock_key(
          'external-execution-evidence', evidence_path
        )
      );
      if exists (
        select 1
        from private.client_purge_operations operation
        where operation.consumed_at is not null
          and (
            exists (
              select 1
              from private.client_purge_storage_manifest manifest
              where manifest.challenge_id = operation.challenge_id
                and manifest.bucket = 'external-execution-evidence'
                and manifest.ownership_scope = 'relational'
                and manifest.object_path = evidence_path
            )
            or exists (
              select 1
              from public.external_transfer_executions execution
              join public.transfer_intents transfer
                on transfer.id = execution.transfer_id
              where transfer.owner_id = operation.target_user_id
                and execution.evidence_object_path = evidence_path
            )
            or exists (
              select 1
              from public.external_loan_fundings funding
              join public.loan_applications loan on loan.id = funding.loan_id
              where loan.owner_id = operation.target_user_id
                and funding.evidence_object_path = evidence_path
            )
          )
      ) then
        raise exception 'PURGE_EVIDENCE_PATH_QUARANTINED' using errcode = '55000';
      end if;
    end loop;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.guard_support_transcript_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  new_data jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  old_owner_id uuid := private.uuid_or_null(old_data ->> 'user_id');
  new_owner_id uuid := private.uuid_or_null(new_data ->> 'user_id');
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if old_owner_id is not null
     and (new_owner_id is null or old_owner_id::text <= new_owner_id::text) then
    perform private.try_guard_client_mutation(old_owner_id);
  end if;
  if new_owner_id is not null and new_owner_id is distinct from old_owner_id then
    perform private.try_guard_client_mutation(new_owner_id);
  end if;
  if old_owner_id is not null and new_owner_id is not null
     and old_owner_id::text > new_owner_id::text then
    perform private.try_guard_client_mutation(old_owner_id);
  end if;
  if current_setting('monalyz.client_purge_maintenance', true) is distinct from 'on'
     and exists (
       select 1
       from private.client_purge_operations operation
       where operation.consumed_at is not null
         and (
           exists (
             select 1
             from jsonb_array_elements_text(operation.support_email_manifest)
               as support_email(value)
             where support_email.value in (
               lower(btrim(old_data ->> 'visitor_email_normalized')),
               lower(btrim(old_data ->> 'notification_email')),
               lower(btrim(new_data ->> 'visitor_email_normalized')),
               lower(btrim(new_data ->> 'notification_email'))
             )
               and not exists (
                 select 1
                 from public.support_user_identities active_identity
                 where active_identity.normalized_email = support_email.value
                   and active_identity.valid_to is null
                   and active_identity.user_id <> operation.target_user_id
               )
           )
         )
     ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.guard_client_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  new_data jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  candidate uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  foreach candidate in array array[
    private.uuid_or_null(old_data ->> 'actor_id'),
    case when old_data ->> 'entity_type' in ('user', 'profile', 'auth_user')
      then private.uuid_or_null(old_data ->> 'entity_id') else null end,
    private.uuid_or_null(old_data #>> '{metadata,user_id}'),
    private.uuid_or_null(old_data #>> '{metadata,owner_id}'),
    private.uuid_or_null(old_data #>> '{metadata,recipient_id}'),
    private.uuid_or_null(old_data #>> '{metadata,target_user_id}'),
    private.uuid_or_null(new_data ->> 'actor_id'),
    case when new_data ->> 'entity_type' in ('user', 'profile', 'auth_user')
      then private.uuid_or_null(new_data ->> 'entity_id') else null end,
    private.uuid_or_null(new_data #>> '{metadata,user_id}'),
    private.uuid_or_null(new_data #>> '{metadata,owner_id}'),
    private.uuid_or_null(new_data #>> '{metadata,recipient_id}'),
    private.uuid_or_null(new_data #>> '{metadata,target_user_id}')
  ] loop
    perform private.try_guard_client_mutation(candidate);
  end loop;
  if current_setting('monalyz.client_purge_maintenance', true) is distinct from 'on'
     and exists (
       select 1
       from private.client_purge_entity_manifest entity
       join private.client_purge_operations operation
         on operation.challenge_id = entity.challenge_id
       where operation.consumed_at is not null
         and (
           (
             entity.entity_type = old_data ->> 'entity_type'
             and entity.entity_id = private.uuid_or_null(
               old_data ->> 'entity_id'
             )::text
           )
           or (
             entity.entity_type = new_data ->> 'entity_type'
             and entity.entity_id = private.uuid_or_null(
               new_data ->> 'entity_id'
             )::text
           )
         )
     ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if current_setting('monalyz.client_purge_maintenance', true) is distinct from 'on'
     and exists (
       select 1 from private.client_purge_operations operation
       where operation.consumed_at is not null
         and exists (
           select 1
           from jsonb_array_elements_text(operation.support_email_manifest)
             as support_email(value)
           where support_email.value in (
             lower(btrim(old_data #>> '{metadata,email}')),
             lower(btrim(old_data #>> '{metadata,recipient_email}')),
             lower(btrim(old_data #>> '{metadata,user_email}')),
             lower(btrim(old_data #>> '{metadata,target_email}')),
             lower(btrim(new_data #>> '{metadata,email}')),
             lower(btrim(new_data #>> '{metadata,recipient_email}')),
             lower(btrim(new_data #>> '{metadata,user_email}')),
             lower(btrim(new_data #>> '{metadata,target_email}'))
           )
             and not exists (
               select 1
               from public.support_user_identities active_identity
               where active_identity.normalized_email = support_email.value
                 and active_identity.valid_to is null
                 and active_identity.user_id <> operation.target_user_id
             )
         )
     ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Client RPCs already call this helper before touching their rows. Extending it
-- establishes the canonical shared-lock-before-row-lock order application-wide.
create or replace function private.ensure_active_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  perform private.lock_client_mutation(caller_id);
  if not exists (
    select 1 from public.profiles
    where user_id = caller_id and access_status = 'active'
  ) then
    raise exception 'ACCOUNT_ACCESS_RESTRICTED' using errcode = '42501';
  end if;
  return caller_id;
end;
$$;

-- Direct owner tables. Purge maintenance sets a transaction-local bypass only
-- after it owns the exclusive advisory lock.
create trigger profiles_guard_client_purge_mutation
before insert or update or delete on public.profiles
for each row execute function private.guard_direct_client_mutation('user_id');
create trigger kyc_drafts_guard_client_purge_mutation
before insert or update or delete on public.kyc_drafts
for each row execute function private.guard_direct_client_mutation('owner_id');
create trigger kyc_applications_guard_client_purge_mutation
before insert or update or delete on public.kyc_applications
for each row execute function private.guard_direct_client_mutation('owner_id');
create trigger financial_positions_guard_client_purge_mutation
before insert or update or delete on public.financial_positions
for each row execute function private.guard_direct_client_mutation('owner_id');
create trigger financial_ledger_guard_client_purge_mutation
before insert or update or delete on public.financial_ledger_entries
for each row execute function private.guard_direct_client_mutation('owner_id');
create trigger loan_applications_guard_client_purge_mutation
before insert or update or delete on public.loan_applications
for each row execute function private.guard_direct_client_mutation('owner_id');
create trigger transfer_intents_guard_client_purge_mutation
before insert or update or delete on public.transfer_intents
for each row execute function private.guard_direct_client_mutation('owner_id');
create trigger official_documents_guard_client_purge_mutation
before insert or update or delete on public.official_documents
for each row execute function private.guard_direct_client_mutation('owner_id');
create trigger notifications_guard_client_purge_mutation
before insert or update or delete on public.notifications
for each row execute function private.guard_direct_client_mutation('recipient_id');
create trigger email_outbox_guard_client_purge_mutation
before insert or update or delete on public.transactional_email_outbox
for each row execute function private.guard_direct_client_mutation('recipient_id');
create trigger email_outbox_claim_guard_client_purge_mutation
before insert or update or delete on public.transactional_email_outbox
for each row execute function private.guard_direct_client_mutation('claimed_by');
create trigger push_subscriptions_guard_client_purge_mutation
before insert or update or delete on public.push_subscriptions
for each row execute function private.guard_direct_client_mutation('user_id');
create trigger support_identities_guard_client_purge_mutation
before insert or update or delete on public.support_user_identities
for each row execute function private.guard_direct_client_mutation('user_id');
create trigger support_transcripts_guard_client_purge_mutation
before insert or update or delete on public.support_transcripts
for each row execute function private.guard_support_transcript_mutation();
create trigger audit_events_guard_client_purge_mutation
before insert or update or delete on public.audit_events
for each row execute function private.guard_client_audit_mutation();

create trigger kyc_events_guard_client_purge_mutation
before insert or update or delete on public.kyc_events
for each row execute function private.guard_indirect_client_mutation('kyc', 'kyc_id');
create trigger kyc_checklists_guard_client_purge_mutation
before insert or update or delete on public.kyc_review_checklists
for each row execute function private.guard_indirect_client_mutation('kyc', 'kyc_id');
create trigger loan_events_guard_client_purge_mutation
before insert or update or delete on public.loan_events
for each row execute function private.guard_indirect_client_mutation('loan', 'loan_id');
create trigger loan_checks_guard_client_purge_mutation
before insert or update or delete on public.loan_review_checks
for each row execute function private.guard_indirect_client_mutation('loan', 'loan_id');
create trigger external_loan_guard_client_purge_mutation
before insert or update or delete on public.external_loan_fundings
for each row execute function private.guard_indirect_client_mutation('loan', 'loan_id');
create trigger transfer_events_guard_client_purge_mutation
before insert or update or delete on public.transfer_events
for each row execute function private.guard_indirect_client_mutation('transfer', 'transfer_id');
create trigger transfer_checks_guard_client_purge_mutation
before insert or update or delete on public.transfer_review_checks
for each row execute function private.guard_indirect_client_mutation('transfer', 'transfer_id');
create trigger external_transfer_guard_client_purge_mutation
before insert or update or delete on public.external_transfer_executions
for each row execute function private.guard_indirect_client_mutation('transfer', 'transfer_id');
create trigger support_delivery_transcript_guard_client_purge_mutation
before insert or update or delete on public.support_push_deliveries
for each row execute function private.guard_indirect_client_mutation('transcript', 'transcript_id');

create or replace function private.prevent_purge_target_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    if not pg_catalog.pg_try_advisory_xact_lock_shared(
      private.client_purge_lock_key(new.user_id)
    ) then
      raise exception 'PURGE_TARGET_PROMOTION_BUSY' using errcode = '55P03';
    end if;
    if exists (
      select 1 from private.client_purge_operations operation
      where operation.target_user_id = new.user_id
        and operation.consumed_at is not null
    ) then
      raise exception 'PURGE_TARGET_PROMOTION_FORBIDDEN' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger staff_members_prevent_purge_target_promotion
before insert or update of user_id, role, active on public.staff_members
for each row execute function private.prevent_purge_target_promotion();

create or replace function private.arm_guarded_client_auth_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
begin
  -- auth.users is already row-locked when a row trigger runs. Never wait on
  -- the owner lock here: fail fast instead of creating a row/advisory cycle.
  if not pg_catalog.pg_try_advisory_xact_lock(
    private.client_purge_lock_key(old.id)
  ) then
    raise exception 'PURGE_AUTH_DELETE_BUSY' using errcode = '55P03';
  end if;
  select * into operation from private.client_purge_operations
  where target_user_id = old.id and consumed_at is not null
  for update;
  if not found then
    raise exception 'UNGUARDED_AUTH_DELETE_FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff_members where user_id = old.id)
     or operation.stage not in ('auth', 'verify')
     or operation.storage_cycle_stage <> 'storage_sweep'
     or operation.storage_phase <> 'complete'
     or operation.sweep_not_before is null
     or operation.sweep_not_before > statement_timestamp() then
    raise exception 'GUARDED_AUTH_DELETE_NOT_READY' using errcode = '55000';
  end if;
  if old.email is null
     or lower(btrim(old.email)) is distinct from lower(btrim(operation.target_email)) then
    raise exception 'PURGE_TARGET_EMAIL_CHANGED' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('monalyz.client_purge_maintenance', 'on', true);
  return old;
end;
$$;

create trigger auth_users_arm_guarded_client_delete
before delete on auth.users
for each row execute function private.arm_guarded_client_auth_delete();

create or replace function private.reject_reserved_purge_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_new_email text := lower(btrim(new.email));
begin
  if tg_op = 'UPDATE' and exists (
    select 1
    from private.client_purge_operations operation
    where operation.target_user_id = old.id
      and operation.consumed_at is not null
  ) then
    raise exception 'PURGE_TARGET_EMAIL_RESERVED' using errcode = '55000';
  end if;

  if normalized_new_email is not null and exists (
    select 1
    from private.client_purge_operations operation
    where operation.consumed_at is not null
      and lower(btrim(operation.target_email)) = normalized_new_email
  ) then
    raise exception 'PURGE_TARGET_EMAIL_RESERVED' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger auth_users_reject_reserved_purge_email_insert
before insert on auth.users
for each row execute function private.reject_reserved_purge_email();

create trigger auth_users_reject_reserved_purge_email_update
before update of email on auth.users
for each row execute function private.reject_reserved_purge_email();

revoke execute on function private.client_purge_lock_key(uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.client_purge_storage_lock_key(text, text)
from public, anon, authenticated, service_role;
revoke execute on function private.uuid_or_null(text)
from public, anon, authenticated, service_role;
revoke execute on function private.lock_client_mutation(uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.try_guard_client_mutation(uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.guard_direct_client_mutation()
from public, anon, authenticated, service_role;
revoke execute on function private.guard_indirect_client_mutation()
from public, anon, authenticated, service_role;
revoke execute on function private.guard_support_transcript_mutation()
from public, anon, authenticated, service_role;
revoke execute on function private.guard_client_audit_mutation()
from public, anon, authenticated, service_role;
revoke execute on function private.prevent_purge_target_promotion()
from public, anon, authenticated, service_role;
revoke execute on function private.arm_guarded_client_auth_delete()
from public, anon, authenticated, service_role;
revoke execute on function private.reject_reserved_purge_email()
from public, anon, authenticated, service_role;

create or replace function private.refresh_client_purge_entity_manifest(
  p_challenge_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.client_purge_operations operation
    where operation.challenge_id = p_challenge_id
      and operation.target_user_id = p_target_user_id
  ) then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- A preview is informational and may span several requests. Never reuse its
  -- ownership snapshot for execution: under the caller's owner lock, replace
  -- it with the exact current graph so a relation moved to another client
  -- cannot be deleted through a stale manifest entry.
  delete from private.client_purge_entity_manifest
  where challenge_id = p_challenge_id;

  insert into private.client_purge_entity_manifest (
    challenge_id, entity_type, entity_id
  )
  select p_challenge_id, entity.entity_type, entity.entity_id
  from (
    select 'user'::text, p_target_user_id::text
    union all select 'profile', profile.user_id::text from public.profiles profile
      where profile.user_id = p_target_user_id
    union all select 'kyc_application', application.id::text from public.kyc_applications application
      where application.owner_id = p_target_user_id
    union all select 'kyc_draft', draft.owner_id::text from public.kyc_drafts draft
      where draft.owner_id = p_target_user_id
    union all select 'financial_position', position.id::text from public.financial_positions position
      where position.owner_id = p_target_user_id
    union all select 'financial_ledger_entry', entry.id::text from public.financial_ledger_entries entry
      where entry.owner_id = p_target_user_id
    union all select 'loan_application', loan.id::text from public.loan_applications loan
      where loan.owner_id = p_target_user_id
    union all select 'transfer_intent', transfer.id::text from public.transfer_intents transfer
      where transfer.owner_id = p_target_user_id
    union all select 'official_document', document.id::text from public.official_documents document
      where document.owner_id = p_target_user_id
    union all select 'notification', notification.id::text from public.notifications notification
      where notification.recipient_id = p_target_user_id
    union all select 'email_outbox', outbox.id::text from public.transactional_email_outbox outbox
      where outbox.recipient_id = p_target_user_id or outbox.claimed_by = p_target_user_id
    union all select 'push_subscription', subscription.id::text from public.push_subscriptions subscription
      where subscription.user_id = p_target_user_id
    union all select 'support_identity', identity.id::text from public.support_user_identities identity
      where identity.user_id = p_target_user_id
    union all select 'support_transcript', transcript.id::text from public.support_transcripts transcript
      where transcript.user_id = p_target_user_id
    union all select 'support_push_delivery', delivery.id::text
      from public.support_push_deliveries delivery
      join public.support_transcripts transcript on transcript.id = delivery.transcript_id
      where transcript.user_id = p_target_user_id
    union all select 'kyc_review_checklist', checklist.kyc_id::text
      from public.kyc_review_checklists checklist
      join public.kyc_applications application on application.id = checklist.kyc_id
      where application.owner_id = p_target_user_id
    union all select 'loan_review_check', review.id::text
      from public.loan_review_checks review
      join public.loan_applications loan on loan.id = review.loan_id
      where loan.owner_id = p_target_user_id
    union all select 'transfer_review_check', review.id::text
      from public.transfer_review_checks review
      join public.transfer_intents transfer on transfer.id = review.transfer_id
      where transfer.owner_id = p_target_user_id
    union all select 'external_loan_funding', funding.loan_id::text
      from public.external_loan_fundings funding
      join public.loan_applications loan on loan.id = funding.loan_id
      where loan.owner_id = p_target_user_id
    union all select 'external_transfer_execution', execution.transfer_id::text
      from public.external_transfer_executions execution
      join public.transfer_intents transfer on transfer.id = execution.transfer_id
      where transfer.owner_id = p_target_user_id
    union all select 'kyc_event', event.id::text from public.kyc_events event
      where event.actor_id = p_target_user_id or event.kyc_id in (
        select application.id from public.kyc_applications application
        where application.owner_id = p_target_user_id
      )
    union all select 'loan_event', event.id::text from public.loan_events event
      where event.actor_id = p_target_user_id or event.loan_id in (
        select loan.id from public.loan_applications loan where loan.owner_id = p_target_user_id
      )
    union all select 'transfer_event', event.id::text from public.transfer_events event
      where event.actor_id = p_target_user_id or event.transfer_id in (
        select transfer.id from public.transfer_intents transfer where transfer.owner_id = p_target_user_id
      )
  ) entity(entity_type, entity_id)
  where entity.entity_id is not null
  on conflict (challenge_id, entity_type, entity_id) do nothing;
end;
$$;

create or replace function private.client_purge_scope_digest(
  p_challenge_id uuid,
  p_target_user_id uuid,
  p_support_emails jsonb
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'entities', coalesce((
            select jsonb_agg(
              jsonb_build_array(entity.entity_type, entity.entity_id)
              order by entity.entity_type, entity.entity_id
            )
            from private.client_purge_entity_manifest entity
            where entity.challenge_id = p_challenge_id
          ), '[]'::jsonb),
          'relationalStorage', coalesce((
            select jsonb_agg(
              jsonb_build_array(reference.bucket, reference.object_path)
              order by reference.bucket, reference.object_path
            )
            from private.client_purge_storage_references(p_target_user_id) reference
            where reference.ownership_scope = 'relational'
              and reference.ownership_valid is true
          ), '[]'::jsonb),
          'supportEmailTranscripts', coalesce((
            select jsonb_agg(transcript.id order by transcript.id)
            from public.support_transcripts transcript
            where transcript.user_id is null
              and (
                transcript.visitor_email_normalized in (
                  select jsonb_array_elements_text(
                    coalesce(p_support_emails, '[]'::jsonb)
                  )
                )
                or transcript.notification_email in (
                  select jsonb_array_elements_text(
                    coalesce(p_support_emails, '[]'::jsonb)
                  )
                )
              )
          ), '[]'::jsonb),
          'auditEvents', coalesce((
            select jsonb_agg(event.id order by event.id)
            from public.audit_events event
            where event.actor_id = p_target_user_id
              or (
                event.entity_type in ('user', 'profile', 'auth_user')
                and event.entity_id = p_target_user_id
              )
              or exists (
                select 1
                from private.client_purge_entity_manifest entity
                where entity.challenge_id = p_challenge_id
                  and entity.entity_type = event.entity_type
                  and entity.entity_id = event.entity_id::text
              )
              or private.uuid_or_null(event.metadata ->> 'user_id') = p_target_user_id
              or private.uuid_or_null(event.metadata ->> 'owner_id') = p_target_user_id
              or private.uuid_or_null(event.metadata ->> 'recipient_id') = p_target_user_id
              or private.uuid_or_null(event.metadata ->> 'target_user_id') = p_target_user_id
              or exists (
                select 1
                from jsonb_array_elements_text(
                  coalesce(p_support_emails, '[]'::jsonb)
                ) support_email(value)
                where support_email.value in (
                  lower(btrim(event.metadata ->> 'email')),
                  lower(btrim(event.metadata ->> 'recipient_email')),
                  lower(btrim(event.metadata ->> 'user_email')),
                  lower(btrim(event.metadata ->> 'target_email'))
                )
              )
          ), '[]'::jsonb),
          'supportEmails', coalesce(p_support_emails, '[]'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.audit_event_matches_client(
  p_actor_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb,
  p_target_user_id uuid,
  p_challenge_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_id = p_target_user_id
    or (
      p_entity_type in ('user', 'profile', 'auth_user')
      and p_entity_id = p_target_user_id
    )
    or exists (
      select 1 from private.client_purge_entity_manifest entity
      where entity.challenge_id = p_challenge_id
        and entity.entity_type = p_entity_type
        and entity.entity_id = p_entity_id::text
    )
    or private.uuid_or_null(p_metadata ->> 'user_id') = p_target_user_id
    or private.uuid_or_null(p_metadata ->> 'owner_id') = p_target_user_id
    or private.uuid_or_null(p_metadata ->> 'recipient_id') = p_target_user_id
    or private.uuid_or_null(p_metadata ->> 'target_user_id') = p_target_user_id
    or exists (
      select 1
      from private.client_purge_operations operation
      cross join lateral jsonb_array_elements_text(
        operation.support_email_manifest
      ) as support_email(value)
      where operation.challenge_id = p_challenge_id
        and support_email.value in (
          lower(btrim(p_metadata ->> 'email')),
          lower(btrim(p_metadata ->> 'recipient_email')),
          lower(btrim(p_metadata ->> 'user_email')),
          lower(btrim(p_metadata ->> 'target_email'))
        )
        and not exists (
          select 1
          from public.support_user_identities active_identity
          where active_identity.normalized_email = support_email.value
            and active_identity.valid_to is null
            and active_identity.user_id <> p_target_user_id
        )
    );
$$;

create or replace function private.client_purge_residuals(
  p_challenge_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  support_emails text[];
begin
  select * into operation from private.client_purge_operations
  where challenge_id = p_challenge_id and target_user_id = p_target_user_id;
  if not found then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(value), array[]::text[]) into support_emails
  from jsonb_array_elements_text(operation.support_email_manifest) value;

  return jsonb_build_object(
    'authUsers', (select count(*) from auth.users where id = p_target_user_id),
    'staffMemberships', (select count(*) from public.staff_members where user_id = p_target_user_id),
    'profiles', (select count(*) from public.profiles where user_id = p_target_user_id),
    'kycApplications', (select count(*) from public.kyc_applications where owner_id = p_target_user_id),
    'kycDrafts', (select count(*) from public.kyc_drafts where owner_id = p_target_user_id),
    'positions', (select count(*) from public.financial_positions where owner_id = p_target_user_id),
    'ledgerEntries', (select count(*) from public.financial_ledger_entries where owner_id = p_target_user_id),
    'loans', (select count(*) from public.loan_applications where owner_id = p_target_user_id),
    'transfers', (select count(*) from public.transfer_intents where owner_id = p_target_user_id),
    'documents', (select count(*) from public.official_documents where owner_id = p_target_user_id),
    'notifications', (select count(*) from public.notifications where recipient_id = p_target_user_id),
    'emailOutbox', (select count(*) from public.transactional_email_outbox
      where recipient_id = p_target_user_id or claimed_by = p_target_user_id),
    'pushSubscriptions', (select count(*) from public.push_subscriptions where user_id = p_target_user_id),
    'supportIdentities', (select count(*) from public.support_user_identities where user_id = p_target_user_id),
    'supportTranscripts', (
      select count(*) from public.support_transcripts transcript
      where transcript.user_id = p_target_user_id
        or (
          transcript.user_id is null
          and (
            transcript.visitor_email_normalized = any(support_emails)
            or transcript.notification_email = any(support_emails)
          )
          and not exists (
            select 1 from public.support_user_identities active_identity
            where active_identity.valid_to is null
              and active_identity.user_id <> p_target_user_id
              and active_identity.normalized_email in (
                transcript.visitor_email_normalized, transcript.notification_email
              )
          )
        )
    ),
    'supportPushDeliveries', (select count(*)
      from public.support_push_deliveries delivery
      where exists (select 1 from private.client_purge_entity_manifest entity
        where entity.challenge_id = p_challenge_id
          and entity.entity_type = 'support_push_delivery'
          and entity.entity_id = delivery.id::text)),
    'kycReviewChecklists', (select count(*)
      from public.kyc_review_checklists checklist
      where exists (select 1 from private.client_purge_entity_manifest entity
        where entity.challenge_id = p_challenge_id
          and (
            (entity.entity_type = 'kyc_review_checklist'
              and entity.entity_id = checklist.kyc_id::text)
            or (entity.entity_type = 'kyc_application'
              and entity.entity_id = checklist.kyc_id::text)
          ))),
    'loanReviewChecks', (select count(*)
      from public.loan_review_checks review
      where exists (select 1 from private.client_purge_entity_manifest entity
        where entity.challenge_id = p_challenge_id
          and (
            (entity.entity_type = 'loan_review_check'
              and entity.entity_id = review.id::text)
            or (entity.entity_type = 'loan_application'
              and entity.entity_id = review.loan_id::text)
          ))),
    'transferReviewChecks', (select count(*)
      from public.transfer_review_checks review
      where exists (select 1 from private.client_purge_entity_manifest entity
        where entity.challenge_id = p_challenge_id
          and (
            (entity.entity_type = 'transfer_review_check'
              and entity.entity_id = review.id::text)
            or (entity.entity_type = 'transfer_intent'
              and entity.entity_id = review.transfer_id::text)
          ))),
    'externalLoanFundings', (select count(*)
      from public.external_loan_fundings funding
      where exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and entity.entity_type = 'loan_application'
            and entity.entity_id = funding.loan_id::text)
        or exists (select 1 from private.client_purge_storage_manifest manifest
          where manifest.challenge_id = p_challenge_id
            and manifest.bucket = 'external-execution-evidence'
            and manifest.ownership_scope = 'relational'
            and manifest.object_path = funding.evidence_object_path)),
    'externalTransferExecutions', (select count(*)
      from public.external_transfer_executions execution
      where exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and entity.entity_type = 'transfer_intent'
            and entity.entity_id = execution.transfer_id::text)
        or exists (select 1 from private.client_purge_storage_manifest manifest
          where manifest.challenge_id = p_challenge_id
            and manifest.bucket = 'external-execution-evidence'
            and manifest.ownership_scope = 'relational'
            and manifest.object_path = execution.evidence_object_path)),
    'kycEvents', (select count(*) from public.kyc_events event
      where event.actor_id = p_target_user_id
        or exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and (
              (entity.entity_type = 'kyc_event' and entity.entity_id = event.id::text)
              or (entity.entity_type = 'kyc_application'
                and entity.entity_id = event.kyc_id::text)
            ))),
    'loanEvents', (select count(*) from public.loan_events event
      where event.actor_id = p_target_user_id
        or exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and (
              (entity.entity_type = 'loan_event' and entity.entity_id = event.id::text)
              or (entity.entity_type = 'loan_application'
                and entity.entity_id = event.loan_id::text)
            ))),
    'transferEvents', (select count(*) from public.transfer_events event
      where event.actor_id = p_target_user_id
        or exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and (
              (entity.entity_type = 'transfer_event' and entity.entity_id = event.id::text)
              or (entity.entity_type = 'transfer_intent'
                and entity.entity_id = event.transfer_id::text)
            ))),
    'auditEvents', (select count(*) from public.audit_events event
      where private.audit_event_matches_client(
        event.actor_id, event.entity_type, event.entity_id, event.metadata,
        p_target_user_id, p_challenge_id
      )),
    'storageEntriesUnverified', (select count(*)
      from private.client_purge_storage_manifest manifest
      where manifest.challenge_id = p_challenge_id
        and manifest.processing_status <> 'verified'),
    'storageScansUnfinished', (select count(*)
      from private.client_purge_storage_scan_queue queue
      where queue.challenge_id = p_challenge_id and queue.status <> 'done')
  );
end;
$$;

revoke execute on function private.refresh_client_purge_entity_manifest(uuid, uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.client_purge_scope_digest(uuid, uuid, jsonb)
from public, anon, authenticated, service_role;
revoke execute on function private.audit_event_matches_client(uuid, text, uuid, jsonb, uuid, uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.client_purge_residuals(uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function private.initialize_client_purge_storage_cycle(
  p_challenge_id uuid,
  p_cycle_stage text,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cycle_stage not in ('preview', 'storage', 'storage_sweep', 'verify') then
    raise exception 'PURGE_STORAGE_CYCLE_INVALID' using errcode = '22023';
  end if;
  delete from private.client_purge_storage_scan_queue
  where challenge_id = p_challenge_id;

  -- Relational paths are opaque ownership references, not client namespaces.
  -- Rebuild the informational preview and the authoritative pre-delete cycle
  -- from current DB rows so stale preview ownership can never cross tenants.
  -- Once the storage cycle is consumed, retain those exact paths through the
  -- delayed sweep and final verification: they are also the temporary
  -- quarantine that detects a privileged foreign reuse before trace-free
  -- completion.
  if p_cycle_stage in ('preview', 'storage') then
    delete from private.client_purge_storage_manifest
    where challenge_id = p_challenge_id
      and ownership_scope = 'relational';
  end if;

  update private.client_purge_storage_manifest
  set processing_status = 'pending', claim_token = null, claimed_at = null,
      deleted_at = null, verified_at = null
  where challenge_id = p_challenge_id;
  update private.client_purge_operations
  set storage_cycle_stage = p_cycle_stage,
      storage_phase = 'references',
      reference_after_bucket = null,
      reference_after_object_path = null,
      reference_claim_token = null,
      reference_claimed_at = null,
      verify_prefix_index = 0,
      prefix_claim_token = null,
      prefix_claimed_at = null,
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id and target_user_id = p_target_user_id;
  if not found then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function private.seed_client_purge_storage_roots(
  p_challenge_id uuid,
  p_cycle_stage text,
  p_target_user_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.client_purge_storage_scan_queue (
    challenge_id, cycle_stage, bucket, prefix
  )
  select p_challenge_id, p_cycle_stage, bucket, p_target_user_id::text
  from unnest(array[
    'upload-staging', 'kyc-evidence', 'loan-evidence', 'official-documents'
  ]) bucket
  on conflict (challenge_id, cycle_stage, bucket, prefix) do nothing;
$$;

create or replace function public.admin_claim_client_purge_storage_work(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  current_cycle_stage text;
  page_count integer;
  unsafe_count integer;
  last_bucket text;
  last_path text;
  queue_row private.client_purge_storage_scan_queue;
  token uuid;
  claimed_items jsonb;
  claimed_count integer;
  prefix_bucket text;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'INVALID_STORAGE_WORK_LIMIT' using errcode = '22023';
  end if;

  select * into operation from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and target_user_id = p_target_user_id
  for update;
  if not found then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if operation.consumed_at is null then
    if operation.status <> 'preview' or operation.expires_at <= statement_timestamp() then
      raise exception 'PURGE_PREVIEW_EXPIRED' using errcode = '22023';
    end if;
    current_cycle_stage := 'preview';
  else
    if operation.stage not in ('storage', 'storage_sweep', 'verify') then
      raise exception 'PURGE_STORAGE_STAGE_INVALID' using errcode = '55000';
    end if;
    current_cycle_stage := operation.stage;
  end if;

  if operation.storage_cycle_stage is distinct from current_cycle_stage
     or operation.storage_phase = 'idle' then
    perform private.initialize_client_purge_storage_cycle(
      p_challenge_id, current_cycle_stage, p_target_user_id
    );
    select * into operation from private.client_purge_operations
    where challenge_id = p_challenge_id;
  end if;

  if operation.storage_phase = 'references' then
    with page as materialized (
      select reference.bucket, reference.object_path,
        reference.ownership_scope, reference.ownership_valid
      from private.client_purge_storage_references(p_target_user_id) reference
      where operation.reference_after_bucket is null
         or (reference.bucket, reference.object_path) >
            (operation.reference_after_bucket, operation.reference_after_object_path)
      order by reference.bucket, reference.object_path
      limit p_limit
    ), inserted as (
      insert into private.client_purge_storage_manifest (
        challenge_id, bucket, object_path, ownership_scope, processing_status
      )
      select p_challenge_id, page.bucket, page.object_path,
        page.ownership_scope, 'pending'
      from page where page.ownership_valid is true
      on conflict (challenge_id, bucket, object_path) do update
      set ownership_scope = excluded.ownership_scope
      returning 1
    )
    select count(*),
      count(*) filter (where page.ownership_valid is not true),
      (array_agg(page.bucket order by page.bucket desc, page.object_path desc))[1],
      (array_agg(page.object_path order by page.bucket desc, page.object_path desc))[1]
    into page_count, unsafe_count, last_bucket, last_path
    from page;

    update private.client_purge_operations
    set reference_after_bucket = case when page_count = 0 then reference_after_bucket else last_bucket end,
        reference_after_object_path = case when page_count = 0 then reference_after_object_path else last_path end,
        ignored_unsafe_storage_references = case
          when current_cycle_stage = 'preview'
            then ignored_unsafe_storage_references + unsafe_count
          else ignored_unsafe_storage_references
        end,
        storage_phase = case when page_count < p_limit then 'scan' else 'references' end,
        expires_at = case when current_cycle_stage = 'preview'
          then pg_catalog.clock_timestamp() + interval '5 minutes' else expires_at end,
        retry_after = case when consumed_at is null then retry_after
          else statement_timestamp() end,
        updated_at = statement_timestamp()
    where challenge_id = p_challenge_id;
    if page_count < p_limit then
      perform private.seed_client_purge_storage_roots(
        p_challenge_id, current_cycle_stage, p_target_user_id
      );
    end if;
    return jsonb_build_object(
      'kind', 'database', 'phase', 'references', 'processed', page_count,
      'unsafeIgnored', unsafe_count,
      'complete', false
    );
  end if;

  if operation.storage_phase = 'scan' then
    update private.client_purge_storage_scan_queue
    set status = 'pending', claim_token = null, claimed_at = null,
        updated_at = statement_timestamp()
    where challenge_id = p_challenge_id and cycle_stage = current_cycle_stage
      and status = 'claimed'
      and claimed_at <= statement_timestamp() - interval '5 minutes';

    select * into queue_row
    from private.client_purge_storage_scan_queue queue
    where queue.challenge_id = p_challenge_id
      and queue.cycle_stage = current_cycle_stage
      and queue.status = 'pending'
    order by queue.id
    limit 1
    for update skip locked;
    if not found then
      if exists (
        select 1 from private.client_purge_storage_scan_queue queue
        where queue.challenge_id = p_challenge_id
          and queue.cycle_stage = current_cycle_stage and queue.status = 'claimed'
      ) then
        return jsonb_build_object('kind', 'wait', 'phase', 'scan', 'complete', false);
      end if;
      update private.client_purge_operations
      set storage_phase = case when current_cycle_stage = 'preview' then 'complete' else 'delete' end,
          retry_after = case when consumed_at is null then retry_after
            else statement_timestamp() end,
          updated_at = statement_timestamp()
      where challenge_id = p_challenge_id;
      return jsonb_build_object(
        'kind', 'database', 'phase', 'scan', 'processed', 0,
        'complete', current_cycle_stage = 'preview'
      );
    end if;
    token := gen_random_uuid();
    update private.client_purge_storage_scan_queue
    set status = 'claimed', claim_token = token, claimed_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where id = queue_row.id;
    return jsonb_build_object(
      'kind', 'scan', 'claimToken', token, 'scanId', queue_row.id,
      'bucket', queue_row.bucket, 'prefix', queue_row.prefix,
      'offset', queue_row.next_offset, 'limit', p_limit, 'complete', false
    );
  end if;

  if operation.storage_phase = 'delete' then
    -- A relational evidence key is quarantined for the lifetime of the
    -- operation. Even a privileged/legacy write must never make the Storage
    -- worker delete an object now referenced by another client's parent.
    if exists (
      select 1
      from private.client_purge_storage_manifest manifest
      join public.external_transfer_executions execution
        on execution.evidence_object_path = manifest.object_path
      join public.transfer_intents transfer on transfer.id = execution.transfer_id
      where manifest.challenge_id = p_challenge_id
        and manifest.bucket = 'external-execution-evidence'
        and manifest.ownership_scope = 'relational'
        and transfer.owner_id <> p_target_user_id
    ) or exists (
      select 1
      from private.client_purge_storage_manifest manifest
      join public.external_loan_fundings funding
        on funding.evidence_object_path = manifest.object_path
      join public.loan_applications loan on loan.id = funding.loan_id
      where manifest.challenge_id = p_challenge_id
        and manifest.bucket = 'external-execution-evidence'
        and manifest.ownership_scope = 'relational'
        and loan.owner_id <> p_target_user_id
    ) then
      raise exception 'PURGE_EVIDENCE_PATH_OWNERSHIP_CONFLICT'
        using errcode = '55000';
    end if;

    update private.client_purge_storage_manifest
    set processing_status = 'pending', claim_token = null, claimed_at = null
    where challenge_id = p_challenge_id and processing_status = 'delete_claimed'
      and claimed_at <= statement_timestamp() - interval '5 minutes';
    token := gen_random_uuid();
    with selected as (
      select manifest.bucket, manifest.object_path
      from private.client_purge_storage_manifest manifest
      where manifest.challenge_id = p_challenge_id
        and manifest.processing_status = 'pending'
      order by manifest.bucket, manifest.object_path
      limit p_limit
      for update skip locked
    ), claimed as (
      update private.client_purge_storage_manifest manifest
      set processing_status = 'delete_claimed', claim_token = token,
          claimed_at = statement_timestamp()
      from selected
      where manifest.challenge_id = p_challenge_id
        and manifest.bucket = selected.bucket
        and manifest.object_path = selected.object_path
      returning manifest.bucket, manifest.object_path, manifest.ownership_scope
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'bucket', claimed.bucket, 'objectPath', claimed.object_path,
      'ownershipScope', claimed.ownership_scope
    ) order by claimed.bucket, claimed.object_path), '[]'::jsonb), count(*)
    into claimed_items, claimed_count from claimed;
    if claimed_count = 0 then
      if exists (select 1 from private.client_purge_storage_manifest manifest
        where manifest.challenge_id = p_challenge_id
          and manifest.processing_status = 'delete_claimed') then
        return jsonb_build_object('kind', 'wait', 'phase', 'delete', 'complete', false);
      end if;
      -- Target-prefix entries are verified in one bounded prefix lookup per
      -- bucket. Exact per-object lookups are reserved for relational external
      -- evidence which lives outside the client namespace.
      update private.client_purge_storage_manifest
      set processing_status = 'verified', verified_at = pg_catalog.clock_timestamp()
      where challenge_id = p_challenge_id
        and ownership_scope = 'target_prefix'
        and processing_status = 'deleted';
      update private.client_purge_operations set storage_phase = 'verify_manifest',
        retry_after = statement_timestamp(),
        updated_at = statement_timestamp() where challenge_id = p_challenge_id;
      return jsonb_build_object('kind', 'database', 'phase', 'delete',
        'processed', 0, 'complete', false);
    end if;
    return jsonb_build_object('kind', 'delete', 'claimToken', token,
      'items', claimed_items, 'complete', false);
  end if;

  if operation.storage_phase = 'verify_manifest' then
    update private.client_purge_storage_manifest
    set processing_status = 'deleted', claim_token = null, claimed_at = null
    where challenge_id = p_challenge_id and processing_status = 'verify_claimed'
      and claimed_at <= statement_timestamp() - interval '5 minutes';
    token := gen_random_uuid();
    with selected as (
      select manifest.bucket, manifest.object_path
      from private.client_purge_storage_manifest manifest
      where manifest.challenge_id = p_challenge_id
        and manifest.processing_status = 'deleted'
        and manifest.ownership_scope = 'relational'
      order by manifest.bucket, manifest.object_path
      limit least(p_limit, 100)
      for update skip locked
    ), claimed as (
      update private.client_purge_storage_manifest manifest
      set processing_status = 'verify_claimed', claim_token = token,
          claimed_at = statement_timestamp()
      from selected
      where manifest.challenge_id = p_challenge_id
        and manifest.bucket = selected.bucket
        and manifest.object_path = selected.object_path
      returning manifest.bucket, manifest.object_path, manifest.ownership_scope
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'bucket', claimed.bucket, 'objectPath', claimed.object_path,
      'ownershipScope', claimed.ownership_scope
    ) order by claimed.bucket, claimed.object_path), '[]'::jsonb), count(*)
    into claimed_items, claimed_count from claimed;
    if claimed_count = 0 then
      if exists (select 1 from private.client_purge_storage_manifest manifest
        where manifest.challenge_id = p_challenge_id
          and manifest.processing_status = 'verify_claimed') then
        return jsonb_build_object('kind', 'wait', 'phase', 'verify_manifest', 'complete', false);
      end if;
      update private.client_purge_operations set storage_phase = 'verify_prefix',
        verify_prefix_index = 0, retry_after = statement_timestamp(),
        updated_at = statement_timestamp()
      where challenge_id = p_challenge_id;
      return jsonb_build_object('kind', 'database', 'phase', 'verify_manifest',
        'processed', 0, 'complete', false);
    end if;
    return jsonb_build_object('kind', 'verify_manifest', 'claimToken', token,
      'items', claimed_items, 'complete', false);
  end if;

  if operation.storage_phase = 'verify_prefix' then
    if operation.prefix_claim_token is not null
       and operation.prefix_claimed_at > statement_timestamp() - interval '5 minutes' then
      return jsonb_build_object('kind', 'wait', 'phase', 'verify_prefix', 'complete', false);
    end if;
    if operation.verify_prefix_index >= 4 then
      update private.client_purge_operations set storage_phase = 'complete',
        prefix_claim_token = null, prefix_claimed_at = null,
        retry_after = statement_timestamp(),
        updated_at = statement_timestamp() where challenge_id = p_challenge_id;
      return jsonb_build_object('kind', 'database', 'phase', 'verify_prefix',
        'processed', 0, 'complete', true);
    end if;
    prefix_bucket := (array[
      'upload-staging', 'kyc-evidence', 'loan-evidence', 'official-documents'
    ])[operation.verify_prefix_index + 1];
    token := gen_random_uuid();
    update private.client_purge_operations
    set prefix_claim_token = token, prefix_claimed_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where challenge_id = p_challenge_id;
    return jsonb_build_object('kind', 'verify_prefix', 'claimToken', token,
      'bucket', prefix_bucket, 'prefix', p_target_user_id::text,
      'complete', false);
  end if;

  if operation.storage_phase = 'complete' then
    return jsonb_build_object('kind', 'complete', 'phase', 'complete', 'complete', true);
  end if;
  raise exception 'PURGE_STORAGE_PHASE_INVALID' using errcode = '55000';
end;
$$;

create or replace function public.admin_ack_client_purge_storage_work(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid,
  p_claim_token uuid,
  p_kind text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  queue_row private.client_purge_storage_scan_queue;
  item jsonb;
  item_path text;
  returned_count integer;
  empty_prefix boolean;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_claim_token is null or p_kind is null
     or p_kind not in ('scan', 'delete', 'verify_manifest', 'verify_prefix')
     or p_result is null or jsonb_typeof(p_result) is distinct from 'object' then
    raise exception 'PURGE_STORAGE_ACK_INVALID' using errcode = '22023';
  end if;
  select * into operation from private.client_purge_operations
  where challenge_id = p_challenge_id and actor_id = p_actor_id
    and target_user_id = p_target_user_id for update;
  if not found then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_kind = 'scan' then
    if not (p_result ? 'objects' and p_result ? 'prefixes' and p_result ? 'returnedCount')
       or (select count(*) from jsonb_object_keys(p_result)) <> 3
       or jsonb_typeof(p_result -> 'objects') is distinct from 'array'
       or jsonb_typeof(p_result -> 'prefixes') is distinct from 'array'
       or jsonb_typeof(p_result -> 'returnedCount') is distinct from 'number' then
      raise exception 'PURGE_STORAGE_ACK_INVALID' using errcode = '22023';
    end if;
    returned_count := (p_result ->> 'returnedCount')::integer;
    if returned_count not between 0 and 1000
       or returned_count <> jsonb_array_length(p_result -> 'objects')
          + jsonb_array_length(p_result -> 'prefixes') then
      raise exception 'PURGE_STORAGE_ACK_INVALID' using errcode = '22023';
    end if;
    select * into queue_row from private.client_purge_storage_scan_queue queue
    where queue.challenge_id = p_challenge_id and queue.claim_token = p_claim_token
      and queue.status = 'claimed' for update;
    if not found then
      raise exception 'PURGE_STORAGE_CLAIM_INVALID' using errcode = '55000';
    end if;
    for item in select value from jsonb_array_elements(p_result -> 'objects') loop
      if jsonb_typeof(item) is distinct from 'string' then
        raise exception 'PURGE_STORAGE_ACK_INVALID' using errcode = '22023';
      end if;
      item_path := item #>> '{}';
      if not private.is_client_storage_object_key(item_path, p_target_user_id) then
        raise exception 'PURGE_MANIFEST_OWNERSHIP_INVALID' using errcode = '42501';
      end if;
      insert into private.client_purge_storage_manifest (
        challenge_id, bucket, object_path, ownership_scope, processing_status
      ) values (
        p_challenge_id, queue_row.bucket, item_path, 'target_prefix', 'pending'
      ) on conflict (challenge_id, bucket, object_path) do update
      set ownership_scope = 'target_prefix', processing_status = 'pending',
          claim_token = null, claimed_at = null, deleted_at = null, verified_at = null;
    end loop;
    for item in select value from jsonb_array_elements(p_result -> 'prefixes') loop
      if jsonb_typeof(item) is distinct from 'string' then
        raise exception 'PURGE_STORAGE_ACK_INVALID' using errcode = '22023';
      end if;
      item_path := item #>> '{}';
      if not private.is_client_storage_object_key(item_path || '/_', p_target_user_id) then
        raise exception 'PURGE_SCAN_PREFIX_INVALID' using errcode = '42501';
      end if;
      insert into private.client_purge_storage_scan_queue (
        challenge_id, cycle_stage, bucket, prefix
      ) values (p_challenge_id, queue_row.cycle_stage, queue_row.bucket, item_path)
      on conflict (challenge_id, cycle_stage, bucket, prefix) do nothing;
    end loop;
    update private.client_purge_storage_scan_queue
    set status = case when returned_count = 1000 then 'pending' else 'done' end,
        next_offset = case when returned_count = 1000
          then next_offset + returned_count else next_offset end,
        claim_token = null, claimed_at = null, updated_at = statement_timestamp()
    where id = queue_row.id and claim_token = p_claim_token;
  elsif p_kind = 'delete' then
    if not (p_result ? 'removed')
       or (select count(*) from jsonb_object_keys(p_result)) <> 1
       or jsonb_typeof(p_result -> 'removed') is distinct from 'boolean' then
      raise exception 'PURGE_STORAGE_ACK_INVALID' using errcode = '22023';
    end if;
    update private.client_purge_storage_manifest
    set processing_status = case when (p_result ->> 'removed')::boolean
        then 'deleted' else 'pending' end,
      claim_token = null, claimed_at = null,
      deleted_at = case when (p_result ->> 'removed')::boolean
        then pg_catalog.clock_timestamp() else deleted_at end
    where challenge_id = p_challenge_id and claim_token = p_claim_token
      and processing_status = 'delete_claimed';
    if not found then
      raise exception 'PURGE_STORAGE_CLAIM_INVALID' using errcode = '55000';
    end if;
  elsif p_kind = 'verify_manifest' then
    if not (p_result ? 'absent')
       or (select count(*) from jsonb_object_keys(p_result)) <> 1
       or jsonb_typeof(p_result -> 'absent') is distinct from 'boolean' then
      raise exception 'PURGE_STORAGE_ACK_INVALID' using errcode = '22023';
    end if;
    update private.client_purge_storage_manifest
    set processing_status = case when (p_result ->> 'absent')::boolean
        then 'verified' else 'pending' end,
      claim_token = null, claimed_at = null,
      verified_at = case when (p_result ->> 'absent')::boolean
        then pg_catalog.clock_timestamp() else null end
    where challenge_id = p_challenge_id and claim_token = p_claim_token
      and processing_status = 'verify_claimed';
    if not found then
      raise exception 'PURGE_STORAGE_CLAIM_INVALID' using errcode = '55000';
    end if;
    if not (p_result ->> 'absent')::boolean then
      update private.client_purge_operations set storage_phase = 'delete',
        updated_at = statement_timestamp() where challenge_id = p_challenge_id;
    end if;
  else
    if not (p_result ? 'empty')
       or (select count(*) from jsonb_object_keys(p_result)) <> 1
       or jsonb_typeof(p_result -> 'empty') is distinct from 'boolean'
       or operation.prefix_claim_token is distinct from p_claim_token then
      raise exception 'PURGE_STORAGE_ACK_INVALID' using errcode = '22023';
    end if;
    empty_prefix := (p_result ->> 'empty')::boolean;
    if empty_prefix then
      update private.client_purge_operations
      set verify_prefix_index = verify_prefix_index + 1,
          prefix_claim_token = null, prefix_claimed_at = null,
          updated_at = statement_timestamp()
      where challenge_id = p_challenge_id;
    else
      delete from private.client_purge_storage_scan_queue
      where challenge_id = p_challenge_id
        and cycle_stage = operation.storage_cycle_stage
        and bucket = (array[
          'upload-staging', 'kyc-evidence', 'loan-evidence', 'official-documents'
        ])[operation.verify_prefix_index + 1];
      insert into private.client_purge_storage_scan_queue (
        challenge_id, cycle_stage, bucket, prefix
      ) values (
        p_challenge_id, operation.storage_cycle_stage,
        (array['upload-staging', 'kyc-evidence', 'loan-evidence', 'official-documents'])[
          operation.verify_prefix_index + 1
        ], p_target_user_id::text
      );
      update private.client_purge_operations
      set storage_phase = 'scan', prefix_claim_token = null,
          prefix_claimed_at = null, updated_at = statement_timestamp()
      where challenge_id = p_challenge_id;
    end if;
  end if;

  update private.client_purge_operations
  set retry_after = case when consumed_at is null then retry_after
      else statement_timestamp() end,
      expires_at = case when consumed_at is null
        then pg_catalog.clock_timestamp() + interval '5 minutes' else expires_at end,
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id;
  return jsonb_build_object('acknowledged', true, 'kind', p_kind);
end;
$$;

revoke execute on function private.initialize_client_purge_storage_cycle(uuid, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.seed_client_purge_storage_roots(uuid, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.admin_claim_client_purge_storage_work(uuid, uuid, uuid, integer)
from public, anon, authenticated;
revoke execute on function public.admin_ack_client_purge_storage_work(uuid, uuid, uuid, uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.admin_claim_client_purge_storage_work(uuid, uuid, uuid, integer)
to service_role;
grant execute on function public.admin_ack_client_purge_storage_work(uuid, uuid, uuid, uuid, text, jsonb)
to service_role;

create or replace function public.admin_assert_client_purge_auth_ready(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  current_target_email text;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_target_user_id is null or p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  select * into operation from private.client_purge_operations
  where challenge_id = p_challenge_id and actor_id = p_actor_id
    and target_user_id = p_target_user_id and consumed_at is not null
  for update;
  if not found or operation.stage <> 'auth'
     or operation.storage_cycle_stage <> 'storage_sweep'
     or operation.storage_phase <> 'complete'
     or operation.sweep_not_before is null
     or operation.sweep_not_before > statement_timestamp() then
    raise exception 'PURGE_AUTH_STAGE_INVALID' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.profiles profile
    where profile.user_id = p_target_user_id and profile.access_status <> 'frozen'
  ) then
    raise exception 'PURGE_TARGET_NOT_FROZEN' using errcode = '55000';
  end if;
  select lower(btrim(users.email)) into current_target_email
  from auth.users users where users.id = p_target_user_id for update;
  if found and current_target_email is distinct from lower(btrim(operation.target_email)) then
    raise exception 'PURGE_TARGET_EMAIL_CHANGED' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'allowed', true,
    'targetEmail', operation.target_email,
    'authExists', exists (select 1 from auth.users where id = p_target_user_id)
  );
end;
$$;

revoke execute on function public.admin_assert_client_purge_auth_ready(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.admin_assert_client_purge_auth_ready(uuid, uuid, uuid)
to service_role;

create or replace function public.admin_get_client_purge_preview(
  p_actor_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
begin
  perform private.require_active_purge_admin(p_actor_id);
  select * into operation from private.client_purge_operations
  where target_user_id = p_target_user_id and status = 'preview'
  for update;
  if not found or operation.actor_id is distinct from p_actor_id then
    raise exception 'PURGE_PREVIEW_NOT_FOUND' using errcode = 'P0002';
  end if;
  if operation.expires_at <= statement_timestamp() then
    delete from private.client_purge_operations
    where challenge_id = operation.challenge_id and status = 'preview';
    return jsonb_build_object('invalidated', true, 'reason', 'expired');
  end if;
  if not exists (
    select 1 from auth.users users
    where users.id = p_target_user_id
      and users.email is not null
      and users.email = operation.target_email
  ) then
    delete from private.client_purge_operations
    where challenge_id = operation.challenge_id and status = 'preview';
    return jsonb_build_object('invalidated', true, 'reason', 'email_changed');
  end if;
  return jsonb_build_object(
    'idempotencyKey', operation.idempotency_key,
    'targetEmail', operation.target_email
  );
end;
$$;

revoke execute on function public.admin_get_client_purge_preview(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.admin_get_client_purge_preview(uuid, uuid)
to service_role;

create or replace function public.admin_list_client_purge_candidates(
  p_actor_id uuid,
  p_search text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  access_status text,
  created_at timestamptz,
  kyc_status text,
  account_count bigint,
  loan_count bigint,
  transfer_count bigint,
  document_count bigint,
  purge_status text,
  purge_stage text,
  purge_sweep_not_before timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_search text := btrim(coalesce(p_search, ''));
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_limit is null or p_offset is null
     or p_limit not between 1 and 50 or p_offset not between 0 and 100000
     or char_length(normalized_search) > 100 then
    raise exception 'INVALID_CLIENT_PAGE' using errcode = '22023';
  end if;

  return query
  with sources as (
    select users.id, users.email,
      users.raw_user_meta_data, users.created_at, false as auth_deleted
    from auth.users users
    where users.email is not null
      and not exists (
        select 1 from public.staff_members staff where staff.user_id = users.id
      )
    union all
    select operation.target_user_id, operation.target_email,
      '{}'::jsonb, operation.created_at, true
    from private.client_purge_operations operation
    where operation.consumed_at is not null
      and not exists (select 1 from auth.users users
        where users.id = operation.target_user_id)
      and not exists (select 1 from public.staff_members staff
        where staff.user_id = operation.target_user_id)
  )
  select
    source.id,
    source.email::text,
    coalesce(
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(source.raw_user_meta_data ->> 'full_name'), ''),
      split_part(source.email, '@', 1)
    )::text,
    case when source.auth_deleted then 'auth_deleted'
      else coalesce(profile.access_status, 'missing') end::text,
    source.created_at,
    latest_kyc.status::text,
    (select count(*) from public.financial_positions fp where fp.owner_id = source.id),
    (select count(*) from public.loan_applications loan where loan.owner_id = source.id),
    (select count(*) from public.transfer_intents transfer where transfer.owner_id = source.id),
    (select count(*) from public.official_documents document where document.owner_id = source.id),
    purge.status::text,
    purge.stage::text,
    purge.sweep_not_before,
    count(*) over ()
  from sources source
  left join public.profiles profile on profile.user_id = source.id
  left join lateral (
    select application.status from public.kyc_applications application
    where application.owner_id = source.id
    order by application.submitted_at desc limit 1
  ) latest_kyc on true
  left join private.client_purge_operations purge
    on purge.target_user_id = source.id
  where normalized_search = ''
    or coalesce(profile.display_name, '') ilike '%' || normalized_search || '%'
    or source.email ilike '%' || normalized_search || '%'
  order by source.created_at desc, source.id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_list_pending_client_purges(
  p_limit integer default 20
)
returns table (
  challenge_id uuid,
  actor_id uuid,
  target_user_id uuid,
  challenge_digest text,
  target_email_digest text,
  idempotency_key uuid,
  stage text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'INVALID_SWEEP_LIMIT' using errcode = '22023';
  end if;
  delete from private.client_purge_operations
  where status = 'preview' and expires_at <= statement_timestamp();

  return query
  with candidates as (
    select operation.challenge_id, resume_admin.user_id as actor_id
    from private.client_purge_operations operation
    cross join lateral (
      select staff.user_id from public.staff_members staff
      join auth.users users on users.id = staff.user_id
      where staff.role = 'admin' and staff.active
      order by (staff.user_id = operation.actor_id) desc, staff.user_id limit 1
    ) resume_admin
    where operation.consumed_at is not null
      and not exists (select 1 from public.staff_members target_staff
        where target_staff.user_id = operation.target_user_id)
      and (
        (operation.status = 'waiting_sweep'
          and operation.sweep_not_before <= statement_timestamp())
        or (operation.status in ('running', 'failed')
          and operation.retry_after <= statement_timestamp())
      )
      and (operation.stage in ('auth', 'verify') or not exists (
        select 1 from public.profiles profile
        where profile.user_id = operation.target_user_id
          and profile.access_status <> 'frozen'
      ))
    order by operation.updated_at
    limit p_limit for update skip locked
  )
  update private.client_purge_operations operation
  set actor_id = candidates.actor_id,
      status = 'running',
      stage = case when operation.stage = 'waiting_sweep'
        then 'storage_sweep' else operation.stage end,
      retry_after = statement_timestamp() + interval '5 minutes',
      updated_at = statement_timestamp()
  from candidates where operation.challenge_id = candidates.challenge_id
  returning operation.challenge_id, operation.actor_id,
    operation.target_user_id, operation.challenge_digest,
    operation.target_email_digest, operation.idempotency_key, operation.stage;
end;
$$;

-- The branch-manager approval path is the concurrency regression sentinel: it
-- takes the owner shared lock before its first FOR UPDATE, then rechecks the row.
create or replace function public.branch_manager_approve_loan(
  p_loan_id uuid,
  p_note text default null
)
returns public.loan_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  owner_id uuid;
  loan_row public.loan_applications;
  old_status text;
  completed_check_count integer;
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select loan.owner_id into owner_id from public.loan_applications loan
  where loan.id = p_loan_id;
  if not found then
    raise exception 'LOAN_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform private.lock_client_mutation(owner_id);
  select * into loan_row from public.loan_applications
  where id = p_loan_id for update;
  if not found then
    raise exception 'LOAN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if loan_row.owner_id is distinct from owner_id then
    raise exception 'LOAN_OWNER_CHANGED' using errcode = '40001';
  end if;
  if loan_row.status not in ('submitted', 'under_review') then
    raise exception 'LOAN_CANNOT_BE_APPROVED' using errcode = '55000';
  end if;
  old_status := loan_row.status;
  update public.loan_review_checks
  set status = 'completed', reviewer_id = caller_id, reviewed_at = now(),
      note = coalesce(normalized_note,
        'Contrôles internes confirmés par le chef d’agence.')
  where loan_id = p_loan_id;
  select count(*) into completed_check_count from public.loan_review_checks
  where loan_id = p_loan_id and status = 'completed';
  if completed_check_count <> 4 then
    raise exception 'LOAN_REVIEW_CHECKS_INCOMPLETE' using errcode = '23514';
  end if;
  update public.loan_applications set status = 'approved_for_external_funding'
  where id = p_loan_id returning * into loan_row;
  insert into public.loan_events (
    loan_id, actor_id, event_type, from_status, to_status, reason
  ) values (
    p_loan_id, caller_id, 'branch_manager_approved', old_status,
    loan_row.status, normalized_note
  );
  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    caller_id, 'branch_manager_approve_loan', 'loan_application', p_loan_id,
    jsonb_build_object('from_status', old_status, 'to_status', loan_row.status)
  );
  insert into public.notifications (
    recipient_id, title, message, notification_type
  ) values (
    loan_row.owner_id, 'Prêt validé',
    'Le chef d’agence a validé votre demande de prêt. Le décaissement reste effectué en interne avant son enregistrement dans Monalyz.',
    'loan'
  );
  return loan_row;
end;
$$;

revoke execute on function public.admin_list_client_purge_candidates(uuid, text, integer, integer)
from public, anon, authenticated;
revoke execute on function public.admin_prepare_client_purge(uuid, uuid, text, text, text, uuid)
from public, anon, authenticated;
revoke execute on function public.admin_begin_client_purge(uuid, uuid, uuid, text, text, uuid)
from public, anon, authenticated;
revoke execute on function public.admin_resume_client_purge(uuid, uuid, text)
from public, anon, authenticated;
revoke execute on function public.admin_mark_client_purge_stage(uuid, uuid, text, text)
from public, anon, authenticated;
drop function public.admin_store_client_purge_manifest(uuid, uuid, uuid, jsonb);
revoke execute on function public.admin_get_client_purge_status(uuid, uuid)
from public, anon, authenticated;
drop function public.admin_client_purge_storage_paths(uuid, uuid, uuid, text, integer, text, text);
revoke execute on function public.admin_purge_client_relational_data(uuid, uuid, uuid)
from public, anon, authenticated;
revoke execute on function public.admin_finalize_client_purge(uuid, uuid, uuid)
from public, anon, authenticated;
revoke execute on function public.admin_list_pending_client_purges(integer)
from public, anon, authenticated;

grant execute on function public.admin_list_client_purge_candidates(uuid, text, integer, integer)
to service_role;
grant execute on function public.admin_prepare_client_purge(uuid, uuid, text, text, text, uuid)
to service_role;
grant execute on function public.admin_begin_client_purge(uuid, uuid, uuid, text, text, uuid)
to service_role;
grant execute on function public.admin_resume_client_purge(uuid, uuid, text)
to service_role;
grant execute on function public.admin_mark_client_purge_stage(uuid, uuid, text, text)
to service_role;
grant execute on function public.admin_get_client_purge_status(uuid, uuid)
to service_role;
grant execute on function public.admin_purge_client_relational_data(uuid, uuid, uuid)
to service_role;
grant execute on function public.admin_finalize_client_purge(uuid, uuid, uuid)
to service_role;
grant execute on function public.admin_list_pending_client_purges(integer)
to service_role;
