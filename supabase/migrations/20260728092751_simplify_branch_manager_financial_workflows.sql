-- Simplify financial workflows for the current Monalyz operating model.
--
-- Bank staff perform their controls and the real financial movements outside
-- Monalyz. The only business validator inside Monalyz is the branch manager,
-- represented by an active `admin` staff member.

alter table public.financial_positions
  add column if not exists account_type text not null default 'current';

update public.financial_positions
set account_type = case
  when lower(label) like '%épargne%'
    or lower(label) like '%epargne%'
    or lower(label) like '%savings%'
  then 'savings'
  else 'current'
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_positions_account_type_check'
      and conrelid = 'public.financial_positions'::regclass
  ) then
    alter table public.financial_positions
      add constraint financial_positions_account_type_check
      check (account_type in ('current', 'savings'));
  end if;
end
$$;

alter table public.loan_applications
  add column if not exists credited_position_id uuid,
  add column if not exists disbursed_by uuid,
  add column if not exists disbursed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loan_applications_credited_position_id_fkey'
      and conrelid = 'public.loan_applications'::regclass
  ) then
    alter table public.loan_applications
      add constraint loan_applications_credited_position_id_fkey
      foreign key (credited_position_id)
      references public.financial_positions(id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'loan_applications_disbursed_by_fkey'
      and conrelid = 'public.loan_applications'::regclass
  ) then
    alter table public.loan_applications
      add constraint loan_applications_disbursed_by_fkey
      foreign key (disbursed_by)
      references public.staff_members(user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'loan_applications_disbursement_check'
      and conrelid = 'public.loan_applications'::regclass
  ) then
    alter table public.loan_applications
      add constraint loan_applications_disbursement_check
      check (
        (
          status = 'external_settlement_confirmed'
          and credited_position_id is not null
          and disbursed_by is not null
          and disbursed_at is not null
        ) or (
          status <> 'external_settlement_confirmed'
          and credited_position_id is null
          and disbursed_by is null
          and disbursed_at is null
        )
      );
  end if;
end
$$;

create index if not exists loan_applications_credited_position_idx
  on public.loan_applications (credited_position_id)
  where credited_position_id is not null;

create index if not exists loan_applications_disbursed_by_idx
  on public.loan_applications (disbursed_by)
  where disbursed_by is not null;

create table if not exists public.transactional_email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique
    check (char_length(event_key) between 3 and 220),
  recipient_id uuid not null
    references public.profiles(user_id) on delete cascade,
  recipient_email text not null
    check (char_length(recipient_email) between 3 and 254),
  template_key text not null
    check (
      template_key in (
        'transfer_submitted',
        'transfer_approved',
        'transfer_completed',
        'transfer_rejected',
        'transfer_failed',
        'loan_submitted',
        'loan_approved',
        'loan_disbursed',
        'loan_rejected',
        'loan_failed'
      )
    ),
  entity_type text not null
    check (entity_type in ('transfer', 'loan')),
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0
    check (attempts between 0 and 5),
  claimed_by uuid references auth.users(id),
  claim_token uuid,
  claimed_at timestamptz,
  provider_message_id text
    check (provider_message_id is null or char_length(provider_message_id) <= 500),
  last_error text
    check (last_error is null or char_length(last_error) <= 1000),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index if not exists transactional_email_outbox_pending_idx
  on public.transactional_email_outbox (created_at)
  where status in ('pending', 'sending') and attempts < 5;

create index if not exists transactional_email_outbox_recipient_idx
  on public.transactional_email_outbox (recipient_id, created_at desc);

drop trigger if exists transactional_email_outbox_set_updated_at
  on public.transactional_email_outbox;
create trigger transactional_email_outbox_set_updated_at
before update on public.transactional_email_outbox
for each row execute function private.set_updated_at();

alter table public.transactional_email_outbox enable row level security;

revoke all on table public.transactional_email_outbox
  from public, anon, authenticated;
grant all on table public.transactional_email_outbox to service_role;

