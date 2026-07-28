-- KALY secure workflow foundation.
--
-- Product invariant: KALY is not connected to any bank. Financial operations
-- are initiated and reviewed here, executed outside the application, then
-- manually evidenced and confirmed by two distinct staff members.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  phone text,
  preferred_currency text not null default 'EUR'
    check (preferred_currency ~ '^[A-Z]{3}$'),
  access_status text not null default 'active'
    check (access_status in ('active', 'frozen')),
  access_status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx on public.profiles (lower(email));

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null
    check (role in ('reviewer', 'operator', 'supervisor', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_positions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position_kind text not null default 'declared'
    check (position_kind in ('declared', 'internally_reconciled')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null default 0
    check (amount_minor >= 0 and amount_minor <= 1000000000000000),
  reserved_minor bigint not null default 0
    check (reserved_minor >= 0 and reserved_minor <= amount_minor),
  as_of timestamptz not null default now(),
  external_identifier_masked text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);

create index financial_positions_owner_idx
  on public.financial_positions (owner_id);

create table public.transfer_intents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  source_position_id uuid not null references public.financial_positions(id),
  idempotency_key uuid not null,
  recipient_name text not null check (char_length(recipient_name) between 1 and 160),
  recipient_account_masked text not null
    check (char_length(recipient_account_masked) between 1 and 160),
  beneficiary_details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(beneficiary_details) = 'object'),
  transfer_type text not null
    check (transfer_type in ('canada', 'eurozone', 'usa', 'swiss', 'uk', 'latam', 'africa')),
  amount_minor bigint not null
    check (amount_minor > 0 and amount_minor <= 1000000000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  target_amount_minor bigint not null
    check (target_amount_minor > 0 and target_amount_minor <= 1000000000000000),
  target_currency text not null check (target_currency ~ '^[A-Z]{3}$'),
  quote_rate numeric(24, 12) not null check (quote_rate > 0),
  quote_as_of timestamptz not null,
  motive text check (motive is null or char_length(motive) <= 500),
  status text not null default 'submitted'
    check (
      status in (
        'submitted',
        'under_review',
        'approved_for_external_execution',
        'external_execution_recorded',
        'external_settlement_confirmed',
        'rejected',
        'cancelled',
        'external_failed'
      )
    ),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (owner_id, idempotency_key)
);

create index transfer_intents_owner_created_idx
  on public.transfer_intents (owner_id, submitted_at desc);
create index transfer_intents_active_review_idx
  on public.transfer_intents (submitted_at)
  where status in ('submitted', 'under_review', 'approved_for_external_execution', 'external_execution_recorded');

create table public.transfer_review_checks (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.transfer_intents(id) on delete cascade,
  check_kind text not null
    check (check_kind in ('dual_review', 'escalation', 'compliance', 'final_authorization')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'failed')),
  reviewer_id uuid references public.staff_members(user_id),
  note text check (note is null or char_length(note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transfer_id, check_kind)
);

create index transfer_review_checks_transfer_idx
  on public.transfer_review_checks (transfer_id);

create table public.external_transfer_executions (
  transfer_id uuid primary key references public.transfer_intents(id) on delete restrict,
  external_reference text not null
    check (char_length(external_reference) between 3 and 160),
  evidence_object_path text not null
    check (char_length(evidence_object_path) between 3 and 500),
  execution_note text check (execution_note is null or char_length(execution_note) <= 1000),
  executed_by uuid not null references public.staff_members(user_id),
  executed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  confirmed_by uuid references public.staff_members(user_id),
  confirmed_at timestamptz,
  confirmation_note text check (confirmation_note is null or char_length(confirmation_note) <= 1000),
  check (confirmed_by is null or confirmed_by <> executed_by),
  check (
    (confirmed_by is null and confirmed_at is null)
    or (confirmed_by is not null and confirmed_at is not null)
  )
);

create unique index external_transfer_reference_idx
  on public.external_transfer_executions (external_reference);

create table public.transfer_events (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.transfer_intents(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  from_status text,
  to_status text,
  reason text check (reason is null or char_length(reason) <= 1000),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index transfer_events_transfer_created_idx
  on public.transfer_events (transfer_id, created_at);

create table public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  idempotency_key uuid not null,
  reference text not null unique,
  requested_amount_minor bigint not null
    check (requested_amount_minor > 0 and requested_amount_minor <= 1000000000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  duration_months integer not null check (duration_months between 1 and 600),
  indicative_monthly_payment_minor bigint
    check (indicative_monthly_payment_minor is null or indicative_monthly_payment_minor > 0),
  indicative_annual_rate numeric(8, 5)
    check (indicative_annual_rate is null or indicative_annual_rate >= 0),
  motive text not null check (char_length(motive) between 1 and 500),
  document_object_paths jsonb not null
    check (jsonb_typeof(document_object_paths) = 'array'),
  status text not null default 'submitted'
    check (
      status in (
        'submitted',
        'under_review',
        'approved_for_external_funding',
        'external_funding_recorded',
        'external_settlement_confirmed',
        'rejected',
        'cancelled',
        'external_failed'
      )
    ),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (owner_id, idempotency_key)
);

create index loan_applications_owner_created_idx
  on public.loan_applications (owner_id, submitted_at desc);
create index loan_applications_active_review_idx
  on public.loan_applications (submitted_at)
  where status in ('submitted', 'under_review', 'approved_for_external_funding', 'external_funding_recorded');

create table public.loan_review_checks (
  id bigint generated always as identity primary key,
  loan_id uuid not null references public.loan_applications(id) on delete cascade,
  check_kind text not null
    check (check_kind in ('dual_review', 'escalation', 'compliance', 'final_authorization')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'failed')),
  reviewer_id uuid references public.staff_members(user_id),
  note text check (note is null or char_length(note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loan_id, check_kind)
);

create index loan_review_checks_loan_idx
  on public.loan_review_checks (loan_id);

create table public.external_loan_fundings (
  loan_id uuid primary key references public.loan_applications(id) on delete restrict,
  external_reference text not null
    check (char_length(external_reference) between 3 and 160),
  evidence_object_path text not null
    check (char_length(evidence_object_path) between 3 and 500),
  execution_note text check (execution_note is null or char_length(execution_note) <= 1000),
  executed_by uuid not null references public.staff_members(user_id),
  executed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  confirmed_by uuid references public.staff_members(user_id),
  confirmed_at timestamptz,
  confirmation_note text check (confirmation_note is null or char_length(confirmation_note) <= 1000),
  check (confirmed_by is null or confirmed_by <> executed_by),
  check (
    (confirmed_by is null and confirmed_at is null)
    or (confirmed_by is not null and confirmed_at is not null)
  )
);

create unique index external_loan_funding_reference_idx
  on public.external_loan_fundings (external_reference);

create table public.loan_events (
  id bigint generated always as identity primary key,
  loan_id uuid not null references public.loan_applications(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  from_status text,
  to_status text,
  reason text check (reason is null or char_length(reason) <= 1000),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index loan_events_loan_created_idx
  on public.loan_events (loan_id, created_at);

create table public.kyc_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  idempotency_key uuid not null,
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  date_of_birth date not null check (date_of_birth <= current_date - interval '18 years'),
  place_of_birth text not null check (char_length(place_of_birth) between 1 and 160),
  nationality text not null check (char_length(nationality) between 1 and 100),
  address jsonb not null check (jsonb_typeof(address) = 'object'),
  occupation text not null check (char_length(occupation) between 1 and 100),
  income_range text not null check (char_length(income_range) between 1 and 100),
  fatca boolean not null,
  pep boolean not null,
  document_object_paths jsonb not null
    check (jsonb_typeof(document_object_paths) = 'object'),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'rejected', 'needs_information')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.staff_members(user_id),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (owner_id, idempotency_key)
);

create index kyc_applications_owner_created_idx
  on public.kyc_applications (owner_id, submitted_at desc);
create index kyc_applications_review_queue_idx
  on public.kyc_applications (submitted_at)
  where status in ('submitted', 'under_review', 'needs_information');

create table public.kyc_events (
  id bigint generated always as identity primary key,
  kyc_id uuid not null references public.kyc_applications(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  from_status text,
  to_status text,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);

create index kyc_events_kyc_created_idx
  on public.kyc_events (kyc_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 1000),
  notification_type text not null
    check (notification_type in ('info', 'success', 'alert', 'transfer', 'loan', 'kyc')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_events_entity_created_idx
  on public.audit_events (entity_type, entity_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'version' then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger staff_members_set_updated_at
before update on public.staff_members
for each row execute function private.set_updated_at();

create trigger financial_positions_set_updated_at
before update on public.financial_positions
for each row execute function private.set_updated_at();

create trigger transfer_intents_set_updated_at
before update on public.transfer_intents
for each row execute function private.set_updated_at();

create trigger transfer_review_checks_set_updated_at
before update on public.transfer_review_checks
for each row execute function private.set_updated_at();

create trigger loan_applications_set_updated_at
before update on public.loan_applications
for each row execute function private.set_updated_at();

create trigger loan_review_checks_set_updated_at
before update on public.loan_review_checks
for each row execute function private.set_updated_at();

create trigger kyc_applications_set_updated_at
before update on public.kyc_applications
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.is_active_staff(required_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members
    where user_id = (select auth.uid())
      and active
      and (required_roles is null or role = any(required_roles))
  );
$$;

revoke execute on function private.is_active_staff(text[]) from public, anon, authenticated, service_role;

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

  if not exists (
    select 1
    from public.profiles
    where user_id = caller_id and access_status = 'active'
  ) then
    raise exception 'ACCOUNT_ACCESS_RESTRICTED' using errcode = '42501';
  end if;

  return caller_id;
end;
$$;

revoke execute on function private.ensure_active_user() from public, anon, authenticated, service_role;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case when active then role else 'user' end
      from public.staff_members
      where user_id = (select auth.uid())
    ),
    'user'
  );
$$;

create or replace function public.submit_transfer_intent(
  p_source_position_id uuid,
  p_recipient_name text,
  p_recipient_account_masked text,
  p_beneficiary_details jsonb,
  p_transfer_type text,
  p_amount_minor bigint,
  p_currency text,
  p_target_amount_minor bigint,
  p_target_currency text,
  p_quote_rate numeric,
  p_quote_as_of timestamptz,
  p_motive text,
  p_idempotency_key uuid
)
returns public.transfer_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  position_row public.financial_positions;
  transfer_row public.transfer_intents;
begin
  if p_amount_minor <= 0 or p_target_amount_minor <= 0 or p_quote_rate <= 0 then
    raise exception 'INVALID_TRANSFER_AMOUNT' using errcode = '22023';
  end if;

  select *
  into position_row
  from public.financial_positions
  where id = p_source_position_id and owner_id = caller_id
  for update;

  if not found then
    raise exception 'SOURCE_POSITION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if position_row.currency <> upper(p_currency) then
    raise exception 'SOURCE_CURRENCY_MISMATCH' using errcode = '22023';
  end if;

  insert into public.transfer_intents (
    owner_id,
    source_position_id,
    idempotency_key,
    recipient_name,
    recipient_account_masked,
    beneficiary_details,
    transfer_type,
    amount_minor,
    currency,
    target_amount_minor,
    target_currency,
    quote_rate,
    quote_as_of,
    motive
  )
  values (
    caller_id,
    p_source_position_id,
    p_idempotency_key,
    trim(p_recipient_name),
    trim(p_recipient_account_masked),
    coalesce(p_beneficiary_details, '{}'::jsonb),
    p_transfer_type,
    p_amount_minor,
    upper(p_currency),
    p_target_amount_minor,
    upper(p_target_currency),
    p_quote_rate,
    p_quote_as_of,
    nullif(trim(coalesce(p_motive, '')), '')
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning * into transfer_row;

  if transfer_row.id is null then
    select *
    into transfer_row
    from public.transfer_intents
    where owner_id = caller_id and idempotency_key = p_idempotency_key;
    return transfer_row;
  end if;

  if position_row.amount_minor - position_row.reserved_minor < p_amount_minor then
    raise exception 'INSUFFICIENT_INTERNAL_AVAILABLE_AMOUNT' using errcode = '22003';
  end if;

  update public.financial_positions
  set reserved_minor = reserved_minor + p_amount_minor
  where id = p_source_position_id;

  insert into public.transfer_review_checks (transfer_id, check_kind)
  select transfer_row.id, check_kind
  from unnest(array['dual_review', 'escalation', 'compliance', 'final_authorization']) as check_kind;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, to_status, metadata
  )
  values (
    transfer_row.id,
    caller_id,
    'submitted',
    'submitted',
    jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    caller_id,
    'Instruction enregistrée',
    'Votre instruction a été enregistrée pour contrôle. Aucun transfert bancaire n’a encore été exécuté.',
    'transfer'
  );

  return transfer_row;
end;
$$;

create or replace function public.review_transfer_check(
  p_transfer_id uuid,
  p_check_kind text,
  p_status text,
  p_note text default null
)
returns public.transfer_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  transfer_row public.transfer_intents;
  old_status text;
  next_status text;
begin
  if caller_id is null or not private.is_active_staff(array['reviewer', 'operator', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_check_kind not in ('dual_review', 'escalation', 'compliance', 'final_authorization')
     or p_status not in ('pending', 'in_progress', 'completed', 'failed') then
    raise exception 'INVALID_REVIEW_VALUE' using errcode = '22023';
  end if;

  select *
  into transfer_row
  from public.transfer_intents
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if transfer_row.status not in ('submitted', 'under_review') then
    raise exception 'TRANSFER_NOT_REVIEWABLE' using errcode = '55000';
  end if;

  old_status := transfer_row.status;

  update public.transfer_review_checks
  set
    status = p_status,
    reviewer_id = caller_id,
    note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_at = case when p_status in ('completed', 'failed') then now() else null end
  where transfer_id = p_transfer_id and check_kind = p_check_kind;

  if p_status = 'failed' then
    next_status := 'under_review';
  elsif not exists (
    select 1
    from public.transfer_review_checks
    where transfer_id = p_transfer_id and status <> 'completed'
  ) then
    if (
      select count(distinct reviewer_id)
      from public.transfer_review_checks
      where transfer_id = p_transfer_id and status = 'completed'
    ) < 2 then
      raise exception 'TWO_DISTINCT_REVIEWERS_REQUIRED' using errcode = '42501';
    end if;
    next_status := 'approved_for_external_execution';
  else
    next_status := 'under_review';
  end if;

  update public.transfer_intents
  set status = next_status
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason, metadata
  )
  values (
    p_transfer_id,
    caller_id,
    'review_check_updated',
    old_status,
    next_status,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('check_kind', p_check_kind, 'check_status', p_status)
  );

  return transfer_row;
end;
$$;

create or replace function public.transition_transfer(
  p_transfer_id uuid,
  p_action text,
  p_reason text default null,
  p_external_reference text default null,
  p_evidence_object_path text default null,
  p_executed_at timestamptz default null
)
returns public.transfer_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  transfer_row public.transfer_intents;
  old_status text;
  next_status text;
  executor_id uuid;
begin
  if caller_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select *
  into transfer_row
  from public.transfer_intents
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;

  old_status := transfer_row.status;

  if p_action = 'cancel' then
    if caller_id <> transfer_row.owner_id
       or old_status not in ('submitted', 'under_review', 'approved_for_external_execution') then
      raise exception 'TRANSFER_CANNOT_BE_CANCELLED' using errcode = '42501';
    end if;
    next_status := 'cancelled';
    update public.financial_positions
    set reserved_minor = reserved_minor - transfer_row.amount_minor
    where id = transfer_row.source_position_id;

  elsif p_action = 'reject' then
    if not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
      raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status not in ('submitted', 'under_review', 'approved_for_external_execution') then
      raise exception 'TRANSFER_CANNOT_BE_REJECTED' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'REJECTION_REASON_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'rejected';
    update public.financial_positions
    set reserved_minor = reserved_minor - transfer_row.amount_minor
    where id = transfer_row.source_position_id;

  elsif p_action = 'record_external_execution' then
    if not private.is_active_staff(array['operator', 'supervisor', 'admin']) then
      raise exception 'OPERATOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'approved_for_external_execution' then
      raise exception 'TRANSFER_NOT_APPROVED_FOR_EXTERNAL_EXECUTION' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_external_reference, '')), '') is null
       or nullif(trim(coalesce(p_evidence_object_path, '')), '') is null
       or p_executed_at is null then
      raise exception 'EXTERNAL_EXECUTION_EVIDENCE_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'external_execution_recorded';
    insert into public.external_transfer_executions (
      transfer_id,
      external_reference,
      evidence_object_path,
      execution_note,
      executed_by,
      executed_at
    )
    values (
      p_transfer_id,
      trim(p_external_reference),
      trim(p_evidence_object_path),
      nullif(trim(coalesce(p_reason, '')), ''),
      caller_id,
      p_executed_at
    );

  elsif p_action = 'confirm_external_settlement' then
    if not private.is_active_staff(array['supervisor', 'admin']) then
      raise exception 'SUPERVISOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'external_execution_recorded' then
      raise exception 'EXTERNAL_EXECUTION_NOT_RECORDED' using errcode = '55000';
    end if;

    select executed_by
    into executor_id
    from public.external_transfer_executions
    where transfer_id = p_transfer_id
    for update;

    if executor_id = caller_id then
      raise exception 'SECOND_STAFF_MEMBER_REQUIRED' using errcode = '42501';
    end if;

    next_status := 'external_settlement_confirmed';

    update public.external_transfer_executions
    set
      confirmed_by = caller_id,
      confirmed_at = now(),
      confirmation_note = nullif(trim(coalesce(p_reason, '')), '')
    where transfer_id = p_transfer_id;

    update public.financial_positions
    set
      amount_minor = amount_minor - transfer_row.amount_minor,
      reserved_minor = reserved_minor - transfer_row.amount_minor,
      position_kind = 'internally_reconciled',
      as_of = now()
    where id = transfer_row.source_position_id;

  elsif p_action = 'mark_external_failed' then
    if not private.is_active_staff(array['operator', 'supervisor', 'admin']) then
      raise exception 'OPERATOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'external_execution_recorded' then
      raise exception 'EXTERNAL_EXECUTION_NOT_RECORDED' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'FAILURE_REASON_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'external_failed';
    update public.financial_positions
    set reserved_minor = reserved_minor - transfer_row.amount_minor
    where id = transfer_row.source_position_id;

  else
    raise exception 'INVALID_TRANSFER_ACTION' using errcode = '22023';
  end if;

  update public.transfer_intents
  set status = next_status
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_transfer_id,
    caller_id,
    p_action,
    old_status,
    next_status,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    p_action,
    'transfer_intent',
    p_transfer_id,
    jsonb_build_object('from_status', old_status, 'to_status', next_status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    transfer_row.owner_id,
    'Instruction mise à jour',
    case next_status
      when 'approved_for_external_execution' then 'Votre instruction est autorisée pour traitement hors application. Aucun mouvement bancaire n’est encore confirmé.'
      when 'external_execution_recorded' then 'Une exécution externe a été déclarée et reste en attente d’un second contrôle.'
      when 'external_settlement_confirmed' then 'Le règlement externe a été confirmé manuellement sur justificatif.'
      when 'rejected' then 'Votre instruction a été rejetée. Aucun mouvement bancaire n’a été effectué par KALY.'
      when 'cancelled' then 'Votre instruction a été annulée avant confirmation externe.'
      else 'L’exécution externe a été signalée en échec.'
    end,
    'transfer'
  );

  return transfer_row;
end;
$$;

create or replace function public.submit_loan_application(
  p_requested_amount_minor bigint,
  p_currency text,
  p_duration_months integer,
  p_indicative_monthly_payment_minor bigint,
  p_indicative_annual_rate numeric,
  p_motive text,
  p_document_object_paths jsonb,
  p_idempotency_key uuid
)
returns public.loan_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  loan_row public.loan_applications;
  generated_reference text;
begin
  if p_document_object_paths is null
     or jsonb_typeof(p_document_object_paths) <> 'array'
     or jsonb_array_length(p_document_object_paths) = 0 then
    raise exception 'LOAN_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;

  generated_reference := 'KALY-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(p_idempotency_key::text, '-', ''), 1, 8));

  insert into public.loan_applications (
    owner_id,
    idempotency_key,
    reference,
    requested_amount_minor,
    currency,
    duration_months,
    indicative_monthly_payment_minor,
    indicative_annual_rate,
    motive,
    document_object_paths
  )
  values (
    caller_id,
    p_idempotency_key,
    generated_reference,
    p_requested_amount_minor,
    upper(p_currency),
    p_duration_months,
    p_indicative_monthly_payment_minor,
    p_indicative_annual_rate,
    trim(p_motive),
    p_document_object_paths
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning * into loan_row;

  if loan_row.id is null then
    select *
    into loan_row
    from public.loan_applications
    where owner_id = caller_id and idempotency_key = p_idempotency_key;
    return loan_row;
  end if;

  insert into public.loan_review_checks (loan_id, check_kind)
  select loan_row.id, check_kind
  from unnest(array['dual_review', 'escalation', 'compliance', 'final_authorization']) as check_kind;

  insert into public.loan_events (loan_id, actor_id, event_type, to_status)
  values (loan_row.id, caller_id, 'submitted', 'submitted');

  insert into public.notifications (recipient_id, title, message, notification_type)
  values (
    caller_id,
    'Demande enregistrée',
    'Votre demande a été enregistrée pour étude. La simulation n’est ni une offre de crédit ni une promesse de versement.',
    'loan'
  );

  return loan_row;
end;
$$;

create or replace function public.review_loan_check(
  p_loan_id uuid,
  p_check_kind text,
  p_status text,
  p_note text default null
)
returns public.loan_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  loan_row public.loan_applications;
  old_status text;
  next_status text;
begin
  if caller_id is null or not private.is_active_staff(array['reviewer', 'operator', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_check_kind not in ('dual_review', 'escalation', 'compliance', 'final_authorization')
     or p_status not in ('pending', 'in_progress', 'completed', 'failed') then
    raise exception 'INVALID_REVIEW_VALUE' using errcode = '22023';
  end if;

  select *
  into loan_row
  from public.loan_applications
  where id = p_loan_id
  for update;

  if not found then
    raise exception 'LOAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  if loan_row.status not in ('submitted', 'under_review') then
    raise exception 'LOAN_NOT_REVIEWABLE' using errcode = '55000';
  end if;

  old_status := loan_row.status;

  update public.loan_review_checks
  set
    status = p_status,
    reviewer_id = caller_id,
    note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_at = case when p_status in ('completed', 'failed') then now() else null end
  where loan_id = p_loan_id and check_kind = p_check_kind;

  if p_status = 'failed' then
    next_status := 'under_review';
  elsif not exists (
    select 1
    from public.loan_review_checks
    where loan_id = p_loan_id and status <> 'completed'
  ) then
    if (
      select count(distinct reviewer_id)
      from public.loan_review_checks
      where loan_id = p_loan_id and status = 'completed'
    ) < 2 then
      raise exception 'TWO_DISTINCT_REVIEWERS_REQUIRED' using errcode = '42501';
    end if;
    next_status := 'approved_for_external_funding';
  else
    next_status := 'under_review';
  end if;

  update public.loan_applications
  set status = next_status
  where id = p_loan_id
  returning * into loan_row;

  insert into public.loan_events (
    loan_id, actor_id, event_type, from_status, to_status, reason, metadata
  )
  values (
    p_loan_id,
    caller_id,
    'review_check_updated',
    old_status,
    next_status,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('check_kind', p_check_kind, 'check_status', p_status)
  );

  return loan_row;
end;
$$;

create or replace function public.transition_loan(
  p_loan_id uuid,
  p_action text,
  p_reason text default null,
  p_external_reference text default null,
  p_evidence_object_path text default null,
  p_executed_at timestamptz default null
)
returns public.loan_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  loan_row public.loan_applications;
  old_status text;
  next_status text;
  executor_id uuid;
begin
  if caller_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select *
  into loan_row
  from public.loan_applications
  where id = p_loan_id
  for update;

  if not found then
    raise exception 'LOAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  old_status := loan_row.status;

  if p_action = 'cancel' then
    if caller_id <> loan_row.owner_id
       or old_status not in ('submitted', 'under_review', 'approved_for_external_funding') then
      raise exception 'LOAN_CANNOT_BE_CANCELLED' using errcode = '42501';
    end if;
    next_status := 'cancelled';

  elsif p_action = 'reject' then
    if not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
      raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status not in ('submitted', 'under_review', 'approved_for_external_funding') then
      raise exception 'LOAN_CANNOT_BE_REJECTED' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'REJECTION_REASON_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'rejected';

  elsif p_action = 'record_external_funding' then
    if not private.is_active_staff(array['operator', 'supervisor', 'admin']) then
      raise exception 'OPERATOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'approved_for_external_funding' then
      raise exception 'LOAN_NOT_APPROVED_FOR_EXTERNAL_FUNDING' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_external_reference, '')), '') is null
       or nullif(trim(coalesce(p_evidence_object_path, '')), '') is null
       or p_executed_at is null then
      raise exception 'EXTERNAL_FUNDING_EVIDENCE_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'external_funding_recorded';
    insert into public.external_loan_fundings (
      loan_id,
      external_reference,
      evidence_object_path,
      execution_note,
      executed_by,
      executed_at
    )
    values (
      p_loan_id,
      trim(p_external_reference),
      trim(p_evidence_object_path),
      nullif(trim(coalesce(p_reason, '')), ''),
      caller_id,
      p_executed_at
    );

  elsif p_action = 'confirm_external_settlement' then
    if not private.is_active_staff(array['supervisor', 'admin']) then
      raise exception 'SUPERVISOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'external_funding_recorded' then
      raise exception 'EXTERNAL_FUNDING_NOT_RECORDED' using errcode = '55000';
    end if;

    select executed_by
    into executor_id
    from public.external_loan_fundings
    where loan_id = p_loan_id
    for update;

    if executor_id = caller_id then
      raise exception 'SECOND_STAFF_MEMBER_REQUIRED' using errcode = '42501';
    end if;

    next_status := 'external_settlement_confirmed';
    update public.external_loan_fundings
    set
      confirmed_by = caller_id,
      confirmed_at = now(),
      confirmation_note = nullif(trim(coalesce(p_reason, '')), '')
    where loan_id = p_loan_id;

  elsif p_action = 'mark_external_failed' then
    if not private.is_active_staff(array['operator', 'supervisor', 'admin']) then
      raise exception 'OPERATOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'external_funding_recorded' then
      raise exception 'EXTERNAL_FUNDING_NOT_RECORDED' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'FAILURE_REASON_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'external_failed';

  else
    raise exception 'INVALID_LOAN_ACTION' using errcode = '22023';
  end if;

  update public.loan_applications
  set status = next_status
  where id = p_loan_id
  returning * into loan_row;

  insert into public.loan_events (
    loan_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_loan_id,
    caller_id,
    p_action,
    old_status,
    next_status,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    p_action,
    'loan_application',
    p_loan_id,
    jsonb_build_object('from_status', old_status, 'to_status', next_status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    loan_row.owner_id,
    'Demande mise à jour',
    case next_status
      when 'approved_for_external_funding' then 'Votre dossier est autorisé pour traitement externe. Aucun versement n’est encore confirmé.'
      when 'external_funding_recorded' then 'Un versement externe a été déclaré et reste en attente d’un second contrôle.'
      when 'external_settlement_confirmed' then 'Le versement externe a été confirmé manuellement sur justificatif.'
      when 'rejected' then 'Votre demande a été rejetée. Aucun versement n’a été effectué par KALY.'
      when 'cancelled' then 'Votre demande a été annulée avant confirmation externe.'
      else 'Le versement externe a été signalé en échec.'
    end,
    'loan'
  );

  return loan_row;
end;
$$;

create or replace function public.submit_kyc_application(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_place_of_birth text,
  p_nationality text,
  p_address jsonb,
  p_occupation text,
  p_income_range text,
  p_fatca boolean,
  p_pep boolean,
  p_document_object_paths jsonb,
  p_idempotency_key uuid
)
returns public.kyc_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  kyc_row public.kyc_applications;
begin
  insert into public.kyc_applications (
    owner_id,
    idempotency_key,
    first_name,
    last_name,
    date_of_birth,
    place_of_birth,
    nationality,
    address,
    occupation,
    income_range,
    fatca,
    pep,
    document_object_paths
  )
  values (
    caller_id,
    p_idempotency_key,
    trim(p_first_name),
    trim(p_last_name),
    p_date_of_birth,
    trim(p_place_of_birth),
    trim(p_nationality),
    p_address,
    trim(p_occupation),
    trim(p_income_range),
    p_fatca,
    p_pep,
    p_document_object_paths
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning * into kyc_row;

  if kyc_row.id is null then
    select *
    into kyc_row
    from public.kyc_applications
    where owner_id = caller_id and idempotency_key = p_idempotency_key;
    return kyc_row;
  end if;

  insert into public.kyc_events (kyc_id, actor_id, event_type, to_status)
  values (kyc_row.id, caller_id, 'submitted', 'submitted');

  insert into public.notifications (recipient_id, title, message, notification_type)
  values (
    caller_id,
    'Dossier d’identité enregistré',
    'Votre dossier a été transmis pour contrôle humain. Son approbation ne crée ni compte bancaire ni IBAN.',
    'kyc'
  );

  return kyc_row;
end;
$$;

create or replace function public.review_kyc_application(
  p_kyc_id uuid,
  p_status text,
  p_note text
)
returns public.kyc_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  kyc_row public.kyc_applications;
  old_status text;
begin
  if caller_id is null or not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_status not in ('under_review', 'approved', 'rejected', 'needs_information') then
    raise exception 'INVALID_KYC_STATUS' using errcode = '22023';
  end if;

  select *
  into kyc_row
  from public.kyc_applications
  where id = p_kyc_id
  for update;

  if not found then
    raise exception 'KYC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if kyc_row.status in ('approved', 'rejected') then
    raise exception 'KYC_ALREADY_FINAL' using errcode = '55000';
  end if;

  if p_status in ('rejected', 'needs_information')
     and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'REVIEW_NOTE_REQUIRED' using errcode = '22023';
  end if;

  old_status := kyc_row.status;

  update public.kyc_applications
  set
    status = p_status,
    reviewed_by = caller_id,
    reviewed_at = case when p_status in ('approved', 'rejected') then now() else null end,
    review_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_kyc_id
  returning * into kyc_row;

  insert into public.kyc_events (
    kyc_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_kyc_id,
    caller_id,
    'reviewed',
    old_status,
    p_status,
    nullif(trim(coalesce(p_note, '')), '')
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'review_kyc',
    'kyc_application',
    p_kyc_id,
    jsonb_build_object('from_status', old_status, 'to_status', p_status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    kyc_row.owner_id,
    'Dossier d’identité mis à jour',
    case p_status
      when 'approved' then 'Votre identité a été approuvée dans KALY. Cette approbation ne crée ni compte bancaire ni IBAN.'
      when 'rejected' then 'Votre dossier d’identité a été rejeté. Consultez le motif pour le corriger.'
      when 'needs_information' then 'Des informations complémentaires sont nécessaires pour poursuivre le contrôle.'
      else 'Votre dossier est en cours de contrôle humain.'
    end,
    'kyc'
  );

  return kyc_row;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = (select auth.uid());
$$;

create or replace function public.set_user_access_status(
  p_user_id uuid,
  p_status text,
  p_reason text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  profile_row public.profiles;
begin
  if caller_id is null or not private.is_active_staff(array['admin']) then
    raise exception 'ADMIN_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if p_status not in ('active', 'frozen') then
    raise exception 'INVALID_ACCESS_STATUS' using errcode = '22023';
  end if;
  if p_status = 'frozen' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'FREEZE_REASON_REQUIRED' using errcode = '22023';
  end if;

  update public.profiles
  set
    access_status = p_status,
    access_status_reason = case
      when p_status = 'frozen' then trim(p_reason)
      else null
    end
  where user_id = p_user_id
  returning * into profile_row;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'set_access_status',
    'profile',
    p_user_id,
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  return profile_row;
end;
$$;

create or replace function public.record_financial_position(
  p_owner_id uuid,
  p_label text,
  p_currency text,
  p_amount_minor bigint,
  p_as_of timestamptz,
  p_external_identifier_masked text,
  p_reason text
)
returns public.financial_positions
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  position_row public.financial_positions;
begin
  if caller_id is null or not private.is_active_staff(array['supervisor', 'admin']) then
    raise exception 'SUPERVISOR_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if p_amount_minor < 0 or p_as_of is null then
    raise exception 'INVALID_POSITION_VALUE' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'RECONCILIATION_REASON_REQUIRED' using errcode = '22023';
  end if;

  insert into public.financial_positions (
    owner_id,
    label,
    position_kind,
    currency,
    amount_minor,
    as_of,
    external_identifier_masked
  )
  values (
    p_owner_id,
    trim(p_label),
    'internally_reconciled',
    upper(p_currency),
    p_amount_minor,
    p_as_of,
    nullif(trim(coalesce(p_external_identifier_masked, '')), '')
  )
  returning * into position_row;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'record_financial_position',
    'financial_position',
    position_row.id,
    jsonb_build_object(
      'amount_minor', p_amount_minor,
      'currency', upper(p_currency),
      'as_of', p_as_of,
      'reason', p_reason
    )
  );

  return position_row;
end;
$$;

create or replace function public.adjust_financial_position(
  p_position_id uuid,
  p_delta_minor bigint,
  p_as_of timestamptz,
  p_reason text
)
returns public.financial_positions
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  position_row public.financial_positions;
begin
  if caller_id is null or not private.is_active_staff(array['supervisor', 'admin']) then
    raise exception 'SUPERVISOR_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if p_delta_minor = 0 or p_as_of is null then
    raise exception 'INVALID_ADJUSTMENT_VALUE' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'ADJUSTMENT_REASON_REQUIRED' using errcode = '22023';
  end if;

  select *
  into position_row
  from public.financial_positions
  where id = p_position_id
  for update;

  if not found then
    raise exception 'POSITION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if position_row.amount_minor + p_delta_minor < position_row.reserved_minor then
    raise exception 'ADJUSTMENT_CONFLICTS_WITH_RESERVATIONS' using errcode = '22003';
  end if;

  update public.financial_positions
  set
    amount_minor = amount_minor + p_delta_minor,
    position_kind = 'internally_reconciled',
    as_of = p_as_of
  where id = p_position_id
  returning * into position_row;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'adjust_financial_position',
    'financial_position',
    p_position_id,
    jsonb_build_object(
      'delta_minor', p_delta_minor,
      'as_of', p_as_of,
      'reason', p_reason
    )
  );

  return position_row;
end;
$$;

-- Row-level access.
alter table public.profiles enable row level security;
alter table public.staff_members enable row level security;
alter table public.financial_positions enable row level security;
alter table public.transfer_intents enable row level security;
alter table public.transfer_review_checks enable row level security;
alter table public.external_transfer_executions enable row level security;
alter table public.transfer_events enable row level security;
alter table public.loan_applications enable row level security;
alter table public.loan_review_checks enable row level security;
alter table public.external_loan_fundings enable row level security;
alter table public.loan_events enable row level security;
alter table public.kyc_applications enable row level security;
alter table public.kyc_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own_or_staff
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_active_staff(null))
);

create policy profiles_update_own
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
);

create policy staff_members_select_self
on public.staff_members for select to authenticated
using (user_id = (select auth.uid()));

create policy financial_positions_select_own_or_staff
on public.financial_positions for select to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_active_staff(null))
);

