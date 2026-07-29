-- Official documents are immutable declarations issued by an active branch
-- manager from data already recorded in Monalyz. Rendering remains a server
-- concern and never contacts a banking API.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.official_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.profiles(user_id) on delete restrict,
  account_id uuid
    references public.financial_positions(id) on delete restrict,
  transfer_id uuid
    references public.transfer_intents(id) on delete restrict,
  loan_id uuid
    references public.loan_applications(id) on delete restrict,
  document_number text not null unique
    check (char_length(document_number) between 6 and 80),
  document_type text not null
    check (
      document_type in (
        'bank_details',
        'account_statement',
        'balance_certificate',
        'transfer_confirmation',
        'loan_disbursement_confirmation',
        'loan_decision'
      )
    ),
  title text not null check (char_length(title) between 3 and 200),
  language text not null default 'fr'
    check (language in ('fr', 'en', 'de', 'es')),
  period_start date,
  period_end date,
  version integer not null default 1 check (version > 0),
  status text not null default 'pending'
    check (status in ('pending', 'issued', 'failed', 'revoked')),
  snapshot jsonb not null
    check (jsonb_typeof(snapshot) = 'object'),
  snapshot_hash text not null
    check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  content_hash text
    check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  storage_path text
    check (
      storage_path is null
      or (
        char_length(storage_path) between 10 and 500
        and storage_path !~ '(^|/)\.\.(/|$)'
      )
    ),
  issued_by uuid not null
    references public.staff_members(user_id) on delete restrict,
  requested_at timestamptz not null default now(),
  issued_at timestamptz,
  revoked_by uuid
    references public.staff_members(user_id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text
    check (
      revocation_reason is null
      or char_length(revocation_reason) between 3 and 1000
    ),
  failure_reason text
    check (
      failure_reason is null
      or char_length(failure_reason) between 3 and 1000
    ),
  is_demo boolean not null default false,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key),
  check (
    (
      document_type in (
        'bank_details',
        'account_statement',
        'balance_certificate'
      )
      and account_id is not null
      and transfer_id is null
      and loan_id is null
    )
    or (
      document_type = 'transfer_confirmation'
      and account_id is not null
      and transfer_id is not null
      and loan_id is null
    )
    or (
      document_type = 'loan_disbursement_confirmation'
      and account_id is not null
      and transfer_id is null
      and loan_id is not null
    )
    or (
      document_type = 'loan_decision'
      and transfer_id is null
      and loan_id is not null
    )
  ),
  check (
    (
      document_type = 'account_statement'
      and period_start is not null
      and period_end is not null
      and period_end >= period_start
      and period_end <= period_start + 366
    )
    or (
      document_type <> 'account_statement'
      and period_start is null
      and period_end is null
    )
  ),
  check (
    (
      status = 'pending'
      and storage_path is null
      and content_hash is null
      and issued_at is null
      and failure_reason is null
      and revoked_by is null
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      status = 'issued'
      and storage_path is not null
      and content_hash is not null
      and issued_at is not null
      and failure_reason is null
      and revoked_by is null
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      status = 'failed'
      and storage_path is null
      and content_hash is null
      and issued_at is null
      and failure_reason is not null
      and revoked_by is null
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      status = 'revoked'
      and storage_path is not null
      and content_hash is not null
      and issued_at is not null
      and failure_reason is null
      and revoked_by is not null
      and revoked_at is not null
      and revocation_reason is not null
    )
  )
);

create index if not exists official_documents_owner_created_idx
  on public.official_documents (owner_id, created_at desc);

create index if not exists official_documents_account_created_idx
  on public.official_documents (account_id, created_at desc)
  where account_id is not null;

create index if not exists official_documents_transfer_idx
  on public.official_documents (transfer_id)
  where transfer_id is not null;

create index if not exists official_documents_loan_idx
  on public.official_documents (loan_id)
  where loan_id is not null;

create index if not exists official_documents_issued_by_idx
  on public.official_documents (issued_by);

create index if not exists official_documents_pending_idx
  on public.official_documents (requested_at)
  where status = 'pending';

create trigger official_documents_set_updated_at
before update on public.official_documents
for each row execute function private.set_updated_at();

