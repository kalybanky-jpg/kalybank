-- Keep the public branch-manager RPC names and signatures stable while
-- recording every effective debit or credit in the append-only ledger.

alter table public.transfer_intents
  add column if not exists internal_execution_reference text,
  add column if not exists settled_by uuid,
  add column if not exists settled_at timestamptz;

alter table public.loan_applications
  add column if not exists internal_disbursement_reference text;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfer_intents_settled_by_fkey'
      and conrelid = 'public.transfer_intents'::regclass
  ) then
    alter table public.transfer_intents
      add constraint transfer_intents_settled_by_fkey
      foreign key (settled_by)
      references public.staff_members(user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfer_intents_internal_execution_reference_check'
      and conrelid = 'public.transfer_intents'::regclass
  ) then
    alter table public.transfer_intents
      add constraint transfer_intents_internal_execution_reference_check
      check (
        internal_execution_reference is null
        or char_length(internal_execution_reference) between 3 and 160
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfer_intents_settlement_metadata_check'
      and conrelid = 'public.transfer_intents'::regclass
  ) then
    alter table public.transfer_intents
      add constraint transfer_intents_settlement_metadata_check
      check (
        (
          status = 'external_settlement_confirmed'
          and internal_execution_reference is not null
          and settled_by is not null
          and settled_at is not null
        )
        or status <> 'external_settlement_confirmed'
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'loan_applications_internal_disbursement_reference_check'
      and conrelid = 'public.loan_applications'::regclass
  ) then
    alter table public.loan_applications
      add constraint loan_applications_internal_disbursement_reference_check
      check (
        internal_disbursement_reference is null
        or char_length(internal_disbursement_reference) between 3 and 160
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'loan_applications_internal_disbursement_metadata_check'
      and conrelid = 'public.loan_applications'::regclass
  ) then
    alter table public.loan_applications
      add constraint loan_applications_internal_disbursement_metadata_check
      check (
        (
          status = 'external_settlement_confirmed'
          and internal_disbursement_reference is not null
        )
        or status <> 'external_settlement_confirmed'
      ) not valid;
  end if;
end;
$migration$;

update public.transfer_intents as transfer
set
  internal_execution_reference = coalesce(
    transfer.internal_execution_reference,
    'MONALYZ-TRF-' || upper(replace(transfer.id::text, '-', ''))
  ),
  settled_by = coalesce(
    transfer.settled_by,
    (
      select event.actor_id
      from public.transfer_events as event
      where event.transfer_id = transfer.id
        and event.event_type = 'branch_manager_confirmed_effective_transfer'
      order by event.created_at desc, event.id desc
      limit 1
    )
  ),
  settled_at = coalesce(
    transfer.settled_at,
    (
      select event.created_at
      from public.transfer_events as event
      where event.transfer_id = transfer.id
        and event.event_type = 'branch_manager_confirmed_effective_transfer'
      order by event.created_at desc, event.id desc
      limit 1
    ),
    transfer.updated_at
  )
where transfer.status = 'external_settlement_confirmed';

update public.loan_applications
set internal_disbursement_reference = coalesce(
  internal_disbursement_reference,
  'MONALYZ-LOAN-' || upper(replace(id::text, '-', ''))
)
where status = 'external_settlement_confirmed';

create unique index if not exists
  transfer_intents_internal_execution_reference_uidx
  on public.transfer_intents (internal_execution_reference)
  where internal_execution_reference is not null;

create index if not exists transfer_intents_settled_by_idx
  on public.transfer_intents (settled_by)
  where settled_by is not null;

create unique index if not exists
  loan_applications_internal_disbursement_reference_uidx
  on public.loan_applications (internal_disbursement_reference)
  where internal_disbursement_reference is not null;

create or replace function public.branch_manager_finalize_transfer(
  p_transfer_id uuid,
  p_note text
)
returns public.transfer_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  transfer_row public.transfer_intents;
  position_row public.financial_positions;
  old_status text;
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  generated_reference text;
  next_sequence bigint;
  ledger_entry_id uuid;