create policy transfer_intents_select_own_or_staff
on public.transfer_intents for select to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_active_staff(null))
);

create policy transfer_review_checks_select_related
on public.transfer_review_checks for select to authenticated
using (
  exists (
    select 1
    from public.transfer_intents t
    where t.id = transfer_id
      and (
        t.owner_id = (select auth.uid())
        or (select private.is_active_staff(null))
      )
  )
);

create policy external_transfer_executions_select_related
on public.external_transfer_executions for select to authenticated
using (
  exists (
    select 1
    from public.transfer_intents t
    where t.id = transfer_id
      and (
        t.owner_id = (select auth.uid())
        or (select private.is_active_staff(null))
      )
  )
);

create policy transfer_events_select_related
on public.transfer_events for select to authenticated
using (
  exists (
    select 1
    from public.transfer_intents t
    where t.id = transfer_id
      and (
        t.owner_id = (select auth.uid())
        or (select private.is_active_staff(null))
      )
  )
);

create policy loan_applications_select_own_or_staff
on public.loan_applications for select to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_active_staff(null))
);

create policy loan_review_checks_select_related
on public.loan_review_checks for select to authenticated
using (
  exists (
    select 1
    from public.loan_applications l
    where l.id = loan_id
      and (
        l.owner_id = (select auth.uid())
        or (select private.is_active_staff(null))
      )
  )
);