create or replace function private.protect_official_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_catalog.current_setting(
      'monalyz.allow_official_document_maintenance',
      true
    ) is distinct from 'on' then
      raise exception 'OFFICIAL_DOCUMENT_RETENTION_REQUIRED'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if new.owner_id <> old.owner_id
     or new.account_id is distinct from old.account_id
     or new.transfer_id is distinct from old.transfer_id
     or new.loan_id is distinct from old.loan_id
     or new.document_number <> old.document_number
     or new.document_type <> old.document_type
     or new.title <> old.title
     or new.language <> old.language
     or new.period_start is distinct from old.period_start
     or new.period_end is distinct from old.period_end
     or new.version <> old.version
     or new.snapshot <> old.snapshot
     or new.snapshot_hash <> old.snapshot_hash
     or new.issued_by <> old.issued_by
     or new.requested_at <> old.requested_at
     or new.is_demo <> old.is_demo
     or new.idempotency_key <> old.idempotency_key
     or new.created_at <> old.created_at then
    raise exception 'OFFICIAL_DOCUMENT_SNAPSHOT_IS_IMMUTABLE'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_official_document()
from public, anon, authenticated, service_role;

create trigger official_documents_protect_update
before update on public.official_documents
for each row execute function private.protect_official_document();

create trigger official_documents_protect_delete
before delete on public.official_documents
for each row execute function private.protect_official_document();

alter table public.official_documents enable row level security;

create policy official_documents_select_own_or_admin
on public.official_documents
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_active_staff(array['admin']))
);

revoke all on table public.official_documents
from public, anon, authenticated, service_role;
grant select on table public.official_documents
to authenticated, service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'official-documents',
  'official-documents',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy official_documents_storage_select_own_or_admin
on storage.objects
for select
to authenticated
using (
  bucket_id = 'official-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_active_staff(array['admin']))
  )
);

create or replace function public.branch_manager_issue_official_document(
  p_owner_id uuid,
  p_account_id uuid,
  p_transfer_id uuid,
  p_loan_id uuid,
  p_document_type text,
  p_title text,
  p_language text,
  p_period_start date,
  p_period_end date,
  p_idempotency_key uuid
)
returns public.official_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  existing_document public.official_documents;
  document_row public.official_documents;
  account_row public.financial_positions;
  transfer_row public.transfer_intents;
  loan_row public.loan_applications;
  document_snapshot jsonb;
  document_id uuid := gen_random_uuid();
  generated_number text;
  generated_version integer;
  document_is_demo boolean := false;
  normalized_title text := nullif(trim(coalesce(p_title, '')), '');
  normalized_language text := lower(trim(coalesce(p_language, '')));