create or replace function private.ensure_branch_manager()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
begin
  if not private.is_active_staff(array['admin']) then
    raise exception 'BRANCH_MANAGER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  return caller_id;
end;
$$;

revoke execute on function private.ensure_branch_manager()
  from public, anon, authenticated, service_role;

create or replace function private.validate_loan_disbursement_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'external_settlement_confirmed' then
    if new.credited_position_id is null
       or new.disbursed_by is null
       or new.disbursed_at is null then
      raise exception 'LOAN_DISBURSEMENT_METADATA_REQUIRED' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.financial_positions as position
      where position.id = new.credited_position_id
        and position.owner_id = new.owner_id
        and position.currency = new.currency
        and position.account_type = 'current'
    ) then
      raise exception 'INVALID_LOAN_DISBURSEMENT_TARGET' using errcode = '23514';
    end if;
  elsif new.credited_position_id is not null
     or new.disbursed_by is not null
     or new.disbursed_at is not null then
    raise exception 'LOAN_DISBURSEMENT_METADATA_WITHOUT_FINAL_STATUS'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_loan_disbursement_target()
  from public, anon, authenticated, service_role;

drop trigger if exists loan_validate_disbursement_target
  on public.loan_applications;
create trigger loan_validate_disbursement_target
before insert or update of status, credited_position_id, disbursed_by, disbursed_at
on public.loan_applications
for each row execute function private.validate_loan_disbursement_target();

create or replace function private.enqueue_financial_workflow_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_template text;
  entity_kind text;
  recipient uuid;
  email_address text;
  email_payload jsonb;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  if tg_table_name = 'transfer_intents' then
    entity_kind := 'transfer';
    recipient := new.owner_id;
    email_template := case new.status
      when 'submitted' then 'transfer_submitted'
      when 'approved_for_external_execution' then 'transfer_approved'
      when 'external_settlement_confirmed' then 'transfer_completed'
      when 'rejected' then 'transfer_rejected'
      when 'external_failed' then 'transfer_failed'
      else null
    end;
    email_payload := jsonb_build_object(
      'amountMinor', new.amount_minor,
      'currency', new.currency,
      'recipientName', new.recipient_name
    );
  elsif tg_table_name = 'loan_applications' then
    entity_kind := 'loan';
    recipient := new.owner_id;
    email_template := case new.status
      when 'submitted' then 'loan_submitted'
      when 'approved_for_external_funding' then 'loan_approved'
      when 'external_settlement_confirmed' then 'loan_disbursed'
      when 'rejected' then 'loan_rejected'
      when 'external_failed' then 'loan_failed'
      else null
    end;
    email_payload := jsonb_build_object(
      'amountMinor', new.requested_amount_minor,
      'currency', new.currency,
      'reference', new.reference
    );
  else
    return new;
  end if;

  if email_template is null then
    return new;
  end if;

  select email
  into email_address
  from public.profiles
  where user_id = recipient;

  if email_address is null then
    return new;
  end if;

  insert into public.transactional_email_outbox (
    event_key,
    recipient_id,
    recipient_email,
    template_key,
    entity_type,
    entity_id,
    payload
  )
  values (
    tg_table_name || ':' || new.id::text || ':' || new.status,
    recipient,
    email_address,
    email_template,
    entity_kind,
    new.id,
    email_payload
  )
  on conflict (event_key) do nothing;

  return new;
end;
$$;

revoke execute on function private.enqueue_financial_workflow_email()
  from public, anon, authenticated, service_role;

drop trigger if exists transfer_enqueue_transactional_email
  on public.transfer_intents;
create trigger transfer_enqueue_transactional_email
after insert or update of status on public.transfer_intents
for each row execute function private.enqueue_financial_workflow_email();

drop trigger if exists loan_enqueue_transactional_email
  on public.loan_applications;
create trigger loan_enqueue_transactional_email
after insert or update of status on public.loan_applications
for each row execute function private.enqueue_financial_workflow_email();

