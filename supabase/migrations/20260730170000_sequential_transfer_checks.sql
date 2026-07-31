-- Sequential branch-manager transfer checks.
-- Each check is completed individually; the fourth check settles the transfer
-- atomically through branch_manager_finalize_transfer.

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

  select * into transfer_row
  from public.transfer_intents
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if transfer_row.status = 'under_review'
     and exists (
       select 1 from public.transfer_review_checks
       where transfer_id = p_transfer_id and status <> 'completed'
     ) then
    raise exception 'TRANSFER_REVIEW_CHECKS_INCOMPLETE' using errcode = '23514';
  end if;

  if transfer_row.status not in (
    'under_review', 'approved_for_external_execution', 'external_execution_recorded'
  ) then
    raise exception 'TRANSFER_NOT_READY_FOR_FINALIZATION' using errcode = '55000';
  end if;

  select * into position_row
  from public.financial_positions
  where id = transfer_row.source_position_id
    and owner_id = transfer_row.owner_id
  for update;

  if not found then
    raise exception 'TRANSFER_SOURCE_ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if position_row.account_status <> 'active' then
    raise exception 'TRANSFER_SOURCE_ACCOUNT_NOT_ACTIVE' using errcode = '55000';
  end if;
  if position_row.amount_minor < transfer_row.amount_minor
     or position_row.reserved_minor < transfer_row.amount_minor then
    raise exception 'TRANSFER_POSITION_RECONCILIATION_CONFLICT' using errcode = '55000';
  end if;

  old_status := transfer_row.status;
  generated_reference := 'MONALYZ-TRF-' || upper(replace(transfer_row.id::text, '-', ''));

  select coalesce(max(sequence_no), 0) + 1 into next_sequence
  from public.financial_ledger_entries where account_id = position_row.id;

  insert into public.financial_ledger_entries (
    account_id, owner_id, sequence_no, entry_key, entry_kind, amount_minor,
    currency, balance_before_minor, balance_after_minor, value_date,
    internal_reference, source_transfer_id, booked_by, description, metadata
  ) values (
    position_row.id, transfer_row.owner_id, next_sequence,
    'transfer:' || transfer_row.id::text, 'transfer_debit', -transfer_row.amount_minor,
    transfer_row.currency, position_row.amount_minor,
    position_row.amount_minor - transfer_row.amount_minor, now(),
    generated_reference, transfer_row.id, caller_id, normalized_note,
    jsonb_build_object(
      'recipient_name', transfer_row.recipient_name,
      'target_amount_minor', transfer_row.target_amount_minor,
      'target_currency', transfer_row.target_currency
    )
  ) returning id into ledger_entry_id;

  update public.financial_positions
  set amount_minor = amount_minor - transfer_row.amount_minor,
      reserved_minor = reserved_minor - transfer_row.amount_minor,
      position_kind = 'internally_reconciled', as_of = now()
  where id = position_row.id;

  update public.transfer_intents
  set status = 'external_settlement_confirmed',
      internal_execution_reference = generated_reference,
      settled_by = caller_id, settled_at = now()
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason, metadata
  ) values (
    p_transfer_id, caller_id, 'branch_manager_confirmed_effective_transfer',
    old_status, transfer_row.status, normalized_note,
    jsonb_build_object('ledger_entry_id', ledger_entry_id,
      'internal_execution_reference', generated_reference)
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    caller_id, 'branch_manager_finalize_transfer', 'transfer_intent', p_transfer_id,
    jsonb_build_object('from_status', old_status, 'to_status', transfer_row.status,
      'ledger_entry_id', ledger_entry_id,
      'internal_execution_reference', generated_reference,
      'amount_minor', transfer_row.amount_minor, 'currency', transfer_row.currency)
  );

  insert into public.notifications (recipient_id, title, message, notification_type)
  values (
    transfer_row.owner_id, 'Virement effectué',
    'Votre virement a été confirmé comme effectué avec succès.', 'transfer'
  );

  return transfer_row;
end;
$$;

create or replace function public.branch_manager_review_transfer_check(
  p_transfer_id uuid,
  p_check_kind text,
  p_note text
)
returns public.transfer_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_row public.transfer_intents;
  check_row public.transfer_review_checks;
  caller_id uuid := private.ensure_branch_manager();
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  expected_kind text;
  old_status text;
begin
  if normalized_note is null then
    raise exception 'REVIEW_NOTE_REQUIRED' using errcode = '22023';
  end if;
  if p_check_kind not in ('dual_review', 'escalation', 'compliance', 'final_authorization') then
    raise exception 'INVALID_REVIEW_CHECK' using errcode = '22023';
  end if;

  select * into transfer_row
  from public.transfer_intents where id = p_transfer_id for update;
  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if transfer_row.status in ('external_settlement_confirmed', 'rejected', 'cancelled', 'external_failed') then
    return transfer_row;
  end if;
  if transfer_row.status not in ('submitted', 'under_review') then
    raise exception 'TRANSFER_NOT_REVIEWABLE' using errcode = '55000';
  end if;

  select * into check_row
  from public.transfer_review_checks
  where transfer_id = p_transfer_id and check_kind = p_check_kind
  for update;
  if not found then
    raise exception 'TRANSFER_REVIEW_CHECK_NOT_FOUND' using errcode = 'P0002';
  end if;
  if check_row.status = 'completed' then
    return transfer_row;
  end if;

  expected_kind := case
    when not exists (select 1 from public.transfer_review_checks where transfer_id = p_transfer_id and check_kind = 'dual_review' and status = 'completed') then 'dual_review'
    when not exists (select 1 from public.transfer_review_checks where transfer_id = p_transfer_id and check_kind = 'escalation' and status = 'completed') then 'escalation'
    when not exists (select 1 from public.transfer_review_checks where transfer_id = p_transfer_id and check_kind = 'compliance' and status = 'completed') then 'compliance'
    else 'final_authorization'
  end;
  if p_check_kind <> expected_kind then
    raise exception 'TRANSFER_REVIEW_CHECK_OUT_OF_ORDER' using errcode = '55000';
  end if;

  old_status := transfer_row.status;

  update public.transfer_review_checks
  set status = 'completed', reviewer_id = caller_id, reviewed_at = now(),
      note = normalized_note
  where id = check_row.id;

  update public.transfer_intents set status = 'under_review'
  where id = p_transfer_id returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason, metadata
  ) values (
    p_transfer_id, caller_id, 'review_check_updated', old_status,
    transfer_row.status, normalized_note,
    jsonb_build_object('check_kind', p_check_kind, 'check_status', 'completed')
  );

  if p_check_kind = 'final_authorization' then
    return public.branch_manager_finalize_transfer(p_transfer_id, normalized_note);
  end if;
  return transfer_row;
end;
$$;

revoke execute on function public.branch_manager_approve_transfer(uuid, text)
  from authenticated;
revoke execute on function public.branch_manager_finalize_transfer(uuid, text)
  from authenticated;
grant execute on function public.branch_manager_review_transfer_check(uuid, text, text)
  to authenticated, service_role;
revoke execute on function public.branch_manager_review_transfer_check(uuid, text, text)
  from public, anon;