begin
  if normalized_note is null then
    raise exception 'CONFIRMATION_NOTE_REQUIRED' using errcode = '22023';
  end if;

  select *
  into transfer_row
  from public.transfer_intents
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if transfer_row.status not in (
    'approved_for_external_execution',
    'external_execution_recorded'
  ) then
    raise exception 'TRANSFER_NOT_READY_FOR_FINALIZATION'
      using errcode = '55000';
  end if;

  select *
  into position_row
  from public.financial_positions
  where id = transfer_row.source_position_id
    and owner_id = transfer_row.owner_id
  for update;

  if not found then
    raise exception 'TRANSFER_SOURCE_ACCOUNT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if position_row.account_status <> 'active' then
    raise exception 'TRANSFER_SOURCE_ACCOUNT_NOT_ACTIVE'
      using errcode = '55000';
  end if;

  if position_row.amount_minor < transfer_row.amount_minor
     or position_row.reserved_minor < transfer_row.amount_minor then
    raise exception 'TRANSFER_POSITION_RECONCILIATION_CONFLICT'
      using errcode = '55000';
  end if;

  old_status := transfer_row.status;
  generated_reference :=
    'MONALYZ-TRF-' || upper(replace(transfer_row.id::text, '-', ''));

  select coalesce(max(sequence_no), 0) + 1
  into next_sequence
  from public.financial_ledger_entries
  where account_id = position_row.id;

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
    source_transfer_id,
    booked_by,
    description,
    metadata
  )
  values (
    position_row.id,
    transfer_row.owner_id,
    next_sequence,
    'transfer:' || transfer_row.id::text,
    'transfer_debit',
    -transfer_row.amount_minor,
    transfer_row.currency,
    position_row.amount_minor,
    position_row.amount_minor - transfer_row.amount_minor,
    now(),
    generated_reference,
    transfer_row.id,
    caller_id,
    normalized_note,
    jsonb_build_object(
      'recipient_name', transfer_row.recipient_name,
      'target_amount_minor', transfer_row.target_amount_minor,
      'target_currency', transfer_row.target_currency
    )
  )
  returning id into ledger_entry_id;

  update public.financial_positions
  set
    amount_minor = amount_minor - transfer_row.amount_minor,
    reserved_minor = reserved_minor - transfer_row.amount_minor,
    position_kind = 'internally_reconciled',
    as_of = now()
  where id = position_row.id;

  update public.transfer_intents
  set
    status = 'external_settlement_confirmed',
    internal_execution_reference = generated_reference,
    settled_by = caller_id,
    settled_at = now()
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    reason,
    metadata
  )
  values (
    p_transfer_id,
    caller_id,
    'branch_manager_confirmed_effective_transfer',
    old_status,
    transfer_row.status,
    normalized_note,
    jsonb_build_object(
      'ledger_entry_id', ledger_entry_id,
      'internal_execution_reference', generated_reference
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
    'branch_manager_finalize_transfer',
    'transfer_intent',
    p_transfer_id,
    jsonb_build_object(
      'from_status', old_status,
      'to_status', transfer_row.status,
      'ledger_entry_id', ledger_entry_id,
      'internal_execution_reference', generated_reference,
      'amount_minor', transfer_row.amount_minor,
      'currency', transfer_row.currency
    )
  );

  insert into public.notifications (
    recipient_id,
    title,
    message,
    notification_type
  )
  values (
    transfer_row.owner_id,
    'Virement effectué',
    'Votre virement a été confirmé comme effectué avec succès.',
    'transfer'
  );

  return transfer_row;
end;
$$;

create or replace function public.branch_manager_disburse_loan(
  p_loan_id uuid,
  p_destination_position_id uuid,
  p_note text
)
returns public.loan_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  loan_row public.loan_applications;
  position_row public.financial_positions;
  old_status text;
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  generated_reference text;
  next_sequence bigint;
  ledger_entry_id uuid;
begin
  if normalized_note is null then
    raise exception 'DISBURSEMENT_NOTE_REQUIRED' using errcode = '22023';
  end if;

  select *
  into loan_row
  from public.loan_applications
  where id = p_loan_id
  for update;

  if not found then
    raise exception 'LOAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  if loan_row.status not in (
    'approved_for_external_funding',
    'external_funding_recorded'
  ) then
    raise exception 'LOAN_NOT_READY_FOR_DISBURSEMENT'
      using errcode = '55000';
  end if;

  select *
  into position_row
  from public.financial_positions
  where id = p_destination_position_id
    and owner_id = loan_row.owner_id
  for update;

  if not found then
    raise exception 'LOAN_DESTINATION_POSITION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if position_row.account_status <> 'active' then
    raise exception 'LOAN_DESTINATION_ACCOUNT_NOT_ACTIVE'
      using errcode = '55000';
  end if;

  if position_row.account_type <> 'current' then
    raise exception 'LOAN_DESTINATION_MUST_BE_CURRENT_ACCOUNT'
      using errcode = '22023';
  end if;

  if position_row.currency <> loan_row.currency then
    raise exception 'LOAN_DESTINATION_CURRENCY_MISMATCH'
      using errcode = '22023';
  end if;

  if position_row.amount_minor
     > 1000000000000000 - loan_row.requested_amount_minor then
    raise exception 'FINANCIAL_POSITION_LIMIT_EXCEEDED'
      using errcode = '22003';
  end if;

  old_status := loan_row.status;
  generated_reference :=
    'MONALYZ-LOAN-' || upper(replace(loan_row.id::text, '-', ''));

  select coalesce(max(sequence_no), 0) + 1
  into next_sequence
  from public.financial_ledger_entries
  where account_id = position_row.id;

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
    source_loan_id,
    booked_by,
    description,
    metadata
  )
  values (
    position_row.id,
    loan_row.owner_id,
    next_sequence,
    'loan:' || loan_row.id::text,
    'loan_credit',
    loan_row.requested_amount_minor,
    loan_row.currency,
    position_row.amount_minor,
    position_row.amount_minor + loan_row.requested_amount_minor,
    now(),
    generated_reference,
    loan_row.id,
    caller_id,
    normalized_note,
    jsonb_build_object('loan_reference', loan_row.reference)
  )
  returning id into ledger_entry_id;

  update public.financial_positions
  set
    amount_minor = amount_minor + loan_row.requested_amount_minor,
    position_kind = 'internally_reconciled',
    as_of = now()
  where id = p_destination_position_id;

  update public.loan_applications
  set
    status = 'external_settlement_confirmed',
    credited_position_id = p_destination_position_id,
    disbursed_by = caller_id,
    disbursed_at = now(),
    internal_disbursement_reference = generated_reference
  where id = p_loan_id
  returning * into loan_row;

  insert into public.loan_events (
    loan_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    reason,
    metadata
  )
  values (
    p_loan_id,
    caller_id,
    'branch_manager_disbursed',
    old_status,
    loan_row.status,
    normalized_note,
    jsonb_build_object(
      'credited_position_id', p_destination_position_id,
      'ledger_entry_id', ledger_entry_id,
      'internal_disbursement_reference', generated_reference
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
    'branch_manager_disburse_loan',
    'loan_application',
    p_loan_id,
    jsonb_build_object(
      'from_status', old_status,
      'to_status', loan_row.status,
      'credited_position_id', p_destination_position_id,
      'ledger_entry_id', ledger_entry_id,
      'internal_disbursement_reference', generated_reference,
      'amount_minor', loan_row.requested_amount_minor,
      'currency', loan_row.currency
    )
  );

  insert into public.notifications (
    recipient_id,
    title,
    message,
    notification_type
  )
  values (
    loan_row.owner_id,
    'Prêt décaissé',
    'Votre prêt a été décaissé avec succès et votre compte courant Monalyz a été crédité.',
    'loan'
  );

  return loan_row;
end;
$$;

revoke execute on function public.branch_manager_finalize_transfer(uuid, text)
from public, anon;
grant execute on function public.branch_manager_finalize_transfer(uuid, text)
to authenticated, service_role;

revoke execute on function public.branch_manager_disburse_loan(
  uuid, uuid, text
)
from public, anon;
grant execute on function public.branch_manager_disburse_loan(
  uuid, uuid, text
)
to authenticated, service_role;