create or replace function public.claim_transactional_emails(
  p_limit integer default 10
)
returns setof public.transactional_email_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_role text := coalesce((select auth.jwt() ->> 'role'), '');
begin
  if worker_role <> 'service_role' then
    raise exception 'EMAIL_WORKER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 20 then
    raise exception 'INVALID_EMAIL_BATCH_SIZE' using errcode = '22023';
  end if;

  update public.transactional_email_outbox
  set
    status = 'failed',
    claim_token = null,
    last_error = 'Nombre maximal de tentatives atteint après expiration de la réclamation.'
  where status = 'sending'
    and attempts >= 5
    and claimed_at < now() - interval '10 minutes';

  return query
  with claimable as (
    select email.id
    from public.transactional_email_outbox as email
    where email.attempts < 5
      and (
        email.status = 'pending'
        or (
          email.status = 'sending'
          and email.claimed_at < now() - interval '10 minutes'
        )
      )
    order by email.created_at
    limit p_limit
    for update skip locked
  )
  update public.transactional_email_outbox as email
  set
    status = 'sending',
    attempts = email.attempts + 1,
    claimed_by = null,
    claim_token = gen_random_uuid(),
    claimed_at = now(),
    last_error = null
  from claimable
  where email.id = claimable.id
  returning email.*;
end;
$$;

