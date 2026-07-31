create table if not exists private.account_number_configuration (
  singleton boolean primary key default true check (singleton),
  prefix text not null check (prefix ~ '^[0-9]{5,9}$'),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);

revoke all on table private.account_number_configuration
from public, anon, authenticated;
grant select, insert, update on table private.account_number_configuration
to service_role;

create or replace function public.get_account_number_configuration()
returns table (
  prefix text,
  prefix_length integer,
  capacity integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_branch_manager();

  return query
  select
    configuration.prefix,
    char_length(configuration.prefix)::integer,
    power(
      10::numeric,
      10 - char_length(configuration.prefix)
    )::integer,
    configuration.updated_at
  from private.account_number_configuration as configuration
  where configuration.singleton;
end;
$$;

revoke all on function public.get_account_number_configuration()
from public, anon;
grant execute on function public.get_account_number_configuration()
to authenticated;

create or replace function public.set_account_number_prefix(
  p_prefix text
)
returns table (
  prefix text,
  prefix_length integer,
  capacity integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  normalized_prefix text := trim(coalesce(p_prefix, ''));
  configuration private.account_number_configuration;
begin
  if normalized_prefix !~ '^[0-9]{5,9}$' then
    raise exception 'INVALID_ACCOUNT_NUMBER_PREFIX'
      using errcode = '22023';
  end if;

  insert into private.account_number_configuration (
    singleton,
    prefix,
    created_by,
    updated_by
  )
  values (
    true,
    normalized_prefix,
    caller_id,
    caller_id
  )
  on conflict (singleton) do update
  set
    prefix = excluded.prefix,
    updated_at = now(),
    updated_by = caller_id
  returning * into configuration;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    caller_id,
    'set_account_number_prefix',
    'account_number_configuration',
    caller_id,
    jsonb_build_object(
      'prefix', configuration.prefix,
      'prefix_length', char_length(configuration.prefix),
      'capacity',
        power(
          10::numeric,
          10 - char_length(configuration.prefix)
        )::integer
    )
  );

  return query
  select
    configuration.prefix,
    char_length(configuration.prefix)::integer,
    power(
      10::numeric,
      10 - char_length(configuration.prefix)
    )::integer,
    configuration.updated_at;
end;
$$;

revoke all on function public.set_account_number_prefix(text)
from public, anon;
grant execute on function public.set_account_number_prefix(text)
to authenticated;

drop function if exists public.branch_manager_declare_account(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  timestamptz,
  boolean,
  text,
  uuid
);

create function public.branch_manager_declare_account(
  p_owner_id uuid,
  p_label text,
  p_account_type text,
  p_currency text,
  p_iban text,
  p_bic text,
  p_account_holder_name text,
  p_institution_name text,
  p_branch_name text,
  p_branch_code text,
  p_opening_balance_minor bigint,
  p_opened_at timestamptz,
  p_is_demo boolean,
  p_reason text,
  p_idempotency_key uuid
)
returns public.financial_positions
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  position_row public.financial_positions;
  configuration private.account_number_configuration;
  normalized_account_number text;
  normalized_iban text :=
    private.normalize_iban(coalesce(p_iban, ''));
  normalized_bic text := upper(trim(coalesce(p_bic, '')));
  normalized_branch_code text :=
    upper(trim(coalesce(p_branch_code, '')));
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  suffix_width integer;
  suffix_capacity integer;
  random_start integer;
begin
  if p_idempotency_key is null then
    raise exception 'ACCOUNT_IDEMPOTENCY_KEY_REQUIRED'
      using errcode = '22023';
  end if;

  select *
  into position_row
  from public.financial_positions
  where declaration_idempotency_key = p_idempotency_key;

  if found then
    if position_row.owner_id <> p_owner_id
       or position_row.label <> trim(coalesce(p_label, ''))
       or position_row.account_type <> p_account_type
       or position_row.currency <> upper(trim(coalesce(p_currency, '')))
       or position_row.amount_minor <> p_opening_balance_minor
       or position_row.iban <> normalized_iban
       or position_row.bic <> normalized_bic
       or position_row.account_holder_name
          <> trim(coalesce(p_account_holder_name, ''))
       or position_row.institution_name
          <> trim(coalesce(p_institution_name, ''))
       or position_row.branch_name <> trim(coalesce(p_branch_name, ''))
       or position_row.branch_code <> normalized_branch_code
       or position_row.opened_at is distinct from p_opened_at
       or position_row.is_demo <> coalesce(p_is_demo, false) then
      raise exception 'ACCOUNT_IDEMPOTENCY_PAYLOAD_MISMATCH'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.financial_ledger_entries
      where account_id = position_row.id
        and entry_key =
          'account-opening:' || p_idempotency_key::text
        and description = normalized_reason
    ) then
      raise exception 'ACCOUNT_IDEMPOTENCY_PAYLOAD_MISMATCH'
        using errcode = '22023';
    end if;

    return position_row;
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = p_owner_id
      and access_status = 'active'
  ) then
    raise exception 'ACCOUNT_OWNER_NOT_ACTIVE' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.kyc_applications
    where owner_id = p_owner_id
      and status = 'approved'
  ) then
    raise exception 'APPROVED_KYC_REQUIRED' using errcode = '23514';
  end if;

  if p_account_type <> 'current'
     or upper(trim(coalesce(p_currency, ''))) !~ '^[A-Z]{3}$'
     or p_opening_balance_minor < 0
     or p_opening_balance_minor > 1000000000000000
     or p_opened_at is null
     or normalized_reason is null
     or nullif(trim(coalesce(p_label, '')), '') is null
     or nullif(trim(coalesce(p_account_holder_name, '')), '') is null
     or nullif(trim(coalesce(p_institution_name, '')), '') is null
     or nullif(trim(coalesce(p_branch_name, '')), '') is null then
    raise exception 'INVALID_ACCOUNT_DECLARATION' using errcode = '22023';
  end if;

  if not private.is_valid_iban(normalized_iban)
     or normalized_bic !~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'
     or normalized_branch_code !~ '^[A-Z0-9-]{1,40}$' then
    raise exception 'INVALID_ACCOUNT_IDENTIFIER' using errcode = '22023';
  end if;

  select *
  into configuration
  from private.account_number_configuration
  where singleton
  for update;

  if not found then
    raise exception 'ACCOUNT_NUMBER_PREFIX_NOT_CONFIGURED'
      using errcode = '55000';
  end if;

  suffix_width := 10 - char_length(configuration.prefix);
  suffix_capacity :=
    power(10::numeric, suffix_width)::integer;
  random_start := floor(random() * suffix_capacity)::integer;

  select
    configuration.prefix
    || lpad(
      ((random_start + candidate.offset_value) % suffix_capacity)::text,
      suffix_width,
      '0'
    )
  into normalized_account_number
  from generate_series(0, suffix_capacity - 1)
    as candidate(offset_value)
  where not exists (
    select 1
    from public.financial_positions as existing
    where existing.account_number =
      configuration.prefix
      || lpad(
        ((random_start + candidate.offset_value) % suffix_capacity)::text,
        suffix_width,
        '0'
      )
  )
  limit 1;

  if normalized_account_number is null then
    raise exception 'ACCOUNT_NUMBER_PREFIX_EXHAUSTED'
      using errcode = '54000';
  end if;

  insert into public.financial_positions (
    owner_id,
    label,
    position_kind,
    currency,
    amount_minor,
    reserved_minor,
    as_of,
    external_identifier_masked,
    account_type,
    account_number,
    iban,
    bic,
    account_holder_name,
    institution_name,
    branch_name,
    branch_code,
    account_status,
    opened_at,
    declared_by,
    is_demo,
    declaration_idempotency_key
  )
  values (
    p_owner_id,
    trim(p_label),
    'internally_reconciled',
    upper(trim(p_currency)),
    p_opening_balance_minor,
    0,
    p_opened_at,
    '••••' || right(normalized_account_number, 4),
    p_account_type,
    normalized_account_number,
    normalized_iban,
    normalized_bic,
    trim(p_account_holder_name),
    trim(p_institution_name),
    trim(p_branch_name),
    normalized_branch_code,
    'active',
    p_opened_at,
    caller_id,
    coalesce(p_is_demo, false),
    p_idempotency_key
  )
  returning * into position_row;

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
    position_row.id,
    position_row.owner_id,
    1,
    'account-opening:' || p_idempotency_key::text,
    'account_opening',
    p_opening_balance_minor,
    position_row.currency,
    0,
    p_opening_balance_minor,
    p_opened_at,
    'ACCOUNT-' || upper(replace(position_row.id::text, '-', '')),
    caller_id,
    normalized_reason,
    jsonb_build_object(
      'account_number', normalized_account_number
    )
  );

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    caller_id,
    'branch_manager_declare_account',
    'financial_position',
    position_row.id,
    jsonb_build_object(
      'account_number', normalized_account_number,
      'account_number_prefix', configuration.prefix,
      'currency', position_row.currency,
      'opening_amount_minor', p_opening_balance_minor,
      'reason', normalized_reason
    )
  );

  return position_row;
exception
  when unique_violation then
    raise exception 'ACCOUNT_IDENTIFIER_ALREADY_EXISTS'
      using errcode = '23505';
end;
$$;

revoke all on function public.branch_manager_declare_account(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  timestamptz,
  boolean,
  text,
  uuid
)
from public, anon;
grant execute on function public.branch_manager_declare_account(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  timestamptz,
  boolean,
  text,
  uuid
)
to authenticated;

create or replace function private.remove_iban_from_new_official_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.snapshot := new.snapshot #- '{account,iban}';
  new.snapshot_hash := encode(
    extensions.digest(
      convert_to(new.snapshot::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$$;

revoke all on function private.remove_iban_from_new_official_document()
from public, anon, authenticated;

create trigger official_documents_remove_iban_before_insert
before insert on public.official_documents
for each row
execute function private.remove_iban_from_new_official_document();