begin
  if p_idempotency_key is null
     or normalized_title is null
     or normalized_language not in ('fr', 'en', 'de', 'es')
     or p_document_type not in (
       'bank_details',
       'account_statement',
       'balance_certificate',
       'transfer_confirmation',
       'loan_disbursement_confirmation',
       'loan_decision'
     ) then
    raise exception 'INVALID_OFFICIAL_DOCUMENT_REQUEST'
      using errcode = '22023';
  end if;

  select *
  into existing_document
  from public.official_documents
  where owner_id = p_owner_id
    and idempotency_key = p_idempotency_key;

  if found then
    if existing_document.account_id is distinct from p_account_id
       or existing_document.transfer_id is distinct from p_transfer_id
       or existing_document.loan_id is distinct from p_loan_id
       or existing_document.document_type <> p_document_type
       or existing_document.title <> normalized_title
       or existing_document.language <> normalized_language
       or existing_document.period_start is distinct from p_period_start
       or existing_document.period_end is distinct from p_period_end then
      raise exception 'DOCUMENT_IDEMPOTENCY_PAYLOAD_MISMATCH'
        using errcode = '22023';
    end if;

    return existing_document;
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = p_owner_id
      and access_status = 'active'
  ) then
    raise exception 'DOCUMENT_OWNER_NOT_ACTIVE' using errcode = '22023';
  end if;

  if p_account_id is not null then
    select *
    into account_row
    from public.financial_positions
    where id = p_account_id
      and owner_id = p_owner_id;

    if not found then
      raise exception 'DOCUMENT_ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;

    if account_row.account_status <> 'active' then
      raise exception 'DOCUMENT_ACCOUNT_NOT_ACTIVE' using errcode = '55000';
    end if;

    document_is_demo := account_row.is_demo;
  end if;

  if p_transfer_id is not null then
    select *
    into transfer_row
    from public.transfer_intents
    where id = p_transfer_id
      and owner_id = p_owner_id;

    if not found then
      raise exception 'DOCUMENT_TRANSFER_NOT_FOUND' using errcode = 'P0002';
    end if;

    if transfer_row.status <> 'external_settlement_confirmed'
       or transfer_row.source_position_id is distinct from p_account_id then
      raise exception 'DOCUMENT_TRANSFER_NOT_FINAL'
        using errcode = '55000';
    end if;
  end if;

  if p_loan_id is not null then
    select *
    into loan_row
    from public.loan_applications
    where id = p_loan_id
      and owner_id = p_owner_id;

    if not found then
      raise exception 'DOCUMENT_LOAN_NOT_FOUND' using errcode = 'P0002';
    end if;

    if p_document_type = 'loan_disbursement_confirmation'
       and (
         loan_row.status <> 'external_settlement_confirmed'
         or loan_row.credited_position_id is distinct from p_account_id
       ) then
      raise exception 'DOCUMENT_LOAN_NOT_DISBURSED'
        using errcode = '55000';
    end if;

    if p_document_type = 'loan_decision'
       and loan_row.status in ('submitted', 'under_review') then
      raise exception 'DOCUMENT_LOAN_DECISION_NOT_FINAL'
        using errcode = '55000';
    end if;
  end if;

  if p_document_type in (
    'bank_details',
    'account_statement',
    'balance_certificate'
  ) and (
    p_account_id is null
    or p_transfer_id is not null
    or p_loan_id is not null
  ) then
    raise exception 'DOCUMENT_ACCOUNT_SOURCE_REQUIRED'
      using errcode = '22023';
  end if;

  if p_document_type = 'transfer_confirmation'
     and (
       p_account_id is null
       or p_transfer_id is null
       or p_loan_id is not null
     ) then
    raise exception 'DOCUMENT_TRANSFER_SOURCE_REQUIRED'
      using errcode = '22023';
  end if;

  if p_document_type = 'loan_disbursement_confirmation'
     and (
       p_account_id is null
       or p_transfer_id is not null
       or p_loan_id is null
     ) then
    raise exception 'DOCUMENT_LOAN_DISBURSEMENT_SOURCE_REQUIRED'
      using errcode = '22023';
  end if;

  if p_document_type = 'loan_decision'
     and (p_transfer_id is not null or p_loan_id is null) then
    raise exception 'DOCUMENT_LOAN_DECISION_SOURCE_REQUIRED'
      using errcode = '22023';
  end if;

  if p_document_type = 'account_statement' then
    if p_period_start is null
       or p_period_end is null
       or p_period_end < p_period_start
       or p_period_end > p_period_start + 366 then
      raise exception 'INVALID_STATEMENT_PERIOD' using errcode = '22023';
    end if;
  elsif p_period_start is not null or p_period_end is not null then
    raise exception 'DOCUMENT_PERIOD_NOT_ALLOWED' using errcode = '22023';
  end if;

  document_snapshot := jsonb_strip_nulls(
    jsonb_build_object(
      'schemaVersion', 1,
      'documentType', p_document_type,
      'title', normalized_title,
      'language', normalized_language,
      'ownerId', p_owner_id,
      'account',
      case
        when p_account_id is null then null
        else jsonb_build_object(
          'id', account_row.id,
          'label', account_row.label,
          'accountType', account_row.account_type,
          'accountNumber', account_row.account_number,
          'iban', account_row.iban,
          'bic', account_row.bic,
          'holderName', account_row.account_holder_name,
          'institutionName', account_row.institution_name,
          'branchName', account_row.branch_name,
          'branchCode', account_row.branch_code,
          'currency', account_row.currency,
          'balanceMinor', account_row.amount_minor,
          'availableBalanceMinor',
            account_row.amount_minor - account_row.reserved_minor,
          'asOf', account_row.as_of,
          'openedAt', account_row.opened_at,
          'isDemo', account_row.is_demo
        )
      end,
      'transfer',
      case
        when p_transfer_id is null then null
        else jsonb_build_object(
          'id', transfer_row.id,
          'reference', transfer_row.internal_execution_reference,
          'recipientName', transfer_row.recipient_name,
          'recipientAccountMasked', transfer_row.recipient_account_masked,
          'amountMinor', transfer_row.amount_minor,
          'currency', transfer_row.currency,
          'targetAmountMinor', transfer_row.target_amount_minor,
          'targetCurrency', transfer_row.target_currency,
          'settledAt', transfer_row.settled_at
        )
      end,
      'loan',
      case
        when p_loan_id is null then null
        else jsonb_build_object(
          'id', loan_row.id,
          'reference', loan_row.reference,
          'disbursementReference',
            loan_row.internal_disbursement_reference,
          'requestedAmountMinor', loan_row.requested_amount_minor,
          'currency', loan_row.currency,
          'durationMonths', loan_row.duration_months,
          'annualRate', loan_row.indicative_annual_rate,
          'status', loan_row.status,
          'disbursedAt', loan_row.disbursed_at
        )
      end,
      'periodStart', p_period_start,
      'periodEnd', p_period_end,
      'entries',
      case
        when p_document_type <> 'account_statement' then null
        else coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', entry.id,
                'entryKind', entry.entry_kind,
                'amountMinor', entry.amount_minor,
                'balanceAfterMinor', entry.balance_after_minor,
                'currency', entry.currency,
                'description', entry.description,
                'internalReference', entry.internal_reference,
                'valueDate', entry.value_date,
                'bookedAt', entry.booked_at
              )
              order by entry.value_date, entry.sequence_no
            )
            from public.financial_ledger_entries as entry
            where entry.account_id = p_account_id
              and entry.value_date >= p_period_start::timestamptz
              and entry.value_date
                < (p_period_end + 1)::timestamptz
          ),
          '[]'::jsonb
        )
      end,
      'demo',
      case
        when document_is_demo then jsonb_build_object(
          'isDemo', true,
          'watermark', 'DÉMONSTRATION — AUCUNE VALEUR'
        )
        else null
      end,
      'issuedBy', caller_id,
      'requestedAt', now()
    )
  );

  select coalesce(max(version), 0) + 1
  into generated_version
  from public.official_documents
  where owner_id = p_owner_id
    and document_type = p_document_type
    and account_id is not distinct from p_account_id
    and transfer_id is not distinct from p_transfer_id
    and loan_id is not distinct from p_loan_id;

  generated_number :=
    'MON-'
    || to_char(now(), 'YYYY')
    || '-'
    || upper(replace(document_id::text, '-', ''));

  insert into public.official_documents (
    id,
    owner_id,
    account_id,
    transfer_id,
    loan_id,
    document_number,
    document_type,
    title,
    language,
    period_start,
    period_end,
    version,
    status,
    snapshot,
    snapshot_hash,
    issued_by,
    is_demo,
    idempotency_key
  )
  values (
    document_id,
    p_owner_id,
    p_account_id,
    p_transfer_id,
    p_loan_id,
    generated_number,
    p_document_type,
    normalized_title,
    normalized_language,
    p_period_start,
    p_period_end,
    generated_version,
    'pending',
    document_snapshot,
    encode(
      extensions.digest(
        convert_to(document_snapshot::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    caller_id,
    document_is_demo,
    p_idempotency_key
  )
  returning * into document_row;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    caller_id,
    'branch_manager_issue_official_document',
    'official_document',
    document_row.id,
    jsonb_build_object(
      'document_number', document_row.document_number,
      'document_type', document_row.document_type,
      'version', document_row.version,
      'snapshot_hash', document_row.snapshot_hash,
      'is_demo', document_row.is_demo
    )
  );

  return document_row;
end;
$$;

create or replace function public.complete_official_document(
  p_document_id uuid,
  p_storage_path text,
  p_content_hash text,
  p_succeeded boolean,
  p_error text
)
returns public.official_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_role text := coalesce((select auth.jwt() ->> 'role'), '');
  document_row public.official_documents;
  normalized_path text := nullif(trim(coalesce(p_storage_path, '')), '');
  normalized_hash text := lower(trim(coalesce(p_content_hash, '')));
  normalized_error text := nullif(trim(coalesce(p_error, '')), '');
begin
  if worker_role <> 'service_role' then
    raise exception 'OFFICIAL_DOCUMENT_WORKER_PERMISSION_REQUIRED'
      using errcode = '42501';
  end if;

  select *
  into document_row
  from public.official_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'OFFICIAL_DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if document_row.status = 'issued'
     and p_succeeded
     and document_row.storage_path = normalized_path
     and document_row.content_hash = normalized_hash then
    return document_row;
  end if;

  if document_row.status not in ('pending', 'failed') then
    raise exception 'OFFICIAL_DOCUMENT_NOT_COMPLETABLE'
      using errcode = '55000';
  end if;

  if p_succeeded then
    if normalized_path is null
       or normalized_hash !~ '^[a-f0-9]{64}$'
       or normalized_path !~ '\.pdf$'
       or normalized_path not like document_row.owner_id::text || '/%'
       or normalized_path ~ '(^|/)\.\.(/|$)' then
      raise exception 'INVALID_OFFICIAL_DOCUMENT_ARTIFACT'
        using errcode = '22023';
    end if;

    update public.official_documents
    set
      status = 'issued',
      storage_path = normalized_path,
      content_hash = normalized_hash,
      issued_at = now(),
      failure_reason = null
    where id = p_document_id
    returning * into document_row;

    insert into public.notifications (
      recipient_id,
      title,
      message,
      notification_type
    )
    values (
      document_row.owner_id,
      'Document officiel disponible',
      'Votre document officiel Monalyz est disponible dans votre espace.',
      'info'
    );
  else
    if normalized_error is null then
      raise exception 'OFFICIAL_DOCUMENT_ERROR_REQUIRED'
        using errcode = '22023';
    end if;

    update public.official_documents
    set
      status = 'failed',
      storage_path = null,
      content_hash = null,
      issued_at = null,
      failure_reason = left(normalized_error, 1000)
    where id = p_document_id
    returning * into document_row;
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    null,
    case
      when p_succeeded then 'complete_official_document'
      else 'fail_official_document'
    end,
    'official_document',
    document_row.id,
    jsonb_build_object(
      'status', document_row.status,
      'content_hash', document_row.content_hash,
      'storage_path', document_row.storage_path
    )
  );

  return document_row;
end;
$$;

create or replace function public.branch_manager_revoke_official_document(
  p_document_id uuid,
  p_reason text
)
returns public.official_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  document_row public.official_documents;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if normalized_reason is null then
    raise exception 'DOCUMENT_REVOCATION_REASON_REQUIRED'
      using errcode = '22023';
  end if;

  select *
  into document_row
  from public.official_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'OFFICIAL_DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if document_row.status <> 'issued' then
    raise exception 'OFFICIAL_DOCUMENT_NOT_REVOCABLE'
      using errcode = '55000';
  end if;

  update public.official_documents
  set
    status = 'revoked',
    revoked_by = caller_id,
    revoked_at = now(),
    revocation_reason = normalized_reason
  where id = p_document_id
  returning * into document_row;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    caller_id,
    'branch_manager_revoke_official_document',
    'official_document',
    document_row.id,
    jsonb_build_object(
      'document_number', document_row.document_number,
      'reason', normalized_reason
    )
  );

  return document_row;