create or replace function public.complete_transactional_email(
  p_email_id uuid,
  p_claim_token uuid,
  p_succeeded boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_role text := coalesce((select auth.jwt() ->> 'role'), '');
  email_row public.transactional_email_outbox;
begin
  if worker_role <> 'service_role' then
    raise exception 'EMAIL_WORKER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  select *
  into email_row
  from public.transactional_email_outbox
  where id = p_email_id
  for update;

  if not found
     or email_row.claim_token is distinct from p_claim_token
     or email_row.status <> 'sending' then
    raise exception 'EMAIL_CLAIM_NOT_FOUND' using errcode = '42501';
  end if;

  if p_succeeded then
    update public.transactional_email_outbox
    set
      status = 'sent',
      provider_message_id = nullif(trim(coalesce(p_provider_message_id, '')), ''),
      last_error = null,
      claim_token = null,
      sent_at = now()
    where id = p_email_id;
  else
    update public.transactional_email_outbox
    set
      status = case when attempts >= 5 then 'failed' else 'pending' end,
      provider_message_id = null,
      last_error = left(coalesce(p_error, 'Échec d’envoi non détaillé.'), 1000),
      claim_token = null,
      sent_at = null
    where id = p_email_id;
  end if;
end;
$$;

create or replace function public.branch_manager_approve_transfer(
  p_transfer_id uuid,
  p_note text default null
)
returns public.transfer_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  transfer_row public.transfer_intents;
  old_status text;
  completed_check_count integer;
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select *
  into transfer_row
  from public.transfer_intents
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if transfer_row.status not in ('submitted', 'under_review') then
    raise exception 'TRANSFER_CANNOT_BE_APPROVED' using errcode = '55000';
  end if;

  old_status := transfer_row.status;

  update public.transfer_review_checks
  set
    status = 'completed',
    reviewer_id = caller_id,
    reviewed_at = now(),
    note = coalesce(normalized_note, 'Contrôles internes confirmés par le chef d’agence.')
  where transfer_id = p_transfer_id;

  select count(*)
  into completed_check_count
  from public.transfer_review_checks
  where transfer_id = p_transfer_id
    and status = 'completed';

  if completed_check_count <> 4 then
    raise exception 'TRANSFER_REVIEW_CHECKS_INCOMPLETE' using errcode = '23514';
  end if;

  update public.transfer_intents
  set status = 'approved_for_external_execution'
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_transfer_id,
    caller_id,
    'branch_manager_approved',
    old_status,
    transfer_row.status,
    normalized_note
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'branch_manager_approve_transfer',
    'transfer_intent',
    p_transfer_id,
    jsonb_build_object('from_status', old_status, 'to_status', transfer_row.status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    transfer_row.owner_id,
    'Virement validé',
    'Le chef d’agence a validé votre demande. Le virement doit maintenant être exécuté hors de Monalyz.',
    'transfer'
  );

  return transfer_row;
end;
$$;

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
  old_status text;
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
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
    raise exception 'TRANSFER_NOT_READY_FOR_FINALIZATION' using errcode = '55000';
  end if;

  old_status := transfer_row.status;

  update public.financial_positions
  set
    amount_minor = amount_minor - transfer_row.amount_minor,
    reserved_minor = reserved_minor - transfer_row.amount_minor,
    position_kind = 'internally_reconciled',
    as_of = now()
  where id = transfer_row.source_position_id
    and amount_minor >= transfer_row.amount_minor
    and reserved_minor >= transfer_row.amount_minor;

  if not found then
    raise exception 'TRANSFER_POSITION_RECONCILIATION_CONFLICT' using errcode = '55000';
  end if;

  update public.transfer_intents
  set status = 'external_settlement_confirmed'
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_transfer_id,
    caller_id,
    'branch_manager_confirmed_effective_transfer',
    old_status,
    transfer_row.status,
    normalized_note
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'branch_manager_finalize_transfer',
    'transfer_intent',
    p_transfer_id,
    jsonb_build_object('from_status', old_status, 'to_status', transfer_row.status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
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

create or replace function public.branch_manager_reject_transfer(
  p_transfer_id uuid,
  p_reason text
)
returns public.transfer_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  transfer_row public.transfer_intents;
  old_status text;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if normalized_reason is null then
    raise exception 'REJECTION_REASON_REQUIRED' using errcode = '22023';
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
    'submitted',
    'under_review',
    'approved_for_external_execution'
  ) then
    raise exception 'TRANSFER_CANNOT_BE_REJECTED' using errcode = '55000';
  end if;

  old_status := transfer_row.status;

  update public.financial_positions
  set reserved_minor = reserved_minor - transfer_row.amount_minor
  where id = transfer_row.source_position_id
    and reserved_minor >= transfer_row.amount_minor;

  if not found then
    raise exception 'TRANSFER_RESERVATION_CONFLICT' using errcode = '55000';
  end if;

  update public.transfer_intents
  set status = 'rejected'
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_transfer_id,
    caller_id,
    'branch_manager_rejected',
    old_status,
    transfer_row.status,
    normalized_reason
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'branch_manager_reject_transfer',
    'transfer_intent',
    p_transfer_id,
    jsonb_build_object('from_status', old_status, 'to_status', transfer_row.status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    transfer_row.owner_id,
    'Virement refusé',
    'Votre demande de virement a été refusée.',
    'transfer'
  );

  return transfer_row;
end;
$$;

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
  loan_row public.loan_applications;
  old_status text;
  completed_check_count integer;
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select *
  into loan_row
  from public.loan_applications
  where id = p_loan_id
  for update;

  if not found then
    raise exception 'LOAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  if loan_row.status not in ('submitted', 'under_review') then
    raise exception 'LOAN_CANNOT_BE_APPROVED' using errcode = '55000';
  end if;

  old_status := loan_row.status;

  update public.loan_review_checks
  set
    status = 'completed',
    reviewer_id = caller_id,
    reviewed_at = now(),
    note = coalesce(normalized_note, 'Contrôles internes confirmés par le chef d’agence.')
  where loan_id = p_loan_id;

  select count(*)
  into completed_check_count
  from public.loan_review_checks
  where loan_id = p_loan_id
    and status = 'completed';

  if completed_check_count <> 4 then
    raise exception 'LOAN_REVIEW_CHECKS_INCOMPLETE' using errcode = '23514';
  end if;

  update public.loan_applications
  set status = 'approved_for_external_funding'
  where id = p_loan_id
  returning * into loan_row;

  insert into public.loan_events (
    loan_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_loan_id,
    caller_id,
    'branch_manager_approved',
    old_status,
    loan_row.status,
    normalized_note
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'branch_manager_approve_loan',
    'loan_application',
    p_loan_id,
    jsonb_build_object('from_status', old_status, 'to_status', loan_row.status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    loan_row.owner_id,
    'Prêt validé',
    'Le chef d’agence a validé votre demande de prêt. Le décaissement reste effectué en interne avant son enregistrement dans Monalyz.',
    'loan'
  );

  return loan_row;
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
    raise exception 'LOAN_NOT_READY_FOR_DISBURSEMENT' using errcode = '55000';
  end if;

  select *
  into position_row
  from public.financial_positions
  where id = p_destination_position_id
    and owner_id = loan_row.owner_id
  for update;

  if not found then
    raise exception 'LOAN_DESTINATION_POSITION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if position_row.account_type <> 'current' then
    raise exception 'LOAN_DESTINATION_MUST_BE_CURRENT_ACCOUNT' using errcode = '22023';
  end if;

  if position_row.currency <> loan_row.currency then
    raise exception 'LOAN_DESTINATION_CURRENCY_MISMATCH' using errcode = '22023';
  end if;

  if position_row.amount_minor > 1000000000000000 - loan_row.requested_amount_minor then
    raise exception 'FINANCIAL_POSITION_LIMIT_EXCEEDED' using errcode = '22003';
  end if;

  old_status := loan_row.status;

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
    disbursed_at = now()
  where id = p_loan_id
  returning * into loan_row;

  insert into public.loan_events (
    loan_id, actor_id, event_type, from_status, to_status, reason, metadata
  )
  values (
    p_loan_id,
    caller_id,
    'branch_manager_disbursed',
    old_status,
    loan_row.status,
    normalized_note,
    jsonb_build_object('credited_position_id', p_destination_position_id)
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
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
      'amount_minor', loan_row.requested_amount_minor,
      'currency', loan_row.currency
    )
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    loan_row.owner_id,
    'Prêt décaissé',
    'Votre prêt a été décaissé avec succès et votre position courante Monalyz a été créditée.',
    'loan'
  );

  return loan_row;
end;
$$;

create or replace function public.branch_manager_reject_loan(
  p_loan_id uuid,
  p_reason text
)
returns public.loan_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  loan_row public.loan_applications;
  old_status text;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if normalized_reason is null then
    raise exception 'REJECTION_REASON_REQUIRED' using errcode = '22023';
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
    'submitted',
    'under_review',
    'approved_for_external_funding'
  ) then
    raise exception 'LOAN_CANNOT_BE_REJECTED' using errcode = '55000';
  end if;

  old_status := loan_row.status;

  update public.loan_applications
  set status = 'rejected'
  where id = p_loan_id
  returning * into loan_row;

  insert into public.loan_events (
    loan_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_loan_id,
    caller_id,
    'branch_manager_rejected',
    old_status,
    loan_row.status,
    normalized_reason
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'branch_manager_reject_loan',
    'loan_application',
    p_loan_id,
    jsonb_build_object('from_status', old_status, 'to_status', loan_row.status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    loan_row.owner_id,
    'Prêt refusé',
    'Votre demande de prêt a été refusée.',
    'loan'
  );

  return loan_row;
end;
$$;

-- Loan references must be globally unique. The original implementation used
-- only the first 32 bits of a caller-provided idempotency UUID, which allowed
-- trivial collisions and also collided when two users reused the same UUID.
-- A dedicated server-generated UUID now identifies the public loan reference;
-- owner-scoped idempotency continues to return the original row on retries.
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
  new_loan_id uuid := gen_random_uuid();
  generated_reference text;
begin
  if p_document_object_paths is null
     or jsonb_typeof(p_document_object_paths) <> 'array'
     or jsonb_array_length(p_document_object_paths) = 0 then
    raise exception 'LOAN_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;

  generated_reference :=
    'Monalyz-'
    || to_char(now(), 'YYYYMMDD')
    || '-'
    || upper(replace(new_loan_id::text, '-', ''));

  insert into public.loan_applications (
    id,
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
    new_loan_id,
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
    where owner_id = caller_id
      and idempotency_key = p_idempotency_key;
    return loan_row;
  end if;

  insert into public.loan_review_checks (loan_id, check_kind)
  select loan_row.id, check_kind
  from unnest(
    array['dual_review', 'escalation', 'compliance', 'final_authorization']
  ) as check_kind;

  insert into public.loan_events (
    loan_id, actor_id, event_type, to_status
  )
  values (
    loan_row.id, caller_id, 'submitted', 'submitted'
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    caller_id,
    'Demande enregistrée',
    'Votre demande a été enregistrée pour étude. La simulation n’est ni une offre de crédit ni une promesse de versement.',
    'loan'
  );

  return loan_row;
end;
$$;

-- Retire every legacy multi-actor endpoint. Only the branch-manager RPCs above
-- may mutate transfer and loan workflow state.
revoke execute on function public.review_transfer_check(uuid, text, text, text)
  from authenticated, service_role;
revoke execute on function public.transition_transfer(
  uuid, text, text, text, text, timestamptz
) from authenticated, service_role;
revoke execute on function public.review_loan_check(uuid, text, text, text)
  from authenticated, service_role;
revoke execute on function public.transition_loan(
  uuid, text, text, text, text, timestamptz
) from authenticated, service_role;

revoke insert, update, delete on table
  public.financial_positions,
  public.transfer_intents,
  public.transfer_review_checks,
  public.external_transfer_executions,
  public.transfer_events,
  public.loan_applications,
  public.loan_review_checks,
  public.external_loan_fundings,
  public.loan_events,
  public.notifications,
  public.audit_events,
  public.transactional_email_outbox
from service_role;

grant execute on function public.branch_manager_approve_transfer(uuid, text)
  to authenticated;
grant execute on function public.branch_manager_finalize_transfer(uuid, text)
  to authenticated;
grant execute on function public.branch_manager_reject_transfer(uuid, text)
  to authenticated;
grant execute on function public.branch_manager_approve_loan(uuid, text)
  to authenticated;
grant execute on function public.branch_manager_disburse_loan(uuid, uuid, text)
  to authenticated;
grant execute on function public.branch_manager_reject_loan(uuid, text)
  to authenticated;

grant execute on function public.claim_transactional_emails(integer)
  to service_role;
grant execute on function public.complete_transactional_email(
  uuid, uuid, boolean, text, text
) to service_role;
grant execute on function public.branch_manager_approve_transfer(uuid, text)
  to service_role;
grant execute on function public.branch_manager_finalize_transfer(uuid, text)
  to service_role;
grant execute on function public.branch_manager_reject_transfer(uuid, text)
  to service_role;
grant execute on function public.branch_manager_approve_loan(uuid, text)
  to service_role;
grant execute on function public.branch_manager_disburse_loan(uuid, uuid, text)
  to service_role;
grant execute on function public.branch_manager_reject_loan(uuid, text)
  to service_role;

revoke execute on function public.claim_transactional_emails(integer)
  from public, anon;
revoke execute on function public.complete_transactional_email(
  uuid, uuid, boolean, text, text
) from public, anon, authenticated;
revoke execute on function public.claim_transactional_emails(integer)
  from authenticated;
revoke execute on function public.branch_manager_approve_transfer(uuid, text)
  from public, anon;
revoke execute on function public.branch_manager_finalize_transfer(uuid, text)
  from public, anon;
revoke execute on function public.branch_manager_reject_transfer(uuid, text)
  from public, anon;
revoke execute on function public.branch_manager_approve_loan(uuid, text)
  from public, anon;
revoke execute on function public.branch_manager_disburse_loan(uuid, uuid, text)
  from public, anon;
revoke execute on function public.branch_manager_reject_loan(uuid, text)
  from public, anon;
