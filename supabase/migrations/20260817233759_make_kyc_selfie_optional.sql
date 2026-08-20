-- A selfie is optional evidence. Its review state is only applicable when the
-- submitted evidence map actually contains a selfie.
alter table public.kyc_review_checklists
drop constraint kyc_review_checklists_states_check;

alter table public.kyc_review_checklists
add constraint kyc_review_checklists_states_check check (
  document_quality in ('pending', 'compliant', 'non_compliant')
  and data_consistency in ('pending', 'compliant', 'non_compliant')
  and selfie_match in (
    'pending', 'compliant', 'non_compliant', 'not_applicable'
  )
  and adulthood in ('pending', 'compliant', 'non_compliant')
  and fatca in ('pending', 'compliant', 'non_compliant')
  and pep in ('pending', 'compliant', 'non_compliant')
);

-- Normalize only untouched legacy reviews. Explicit human decisions remain
-- auditable and are rejected by the decision RPC until reviewed again.
update public.kyc_review_checklists as checklist
set selfie_match = 'not_applicable'
from public.kyc_applications as application
where application.id = checklist.kyc_id
  and not (application.document_object_paths ? 'selfie')
  and checklist.selfie_match = 'pending';

create or replace function private.validate_kyc_submission(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_place_of_birth text,
  p_nationality text,
  p_address jsonb,
  p_occupation text,
  p_income_range text,
  p_document_type text,
  p_document_number text,
  p_issuing_country text,
  p_document_expires_on date,
  p_document_object_paths jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(p_first_name, '')), '') is null
     or nullif(trim(coalesce(p_last_name, '')), '') is null
     or p_date_of_birth is null
     or p_date_of_birth > current_date - interval '18 years'
     or nullif(trim(coalesce(p_place_of_birth, '')), '') is null
     or nullif(trim(coalesce(p_nationality, '')), '') is null
     or jsonb_typeof(p_address) <> 'object'
     or nullif(trim(coalesce(p_address ->> 'street', '')), '') is null
     or nullif(trim(coalesce(p_address ->> 'postalCode', '')), '') is null
     or nullif(trim(coalesce(p_address ->> 'city', '')), '') is null
     or nullif(trim(coalesce(p_address ->> 'country', '')), '') is null
     or nullif(trim(coalesce(p_occupation, '')), '') is null
     or nullif(trim(coalesce(p_income_range, '')), '') is null
     or p_document_type not in (
       'national_identity_card',
       'passport',
       'residence_permit'
     )
     or nullif(trim(coalesce(p_document_number, '')), '') is null
     or nullif(trim(coalesce(p_issuing_country, '')), '') is null
     or p_document_expires_on is null
     or p_document_expires_on < current_date
     or jsonb_typeof(p_document_object_paths) <> 'object'
     or not (p_document_object_paths ? 'id_front')
     or not (p_document_object_paths ? 'proof_of_address')
     or (
       p_document_type <> 'passport'
       and not (p_document_object_paths ? 'id_back')
     ) then
    raise exception 'INVALID_OR_INCOMPLETE_KYC' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_kyc_submission(
  text, text, date, text, text, jsonb, text, text,
  text, text, text, date, jsonb
) from public, anon, authenticated;
grant execute on function private.validate_kyc_submission(
  text, text, date, text, text, jsonb, text, text,
  text, text, text, date, jsonb
) to service_role;

create or replace function public.begin_kyc_review(p_kyc_id uuid)
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
  if caller_id is null
     or not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  select * into kyc_row
  from public.kyc_applications
  where id = p_kyc_id
  for update;

  if not found then
    raise exception 'KYC_NOT_FOUND' using errcode = 'P0002';
  end if;
  if kyc_row.status not in ('submitted', 'resubmitted') then
    raise exception 'INVALID_KYC_TRANSITION' using errcode = '55000';
  end if;

  old_status := kyc_row.status;
  update public.kyc_applications
  set
    status = 'under_review',
    reviewed_by = caller_id,
    reviewed_at = null,
    review_note = null,
    requested_items = '{}',
    correction_reason_code = null,
    correction_due_at = null
  where id = p_kyc_id
  returning * into kyc_row;

  insert into public.kyc_review_checklists (
    kyc_id,
    selfie_match,
    updated_by
  )
  values (
    p_kyc_id,
    case
      when kyc_row.document_object_paths ? 'selfie' then 'pending'
      else 'not_applicable'
    end,
    caller_id
  )
  on conflict (kyc_id) do update
  set
    document_quality = 'pending',
    data_consistency = 'pending',
    selfie_match = case
      when kyc_row.document_object_paths ? 'selfie' then 'pending'
      else 'not_applicable'
    end,
    adulthood = 'pending',
    fatca = 'pending',
    pep = 'pending',
    internal_comments = null,
    updated_by = caller_id;

  insert into public.kyc_events (
    kyc_id, actor_id, event_type, from_status, to_status
  )
  values (p_kyc_id, caller_id, 'review_started', old_status, 'under_review');

  return kyc_row;