end;
$$;

revoke execute on function public.branch_manager_issue_official_document(
  uuid, uuid, uuid, uuid, text, text, text, date, date, uuid
)
from public, anon;
grant execute on function public.branch_manager_issue_official_document(
  uuid, uuid, uuid, uuid, text, text, text, date, date, uuid
)
to authenticated, service_role;

revoke execute on function public.complete_official_document(
  uuid, text, text, boolean, text
)
from public, anon, authenticated;
grant execute on function public.complete_official_document(
  uuid, text, text, boolean, text
)
to service_role;

revoke execute on function public.branch_manager_revoke_official_document(
  uuid, text
)
from public, anon;
grant execute on function public.branch_manager_revoke_official_document(
  uuid, text
)
to authenticated, service_role;

-- Demo account enrichment is additive. The legacy provisioner keeps its
-- identity and exact-count guarantees; these triggers attach a validated,
-- explicitly synthetic and non-routable account plus three pending documents.
create or replace function private.prepare_demo_financial_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_admin_id uuid;
  owner_email text;
  owner_metadata jsonb;
begin
  if new.id <> uuid 'd3000000-0000-4000-8000-000000000003' then
    return new;
  end if;

  select
    lower(coalesce(email, '')),
    coalesce(raw_app_meta_data, '{}'::jsonb)
  into owner_email, owner_metadata
  from auth.users
  where id = new.owner_id;

  if not found
     or owner_email <> 'client.demo@monalyz.com'
     or owner_metadata ->> 'monalyz_demo' <> 'true'
     or owner_metadata ->> 'demo_role' <> 'client' then
    raise exception 'INVALID_DEMO_BANK_ACCOUNT_OWNER'
      using errcode = '23514';
  end if;

  select user_record.id
  into demo_admin_id
  from auth.users as user_record
  join public.staff_members as staff
    on staff.user_id = user_record.id
  where lower(coalesce(user_record.email, '')) = 'admin.demo@monalyz.com'
    and user_record.raw_app_meta_data ->> 'monalyz_demo' = 'true'
    and user_record.raw_app_meta_data ->> 'demo_role' = 'admin'
    and staff.role = 'admin'
    and staff.active
  limit 1;

  if demo_admin_id is null then
    raise exception 'DEMO_BRANCH_MANAGER_REQUIRED'
      using errcode = '23514';
  end if;

  new.account_number := 'DEMO-EUR-000001';
  new.iban := 'FR5299999999990000000000100';
  new.bic := 'DEMOFRP1XXX';
  new.account_holder_name := 'Client Démo Monalyz';
  new.institution_name := 'Monalyz Démonstration — non routable';
  new.branch_name := 'Agence Démonstration';
  new.branch_code := 'DEMO-001';
  new.account_status := 'active';
  new.opened_at := coalesce(
    new.opened_at,
    timestamptz '2026-01-01 00:00:00+00'
  );
  new.declared_by := demo_admin_id;
  new.is_demo := true;

  return new;