create policy external_loan_fundings_select_related
on public.external_loan_fundings for select to authenticated
using (
  exists (
    select 1
    from public.loan_applications l
    where l.id = loan_id
      and (
        l.owner_id = (select auth.uid())
        or (select private.is_active_staff(null))
      )
  )
);

create policy loan_events_select_related
on public.loan_events for select to authenticated
using (
  exists (
    select 1
    from public.loan_applications l
    where l.id = loan_id
      and (
        l.owner_id = (select auth.uid())
        or (select private.is_active_staff(null))
      )
  )
);

create policy kyc_applications_select_own_or_staff
on public.kyc_applications for select to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_active_staff(null))
);

create policy kyc_events_select_related
on public.kyc_events for select to authenticated
using (
  exists (
    select 1
    from public.kyc_applications k
    where k.id = kyc_id
      and (
        k.owner_id = (select auth.uid())
        or (select private.is_active_staff(null))
      )
  )
);

create policy notifications_select_own
on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()));

create policy notifications_update_own
on public.notifications for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create policy audit_events_staff_select
on public.audit_events for select to authenticated
using ((select private.is_active_staff(array['supervisor', 'admin'])));

-- Private evidence buckets. Object names must start with the owner's UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'kyc-evidence',
    'kyc-evidence',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'application/pdf']
  ),
  (
    'loan-evidence',
    'loan-evidence',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'application/pdf']
  ),
  (
    'external-execution-evidence',
    'external-execution-evidence',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy kyc_evidence_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'kyc-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy kyc_evidence_select_own_or_staff
on storage.objects for select to authenticated
using (
  bucket_id = 'kyc-evidence'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_active_staff(null))
  )
);