end;
$$;

revoke all on function public.begin_kyc_review(uuid) from public, anon;
grant execute on function public.begin_kyc_review(uuid)
to authenticated, service_role;

create or replace function public.update_kyc_review_checklist(
  p_kyc_id uuid,
  p_document_quality text,
  p_data_consistency text,
  p_selfie_match text,
  p_adulthood text,
  p_fatca text,
  p_pep text,
  p_internal_comments text
)
returns public.kyc_review_checklists
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  checklist_row public.kyc_review_checklists;
  has_selfie boolean;
begin
  if caller_id is null
     or not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  select application.document_object_paths ? 'selfie'
  into has_selfie
  from public.kyc_applications as application
  where application.id = p_kyc_id
    and application.status = 'under_review'
  for update;

  if not found then
    raise exception 'KYC_NOT_UNDER_REVIEW' using errcode = '55000';
  end if;
  if has_selfie and p_selfie_match = 'not_applicable' then
    raise exception 'INVALID_KYC_SELFIE_REVIEW_STATE' using errcode = '22023';
  end if;

  update public.kyc_review_checklists
  set
    document_quality = p_document_quality,
    data_consistency = p_data_consistency,
    selfie_match = case
      when has_selfie then p_selfie_match
      else 'not_applicable'
    end,
    adulthood = p_adulthood,
    fatca = p_fatca,
    pep = p_pep,
    internal_comments = nullif(trim(coalesce(p_internal_comments, '')), ''),
    updated_by = caller_id
  where kyc_id = p_kyc_id
  returning * into checklist_row;

  if not found then
    raise exception 'KYC_CHECKLIST_NOT_FOUND' using errcode = 'P0002';
  end if;
  return checklist_row;
end;
$$;

revoke all on function public.update_kyc_review_checklist(
  uuid, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.update_kyc_review_checklist(
  uuid, text, text, text, text, text, text, text
) to authenticated, service_role;

create or replace function public.request_kyc_information(
  p_kyc_id uuid,
  p_requested_items text[],
  p_reason_code text,
  p_note text,
  p_due_at timestamptz
)
returns public.kyc_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  kyc_row public.kyc_applications;
begin
  if caller_id is null
     or not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_requested_items, '{}')) = 0
     or not (
       p_requested_items <@ array[
         'identity', 'birth', 'address', 'profile', 'document_metadata',
         'id_front', 'id_back', 'proof_of_address'
       ]::text[]
     )
     or p_reason_code not in (
       'unreadable_document', 'expired_document',
       'inconsistent_information', 'missing_document',
       'address_not_verified', 'regulatory_information', 'other'
     )
     or nullif(trim(coalesce(p_note, '')), '') is null
     or (p_due_at is not null and p_due_at <= now()) then
    raise exception 'INVALID_KYC_INFORMATION_REQUEST' using errcode = '22023';
  end if;

  update public.kyc_applications
  set
    status = 'needs_information',
    requested_items = p_requested_items,
    correction_reason_code = p_reason_code,
    correction_due_at = p_due_at,
    review_note = trim(p_note),
    reviewed_by = caller_id,
    reviewed_at = null
  where id = p_kyc_id and status = 'under_review'
  returning * into kyc_row;

  if not found then
    raise exception 'INVALID_KYC_TRANSITION' using errcode = '55000';
  end if;

  insert into public.kyc_events (
    kyc_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_kyc_id,
    caller_id,
    'information_requested',
    'under_review',
    'needs_information',
    trim(p_note)
  );
  return kyc_row;
end;
$$;

revoke all on function public.request_kyc_information(
  uuid, text[], text, text, timestamptz
) from public, anon;
grant execute on function public.request_kyc_information(
  uuid, text[], text, text, timestamptz
) to authenticated, service_role;

