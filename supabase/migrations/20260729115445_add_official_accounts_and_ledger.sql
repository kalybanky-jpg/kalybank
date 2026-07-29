-- Materialize bank accounts declared by the branch manager while keeping
-- financial_positions as the balance aggregate consumed by the application.
-- No banking API is contacted and no account identifier is invented for
-- historical rows: they remain pending until an authorized declaration.

create or replace function private.normalize_iban(p_iban text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.upper(
    pg_catalog.regexp_replace(p_iban, '[[:space:]]+', '', 'g')
  );
$$;

create or replace function private.is_valid_iban(p_iban text)
returns boolean
language plpgsql
immutable
strict
parallel safe
set search_path = ''
as $$
declare
  normalized text := private.normalize_iban(p_iban);
  rearranged text;
  current_character text;
  expanded_character text;
  remainder_value integer := 0;
begin
  if pg_catalog.char_length(normalized) < 15
     or pg_catalog.char_length(normalized) > 34
     or normalized !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$' then
    return false;
  end if;

  rearranged :=
    pg_catalog.substr(normalized, 5)
    || pg_catalog.substr(normalized, 1, 4);

  for character_index in 1..pg_catalog.char_length(rearranged) loop
    current_character := pg_catalog.substr(
      rearranged,
      character_index,
      1
    );

    if current_character ~ '^[0-9]$' then
      expanded_character := current_character;
    else
      expanded_character := (
        pg_catalog.ascii(current_character) - 55
      )::text;
    end if;

    for digit_index in 1..pg_catalog.char_length(expanded_character) loop
      remainder_value := (
        remainder_value * 10
        + pg_catalog.substr(
          expanded_character,
          digit_index,
          1
        )::integer
      ) % 97;
    end loop;
  end loop;

  return remainder_value = 1;
end;
$$;

revoke execute on function private.normalize_iban(text)
from public, anon, authenticated, service_role;
revoke execute on function private.is_valid_iban(text)
from public, anon, authenticated, service_role;

alter table public.financial_positions
  add column if not exists account_number text,
  add column if not exists iban text,
  add column if not exists bic text,
  add column if not exists account_holder_name text,
  add column if not exists institution_name text,
  add column if not exists branch_name text,
  add column if not exists branch_code text,
  add column if not exists account_status text not null default 'pending',
  add column if not exists opened_at timestamptz,
  add column if not exists declared_by uuid,
  add column if not exists is_demo boolean not null default false,
  add column if not exists declaration_idempotency_key uuid;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_positions_declared_by_fkey'
      and conrelid = 'public.financial_positions'::regclass
  ) then
    alter table public.financial_positions
      add constraint financial_positions_declared_by_fkey
      foreign key (declared_by)
      references public.staff_members(user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_positions_account_status_check'
      and conrelid = 'public.financial_positions'::regclass
  ) then
    alter table public.financial_positions
      add constraint financial_positions_account_status_check
      check (
        account_status in ('pending', 'active', 'restricted', 'closed')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_positions_account_number_check'
      and conrelid = 'public.financial_positions'::regclass
  ) then
    alter table public.financial_positions
      add constraint financial_positions_account_number_check
      check (
        account_number is null
        or (
          account_number = upper(trim(account_number))
          and account_number ~ '^[A-Z0-9-]{6,34}$'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_positions_iban_check'
      and conrelid = 'public.financial_positions'::regclass
  ) then
    alter table public.financial_positions
      add constraint financial_positions_iban_check
      check (
        iban is null
        or (
          iban = private.normalize_iban(iban)
          and private.is_valid_iban(iban)
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_positions_bic_check'
      and conrelid = 'public.financial_positions'::regclass
  ) then
    alter table public.financial_positions
      add constraint financial_positions_bic_check
      check (
        bic is null
        or (
          bic = upper(trim(bic))
          and bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_positions_official_text_lengths_check'
      and conrelid = 'public.financial_positions'::regclass
  ) then
    alter table public.financial_positions
      add constraint financial_positions_official_text_lengths_check
      check (
        (
          account_holder_name is null
          or char_length(account_holder_name) between 1 and 160
        )
        and (
          institution_name is null
          or char_length(institution_name) between 1 and 200
        )
        and (
          branch_name is null
          or char_length(branch_name) between 1 and 160
        )
        and (
          branch_code is null
          or (
            char_length(branch_code) between 1 and 40
            and branch_code ~ '^[A-Z0-9-]+$'
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_positions_active_account_check'
      and conrelid = 'public.financial_positions'::regclass
  ) then
    alter table public.financial_positions
      add constraint financial_positions_active_account_check
      check (
        account_status <> 'active'
        or (
          account_number is not null
          and iban is not null
          and bic is not null
          and account_holder_name is not null
          and institution_name is not null
          and branch_name is not null
          and branch_code is not null
          and opened_at is not null
          and declared_by is not null
        )
      );
  end if;
end;
$migration$;

create unique index if not exists financial_positions_account_number_uidx
  on public.financial_positions (account_number)
  where account_number is not null;

create unique index if not exists financial_positions_iban_uidx
  on public.financial_positions (iban)
  where iban is not null;

create unique index if not exists
  financial_positions_declaration_idempotency_uidx
  on public.financial_positions (declaration_idempotency_key)
  where declaration_idempotency_key is not null;

create index if not exists financial_positions_declared_by_idx
  on public.financial_positions (declared_by)
  where declared_by is not null;

create index if not exists financial_positions_owner_status_idx
  on public.financial_positions (owner_id, account_status);

create table if not exists public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.financial_positions(id) on delete restrict,
  owner_id uuid not null
    references public.profiles(user_id) on delete restrict,
  sequence_no bigint not null check (sequence_no > 0),
  entry_key text not null unique
    check (char_length(entry_key) between 3 and 220),
  entry_kind text not null
    check (
      entry_kind in (
        'migration_opening_balance',
        'account_opening',
        'manual_adjustment',
        'transfer_debit',
        'loan_credit'
      )
    ),
  amount_minor bigint not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  balance_before_minor bigint not null
    check (balance_before_minor >= 0),
  balance_after_minor bigint not null
    check (balance_after_minor >= 0),
  value_date timestamptz not null,
  booked_at timestamptz not null default now(),
  internal_reference text
    check (
      internal_reference is null
      or char_length(internal_reference) between 3 and 160
    ),
  source_transfer_id uuid
    references public.transfer_intents(id) on delete restrict,
  source_loan_id uuid
    references public.loan_applications(id) on delete restrict,
  booked_by uuid
    references public.staff_members(user_id) on delete restrict,
  description text not null
    check (char_length(description) between 3 and 1000),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (
    balance_after_minor = balance_before_minor + amount_minor
  ),
  check (
    amount_minor <> 0
    or entry_kind in ('migration_opening_balance', 'account_opening')
  ),
  check (
    (
      entry_kind = 'transfer_debit'
      and source_transfer_id is not null
      and source_loan_id is null
      and amount_minor < 0
    )
    or (
      entry_kind = 'loan_credit'
      and source_loan_id is not null
      and source_transfer_id is null
      and amount_minor > 0
    )
    or (
      entry_kind in (
        'migration_opening_balance',
        'account_opening',
        'manual_adjustment'
      )
      and source_transfer_id is null
      and source_loan_id is null
    )
  ),
  unique (account_id, sequence_no)
);

create index if not exists financial_ledger_entries_owner_booked_idx
  on public.financial_ledger_entries (owner_id, booked_at desc);

create index if not exists financial_ledger_entries_position_booked_idx
  on public.financial_ledger_entries (account_id, booked_at desc);

create index if not exists financial_ledger_entries_booked_by_idx
  on public.financial_ledger_entries (booked_by)
  where booked_by is not null;

create unique index if not exists financial_ledger_entries_transfer_uidx
  on public.financial_ledger_entries (source_transfer_id)
  where source_transfer_id is not null and entry_kind = 'transfer_debit';

create unique index if not exists financial_ledger_entries_loan_uidx
  on public.financial_ledger_entries (source_loan_id)
  where source_loan_id is not null and entry_kind = 'loan_credit';

create unique index if not exists
  financial_ledger_entries_position_reference_uidx
  on public.financial_ledger_entries (account_id, internal_reference)
  where internal_reference is not null;

create or replace function private.validate_financial_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  position_row public.financial_positions;
begin
  select *
  into position_row
  from public.financial_positions
  where id = new.account_id;

  if not found then
    raise exception 'LEDGER_POSITION_NOT_FOUND' using errcode = '23503';
  end if;

  if new.owner_id <> position_row.owner_id then
    raise exception 'LEDGER_OWNER_MISMATCH' using errcode = '23514';
  end if;

  if new.currency <> position_row.currency then
    raise exception 'LEDGER_CURRENCY_MISMATCH' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_financial_ledger_entry()
from public, anon, authenticated, service_role;

create trigger financial_ledger_entries_validate
before insert on public.financial_ledger_entries
for each row execute function private.validate_financial_ledger_entry();

create or replace function private.prevent_financial_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting(
    'monalyz.allow_ledger_maintenance',
    true
  ) is distinct from 'on' then
    raise exception 'FINANCIAL_LEDGER_IS_APPEND_ONLY'
      using errcode = '55000';
  end if;

  return old;
end;
$$;

revoke execute on function private.prevent_financial_ledger_mutation()
from public, anon, authenticated, service_role;

create trigger financial_ledger_entries_prevent_update
before update on public.financial_ledger_entries
for each row execute function private.prevent_financial_ledger_mutation();

create trigger financial_ledger_entries_prevent_delete
before delete on public.financial_ledger_entries
for each row execute function private.prevent_financial_ledger_mutation();

-- Every pre-existing balance becomes an explicit migration baseline. This
-- preserves the current balance without fabricating historical movements.
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
select
  position.id,
  position.owner_id,
  1,
  'migration:position:' || position.id::text,
  'migration_opening_balance',
  position.amount_minor,
  position.currency,
  0,
  position.amount_minor,
  position.as_of,
  null,
  null,
  'Solde initial repris lors de l’activation du grand livre Monalyz.',
  jsonb_build_object(
    'migration', 'add_official_accounts_and_ledger',
    'historical_detail_available', false
  )
from public.financial_positions as position
where not exists (
  select 1
  from public.financial_ledger_entries as entry
  where entry.account_id = position.id
);

alter table public.financial_ledger_entries enable row level security;

create policy financial_ledger_entries_select_own_or_admin
on public.financial_ledger_entries
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_active_staff(array['admin']))
);

revoke all on table public.financial_ledger_entries
from public, anon, authenticated, service_role;
grant select on table public.financial_ledger_entries
to authenticated, service_role;

create or replace function public.branch_manager_declare_account(
  p_owner_id uuid,
  p_label text,
  p_account_type text,
  p_currency text,
  p_iban text,
  p_bic text,
  p_account_number text,
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
  normalized_account_number text :=
    upper(trim(coalesce(p_account_number, '')));
  normalized_iban text :=
    private.normalize_iban(coalesce(p_iban, ''));
  normalized_bic text := upper(trim(coalesce(p_bic, '')));
  normalized_branch_code text :=
    upper(trim(coalesce(p_branch_code, '')));
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
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
       or position_row.account_number <> normalized_account_number
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

  if p_account_type not in ('current', 'savings')
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

  if normalized_account_number !~ '^[A-Z0-9-]{6,34}$'
     or not private.is_valid_iban(normalized_iban)
     or normalized_bic !~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'
     or normalized_branch_code !~ '^[A-Z0-9-]{1,40}$' then
    raise exception 'INVALID_ACCOUNT_IDENTIFIER' using errcode = '22023';
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
    '••••' || right(normalized_iban, 4),
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
      'account_number', normalized_account_number,
      'iban_last4', right(normalized_iban, 4)
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
      'iban_last4', right(normalized_iban, 4),
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

create or replace function public.branch_manager_adjust_balance(
  p_account_id uuid,
  p_target_amount_minor bigint,
  p_value_date timestamptz,
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
  existing_entry public.financial_ledger_entries;
  normalized_reference text :=
    'ADJ-' || upper(replace(p_idempotency_key::text, '-', ''));
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  delta_minor bigint;
  next_sequence bigint;
begin
  if p_idempotency_key is null then
    raise exception 'ADJUSTMENT_IDEMPOTENCY_KEY_REQUIRED'
      using errcode = '22023';
  end if;

  select *
  into existing_entry
  from public.financial_ledger_entries
  where entry_key = 'adjustment:' || p_idempotency_key::text;

  if found then
    if existing_entry.account_id <> p_account_id
       or existing_entry.balance_after_minor <> p_target_amount_minor
       or existing_entry.description <> normalized_reason then
      raise exception 'ADJUSTMENT_IDEMPOTENCY_PAYLOAD_MISMATCH'
        using errcode = '22023';
    end if;

    select *
    into position_row
    from public.financial_positions
    where id = p_account_id;

    return position_row;
  end if;

  if p_target_amount_minor < 0
     or p_target_amount_minor > 1000000000000000
     or p_value_date is null
     or normalized_reason is null then
    raise exception 'INVALID_BALANCE_ADJUSTMENT' using errcode = '22023';
  end if;

  select *
  into position_row
  from public.financial_positions
  where id = p_account_id
  for update;

  if not found then
    raise exception 'POSITION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if position_row.account_status <> 'active' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = '55000';
  end if;

  if p_target_amount_minor < position_row.reserved_minor then
    raise exception 'ADJUSTMENT_CONFLICTS_WITH_RESERVATIONS'
      using errcode = '22003';
  end if;

  delta_minor := p_target_amount_minor - position_row.amount_minor;

  if delta_minor = 0 then
    raise exception 'ADJUSTMENT_DELTA_REQUIRED' using errcode = '22023';
  end if;

  select coalesce(max(sequence_no), 0) + 1
  into next_sequence
  from public.financial_ledger_entries
  where account_id = p_account_id;

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
    next_sequence,
    'adjustment:' || p_idempotency_key::text,
    'manual_adjustment',
    delta_minor,
    position_row.currency,
    position_row.amount_minor,
    p_target_amount_minor,
    p_value_date,
    normalized_reference,
    caller_id,
    normalized_reason,
    jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  update public.financial_positions
  set
    amount_minor = p_target_amount_minor,
    position_kind = 'internally_reconciled',
    as_of = p_value_date
  where id = p_account_id
  returning * into position_row;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    caller_id,
    'branch_manager_adjust_balance',
    'financial_position',
    p_account_id,
    jsonb_build_object(
      'delta_minor', delta_minor,
      'target_amount_minor', p_target_amount_minor,
      'as_of', p_value_date,
      'internal_reference', normalized_reference,
      'reason', normalized_reason
    )
  );

  return position_row;
end;
$$;

revoke execute on function public.record_financial_position(
  uuid, text, text, bigint, timestamptz, text, text
)
from public, anon, authenticated, service_role;

revoke execute on function public.adjust_financial_position(
  uuid, bigint, timestamptz, text
)
from public, anon, authenticated, service_role;

revoke execute on function public.branch_manager_declare_account(
  uuid, text, text, text, text, text, text, text, text, text, text,
  bigint, timestamptz, boolean, text, uuid
)
from public, anon;
grant execute on function public.branch_manager_declare_account(
  uuid, text, text, text, text, text, text, text, text, text, text,
  bigint, timestamptz, boolean, text, uuid
)
to authenticated, service_role;

revoke execute on function public.branch_manager_adjust_balance(
  uuid, bigint, timestamptz, text, uuid
)
from public, anon;
grant execute on function public.branch_manager_adjust_balance(
  uuid, bigint, timestamptz, text, uuid
)
to authenticated, service_role;