create policy kyc_evidence_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'kyc-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy loan_evidence_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'loan-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy loan_evidence_select_own_or_staff
on storage.objects for select to authenticated
using (
  bucket_id = 'loan-evidence'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_active_staff(null))
  )
);

create policy loan_evidence_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'loan-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy external_execution_evidence_staff_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'external-execution-evidence'
  and (select private.is_active_staff(array['operator', 'supervisor', 'admin']))
);

create policy external_execution_evidence_related_select
on storage.objects for select to authenticated
using (
  bucket_id = 'external-execution-evidence'
  and (select private.is_active_staff(null))
);

create policy external_execution_evidence_staff_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'external-execution-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.is_active_staff(array['operator', 'supervisor', 'admin']))
);

-- Explicit privileges are required for newly-created Supabase projects.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to authenticated;

-- RLS policies execute this private helper. The private schema is not exposed
-- through PostgREST and the function only returns a caller-scoped boolean.
grant execute on function private.is_active_staff(text[]) to authenticated;

grant select on table
  public.profiles,
  public.staff_members,
  public.financial_positions,
  public.transfer_intents,
  public.transfer_review_checks,
  public.external_transfer_executions,
  public.transfer_events,
  public.loan_applications,
  public.loan_review_checks,
  public.external_loan_fundings,
  public.loan_events,
  public.kyc_applications,
  public.kyc_events,
  public.notifications,
  public.audit_events