-- Keep the final base-currency-aware decision implementation while treating a
-- supplied selfie as consultative evidence: it must be reviewed, but a mismatch
-- alone cannot prevent approval and can never become a requested correction.
create or replace function public.decide_kyc_application(
  p_kyc_id uuid,
  p_decision text,
  p_reason_code text,
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
  checklist_row public.kyc_review_checklists;
  profile_row public.profiles;
  account_row public.financial_positions;
  internal_number text;
begin
  if caller_id is null
     or not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_KYC_DECISION' using errcode = '22023';
  end if;

  select * into kyc_row
  from public.kyc_applications
  where id = p_kyc_id
  for update;
  if not found or kyc_row.status <> 'under_review' then
    raise exception 'KYC_NOT_UNDER_REVIEW' using errcode = '55000';
  end if;

  select * into checklist_row
  from public.kyc_review_checklists
  where kyc_id = p_kyc_id;
  if not found then
    raise exception 'KYC_CHECKLIST_INCOMPLETE' using errcode = '22023';
  end if;
  if (
       not (kyc_row.document_object_paths ? 'selfie')
       and checklist_row.selfie_match <> 'not_applicable'
     )
     or (
       kyc_row.document_object_paths ? 'selfie'
       and checklist_row.selfie_match = 'not_applicable'
     ) then
    raise exception 'INVALID_KYC_SELFIE_REVIEW_STATE' using errcode = '23514';
  end if;
  if 'pending' in (
    checklist_row.document_quality,
    checklist_row.data_consistency,
    checklist_row.selfie_match,
    checklist_row.adulthood,
    checklist_row.fatca,
    checklist_row.pep
  ) then
    raise exception 'KYC_CHECKLIST_INCOMPLETE' using errcode = '22023';
  end if;

  if p_reason_code = 'selfie_mismatch' then
    raise exception 'INVALID_KYC_DECISION_REASON' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and not ('non_compliant' in (
    checklist_row.document_quality,
    checklist_row.data_consistency,
    checklist_row.adulthood,
    checklist_row.fatca,
    checklist_row.pep
  )) then
    raise exception 'KYC_REJECTION_REQUIRES_MANDATORY_FAILURE'
      using errcode = '23514';
  end if;

  if p_decision = 'approved' and 'non_compliant' in (
    checklist_row.document_quality,
    checklist_row.data_consistency,
    checklist_row.adulthood,
    checklist_row.fatca,
    checklist_row.pep
  ) then
    raise exception 'KYC_CHECKLIST_NOT_COMPLIANT' using errcode = '23514';
  end if;
  if p_decision = 'rejected'
     and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'KYC_REJECTION_REASON_REQUIRED' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    select * into profile_row
    from public.profiles
    where user_id = kyc_row.owner_id;

    select * into account_row
    from public.financial_positions
    where source_kyc_id = p_kyc_id;

    if not found then
      internal_number := private.allocate_internal_account_number();
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
        account_holder_name,
        account_status,
        opened_at,
        declared_by,
        is_demo,
        declaration_idempotency_key,
        source_kyc_id
      )
      values (
        kyc_row.owner_id,
        'Compte courant',
        'internally_reconciled',
        profile_row.base_currency,
        0,
        0,
        now(),
        '••••' || right(internal_number, 4),
        'current',
        internal_number,
        trim(kyc_row.first_name || ' ' || kyc_row.last_name),
        'active',
        now(),
        caller_id,
        false,
        p_kyc_id,
        p_kyc_id
      )
      returning * into account_row;

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
        account_row.id,
        account_row.owner_id,
        1,
        'kyc-account-opening:' || p_kyc_id::text,
        'account_opening',
        0,
        account_row.currency,
        0,
        0,
        now(),
        'KYC-ACCOUNT-' || upper(replace(p_kyc_id::text, '-', '')),
        caller_id,
        'Ouverture automatique après approbation KYC',
        jsonb_build_object('kyc_id', p_kyc_id)
      );
    end if;
  end if;

  update public.kyc_applications
  set
    status = p_decision,
    reviewed_by = caller_id,
    reviewed_at = now(),
    review_note = nullif(trim(coalesce(p_note, '')), ''),
    requested_items = case
      when p_decision = 'rejected'
        then array[
          'identity', 'birth', 'address', 'profile', 'document_metadata',
          'id_front', 'id_back', 'proof_of_address'
        ]::text[]
      else '{}'
    end,
    correction_reason_code = case
      when p_decision = 'rejected' then coalesce(p_reason_code, 'other')
      else null
    end,
    correction_due_at = null
  where id = p_kyc_id
  returning * into kyc_row;

  insert into public.kyc_events (
    kyc_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_kyc_id,
    caller_id,
    'decided',
    'under_review',
    p_decision,
    nullif(trim(coalesce(p_note, '')), '')
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'decide_kyc',
    'kyc_application',
    p_kyc_id,
    jsonb_build_object(
      'decision', p_decision,
      'account_id', account_row.id,
      'account_number', account_row.account_number
    )
  );

  return kyc_row;
end;
$$;

revoke all on function public.decide_kyc_application(uuid, text, text, text)
from public, anon;
grant execute on function public.decide_kyc_application(uuid, text, text, text)
to authenticated, service_role;