end;
$$;

revoke execute on function private.prepare_demo_financial_position()
from public, anon, authenticated, service_role;

create trigger financial_positions_prepare_demo_account
before insert or update on public.financial_positions
for each row execute function private.prepare_demo_financial_position();

create or replace function private.ensure_demo_banking_artifacts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_admin_id uuid := new.declared_by;
  common_snapshot jsonb;
  document_snapshot jsonb;
begin
  if new.id <> uuid 'd3000000-0000-4000-8000-000000000003'
     or not new.is_demo then
    return new;
  end if;

  if not exists (
    select 1
    from public.financial_ledger_entries
    where account_id = new.id
  ) then
    insert into public.financial_ledger_entries (
      account_id,
      owner_id,
      sequence_no,
      entry_key,
      entry_kind,
      amount_minor,
      currency,
      balance_before_minor,
      balance_after_minor,
      value_date,
      internal_reference,
      booked_by,
      description,
      metadata
    )
    values (
      new.id,
      new.owner_id,
      1,
      'demo:account-opening',
      'account_opening',
      new.amount_minor,
      new.currency,
      0,
      new.amount_minor,
      new.opened_at,
      'DEMO-OPENING-0001',
      demo_admin_id,
      'Solde synthétique d’ouverture — aucune valeur réelle.',
      jsonb_build_object('demo', true, 'synthetic', true)
    );
  end if;

  common_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'ownerId', new.owner_id,
    'account', jsonb_build_object(
      'id', new.id,
      'label', new.label,
      'accountType', new.account_type,
      'accountNumber', new.account_number,
      'iban', new.iban,
      'bic', new.bic,
      'holderName', new.account_holder_name,
      'institutionName', new.institution_name,
      'branchName', new.branch_name,
      'branchCode', new.branch_code,
      'currency', new.currency,
      'balanceMinor', new.amount_minor,
      'asOf', new.as_of,
      'openedAt', new.opened_at,
      'isDemo', true
    ),
    'demo', jsonb_build_object(
      'isDemo', true,
      'synthetic', true,
      'routable', false,
      'watermark', 'DÉMONSTRATION — AUCUNE VALEUR'
    ),
    'issuedBy', demo_admin_id
  );

  for document_snapshot in
    select jsonb_build_object(
      'id', fixture.id,
      'idempotencyKey', fixture.idempotency_key,
      'documentNumber', fixture.document_number,
      'documentType', fixture.document_type,
      'title', fixture.title,
      'periodStart', fixture.period_start,
      'periodEnd', fixture.period_end,
      'snapshot', common_snapshot || jsonb_build_object(
        'documentType', fixture.document_type,
        'title', fixture.title,
        'periodStart', fixture.period_start,
        'periodEnd', fixture.period_end,
        'entries',
        case
          when fixture.document_type = 'account_statement' then (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', entry.id,
                  'entryKind', entry.entry_kind,
                  'amountMinor', entry.amount_minor,
                  'balanceAfterMinor', entry.balance_after_minor,
                  'currency', entry.currency,
                  'description', entry.description,
                  'internalReference', entry.internal_reference,
                  'valueDate', entry.value_date,
                  'bookedAt', entry.booked_at
                )
                order by entry.value_date, entry.sequence_no
              ),
              '[]'::jsonb
            )
            from public.financial_ledger_entries as entry
            where entry.account_id = new.id
          )
          else null
        end
      )
    )
    from (
      values
        (
          uuid 'd3000000-0000-4000-8000-000000000004',
          uuid 'd3000000-0000-4000-8000-000000000007',
          'DEMO-RIB-0001'::text,
          'bank_details'::text,
          'RIB de démonstration'::text,
          null::date,
          null::date
        ),
        (
          uuid 'd3000000-0000-4000-8000-000000000005',
          uuid 'd3000000-0000-4000-8000-000000000008',
          'DEMO-STATEMENT-0001'::text,
          'account_statement'::text,
          'Relevé de compte de démonstration'::text,
          date '2026-01-01',
          date '2026-12-31'
        ),
        (
          uuid 'd3000000-0000-4000-8000-000000000006',
          uuid 'd3000000-0000-4000-8000-000000000009',
          'DEMO-BALANCE-0001'::text,
          'balance_certificate'::text,
          'Attestation de solde de démonstration'::text,
          null::date,
          null::date
        )
    ) as fixture(
      id,
      idempotency_key,
      document_number,
      document_type,
      title,
      period_start,
      period_end
    )
  loop
    if exists (
      select 1
      from public.official_documents
      where id = (document_snapshot ->> 'id')::uuid
        and (
          owner_id <> new.owner_id
          or account_id is distinct from new.id
          or not is_demo
        )
    ) then
      raise exception 'DEMO_OFFICIAL_DOCUMENT_ID_COLLISION'
        using errcode = '23505';
    end if;

    insert into public.official_documents (
      id,
      owner_id,
      account_id,
      document_number,
      document_type,
      title,
      language,
      period_start,
      period_end,
      version,
      status,
      snapshot,
      snapshot_hash,
      issued_by,
      is_demo,
      idempotency_key
    )
    values (
      (document_snapshot ->> 'id')::uuid,
      new.owner_id,
      new.id,
      document_snapshot ->> 'documentNumber',
      document_snapshot ->> 'documentType',
      document_snapshot ->> 'title',
      'fr',
      (document_snapshot ->> 'periodStart')::date,
      (document_snapshot ->> 'periodEnd')::date,
      1,
      'pending',
      document_snapshot -> 'snapshot',
      encode(
        extensions.digest(
          convert_to((document_snapshot -> 'snapshot')::text, 'UTF8'),
          'sha256'
        ),
        'hex'
      ),
      demo_admin_id,
      true,
      (document_snapshot ->> 'idempotencyKey')::uuid
    )
    on conflict (id) do nothing;
  end loop;

  return new;
end;
$$;

revoke execute on function private.ensure_demo_banking_artifacts()
from public, anon, authenticated, service_role;

create trigger financial_positions_ensure_demo_banking_artifacts
after insert or update on public.financial_positions
for each row execute function private.ensure_demo_banking_artifacts();

-- Enrich an already-provisioned demo fixture. On a fresh project, the same
-- triggers run when provision_demo_accounts creates the deterministic row.
update public.financial_positions
set is_demo = true
where id = uuid 'd3000000-0000-4000-8000-000000000003';