to authenticated;

grant update (display_name, phone, preferred_currency)
  on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.submit_transfer_intent(
  uuid, text, text, jsonb, text, bigint, text, bigint, text, numeric, timestamptz, text, uuid
) to authenticated;
grant execute on function public.review_transfer_check(uuid, text, text, text) to authenticated;
grant execute on function public.transition_transfer(
  uuid, text, text, text, text, timestamptz
) to authenticated;
grant execute on function public.submit_loan_application(
  bigint, text, integer, bigint, numeric, text, jsonb, uuid
) to authenticated;
grant execute on function public.review_loan_check(uuid, text, text, text) to authenticated;
grant execute on function public.transition_loan(
  uuid, text, text, text, text, timestamptz
) to authenticated;
grant execute on function public.submit_kyc_application(
  text, text, date, text, text, jsonb, text, text, boolean, boolean, jsonb, uuid
) to authenticated;
grant execute on function public.review_kyc_application(uuid, text, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.set_user_access_status(uuid, text, text) to authenticated;
grant execute on function public.record_financial_position(
  uuid, text, text, bigint, timestamptz, text, text
) to authenticated;
grant execute on function public.adjust_financial_position(
  uuid, bigint, timestamptz, text
) to authenticated;

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.submit_transfer_intent(
  uuid, text, text, jsonb, text, bigint, text, bigint, text, numeric, timestamptz, text, uuid
) from public, anon;
revoke execute on function public.review_transfer_check(uuid, text, text, text) from public, anon;
revoke execute on function public.transition_transfer(
  uuid, text, text, text, text, timestamptz
) from public, anon;
revoke execute on function public.submit_loan_application(
  bigint, text, integer, bigint, numeric, text, jsonb, uuid
) from public, anon;
revoke execute on function public.review_loan_check(uuid, text, text, text) from public, anon;
revoke execute on function public.transition_loan(
  uuid, text, text, text, text, timestamptz
) from public, anon;
revoke execute on function public.submit_kyc_application(
  text, text, date, text, text, jsonb, text, text, boolean, boolean, jsonb, uuid
) from public, anon;
revoke execute on function public.review_kyc_application(uuid, text, text) from public, anon;
revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.set_user_access_status(uuid, text, text) from public, anon;
revoke execute on function public.record_financial_position(
  uuid, text, text, bigint, timestamptz, text, text
) from public, anon;
revoke execute on function public.adjust_financial_position(
  uuid, bigint, timestamptz, text
) from public, anon;

alter default privileges in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public
  revoke all on functions from public, anon, authenticated;
