-- KYC lifecycle, resumable drafts, structured human review and automatic
-- internal account opening. Evidence rows and storage objects are overwritten:
-- no historical document version is retained.

alter table public.notifications
  add column if not exists action_path text;

alter table public.notifications
  add constraint notifications_action_path_check
  check (
    action_path is null
    or (
      char_length(action_path) between 1 and 500
      and action_path like '/%'
      and action_path not like '//%'
    )
  );

alter table public.kyc_applications
  add column if not exists document_type text,
  add column if not exists document_number text,
  add column if not exists issuing_country text,
  add column if not exists document_expires_on date,
  add column if not exists requested_items text[] not null default '{}',
  add column if not exists correction_reason_code text,
  add column if not exists correction_due_at timestamptz;

alter table public.kyc_applications
  drop constraint if exists kyc_applications_status_check;
alter table public.kyc_applications
  add constraint kyc_applications_status_check
  check (
    status in (
      'submitted',
      'under_review',
      'needs_information',
      'resubmitted',
      'approved',
      'rejected'
    )
  );

alter table public.kyc_applications
  add constraint kyc_applications_document_type_check
  check (
    document_type is null
    or document_type in (
      'national_identity_card',
      'passport',
      'residence_permit'
    )
  ),
  add constraint kyc_applications_document_number_check
  check (
    document_number is null
    or char_length(document_number) between 2 and 100
  ),
  add constraint kyc_applications_issuing_country_check
  check (
    issuing_country is null
    or char_length(issuing_country) between 2 and 100
  ),
  add constraint kyc_applications_requested_items_check
  check (
    requested_items <@ array[
      'identity',
      'birth',
      'address',
      'profile',
      'document_metadata',
      'id_front',
      'id_back',
      'selfie',
      'proof_of_address'
    ]::text[]
  ),
  add constraint kyc_applications_correction_reason_code_check
  check (
    correction_reason_code is null
    or correction_reason_code in (
      'unreadable_document',
      'expired_document',
      'inconsistent_information',
      'missing_document',
      'selfie_mismatch',
      'address_not_verified',
      'regulatory_information',
      'other'
    )
  ),
  add constraint kyc_applications_correction_state_check
  check (
    status in ('needs_information', 'rejected')
    or (
      cardinality(requested_items) = 0
      and correction_reason_code is null
      and correction_due_at is null
    )
  );

create table public.kyc_drafts (
  owner_id uuid primary key references public.profiles(user_id) on delete cascade,
  current_step integer not null default 0 check (current_step between 0 and 8),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  document_object_paths jsonb not null default '{}'::jsonb
    check (jsonb_typeof(document_object_paths) = 'object'),
  preferred_language text not null default 'fr'
    check (preferred_language in ('fr', 'en', 'de', 'es')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger kyc_drafts_set_updated_at
before update on public.kyc_drafts
for each row execute function private.set_updated_at();

alter table public.kyc_drafts enable row level security;
create policy kyc_drafts_select_own
on public.kyc_drafts for select to authenticated
using (owner_id = (select auth.uid()));

revoke all on table public.kyc_drafts from public, anon;
grant select on table public.kyc_drafts to authenticated;
grant all on table public.kyc_drafts to service_role;

create table public.kyc_review_checklists (
  kyc_id uuid primary key
    references public.kyc_applications(id) on delete cascade,
  document_quality text not null default 'pending',
  data_consistency text not null default 'pending',
  selfie_match text not null default 'pending',
  adulthood text not null default 'pending',
  fatca text not null default 'pending',
  pep text not null default 'pending',
  internal_comments text,
  updated_by uuid references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyc_review_checklists_states_check check (
    document_quality in ('pending', 'compliant', 'non_compliant')
    and data_consistency in ('pending', 'compliant', 'non_compliant')
    and selfie_match in ('pending', 'compliant', 'non_compliant')
    and adulthood in ('pending', 'compliant', 'non_compliant')
    and fatca in ('pending', 'compliant', 'non_compliant')
    and pep in ('pending', 'compliant', 'non_compliant')
  ),
  constraint kyc_review_checklists_comments_check check (
    internal_comments is null or char_length(internal_comments) <= 2000
  )
);

create trigger kyc_review_checklists_set_updated_at
before update on public.kyc_review_checklists
for each row execute function private.set_updated_at();

alter table public.kyc_review_checklists enable row level security;
create policy kyc_review_checklists_staff_select
on public.kyc_review_checklists for select to authenticated
using ((select private.is_active_staff(null)));

revoke all on table public.kyc_review_checklists from public, anon;
grant select on table public.kyc_review_checklists to authenticated;
grant all on table public.kyc_review_checklists to service_role;

create policy kyc_evidence_update_current_requested
on storage.objects for update to authenticated
using (
  bucket_id = 'kyc-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    not exists (
      select 1
      from public.kyc_applications
      where owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.kyc_applications
      where owner_id = (select auth.uid())
        and status in ('needs_information', 'rejected')
        and split_part(storage.filename(name), '.', 1) = any(requested_items)
    )
  )
)
with check (
  bucket_id = 'kyc-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.financial_positions
  add column if not exists source_kyc_id uuid
  references public.kyc_applications(id);

create unique index financial_positions_source_kyc_uidx
  on public.financial_positions (source_kyc_id)
  where source_kyc_id is not null;

alter table public.financial_positions
  drop constraint if exists financial_positions_active_account_check;
alter table public.financial_positions
  add constraint financial_positions_active_account_check
  check (
    account_status <> 'active'
    or (
      account_number is not null
      and account_holder_name is not null
      and opened_at is not null
      and declared_by is not null
    )
  );

alter table public.transactional_email_outbox
  drop constraint if exists transactional_email_outbox_template_key_check,
  drop constraint if exists transactional_email_outbox_entity_type_check;
alter table public.transactional_email_outbox
  add constraint transactional_email_outbox_template_key_check
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
      'loan_failed',
      'kyc_submitted',
      'kyc_information_requested',
      'kyc_resubmitted',
      'kyc_approved',
      'kyc_rejected'
    )
  ),
  add constraint transactional_email_outbox_entity_type_check
  check (entity_type in ('transfer', 'loan', 'kyc'));

create or replace function private.allocate_internal_account_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  configuration private.account_number_configuration;
  suffix_width integer;
  suffix_capacity integer;
  random_start integer;
  generated_number text;
begin
  select *
  into configuration
  from private.account_number_configuration
  where singleton
  for update;

  if not found then
    -- Safe operational default: a branch manager may later configure the
    -- bank's own 5-to-9 digit prefix from Settings.
    configuration.prefix := '10000';
  end if;

  suffix_width := 10 - char_length(configuration.prefix);
  suffix_capacity := power(10::numeric, suffix_width)::integer;
  random_start := floor(random() * suffix_capacity)::integer;

  select
    configuration.prefix
    || lpad(
      ((random_start + candidate.offset_value) % suffix_capacity)::text,
      suffix_width,
      '0'
    )
  into generated_number
  from generate_series(0, suffix_capacity - 1) as candidate(offset_value)
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

  if generated_number is null then
    raise exception 'ACCOUNT_NUMBER_PREFIX_EXHAUSTED'
      using errcode = '54000';
  end if;

  return generated_number;
end;
$$;

revoke all on function private.allocate_internal_account_number()
from public, anon, authenticated;

create or replace function public.save_kyc_draft(
  p_current_step integer,
  p_payload jsonb,
  p_document_object_paths jsonb,
  p_preferred_language text
)
returns public.kyc_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  draft_row public.kyc_drafts;
begin
  if p_current_step not between 0 and 8
     or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_document_object_paths, '{}'::jsonb)) <> 'object'
     or p_preferred_language not in ('fr', 'en', 'de', 'es') then
    raise exception 'INVALID_KYC_DRAFT' using errcode = '22023';
  end if;

  insert into public.kyc_drafts (
    owner_id,
    current_step,
    payload,
    document_object_paths,
    preferred_language
  )
  values (
    caller_id,
    p_current_step,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_document_object_paths, '{}'::jsonb),
    p_preferred_language
  )
  on conflict (owner_id) do update
  set
    current_step = excluded.current_step,
    payload = excluded.payload,
    document_object_paths = excluded.document_object_paths,
    preferred_language = excluded.preferred_language
  returning * into draft_row;

  return draft_row;
end;
$$;

revoke all on function public.save_kyc_draft(integer, jsonb, jsonb, text)
from public, anon;
grant execute on function public.save_kyc_draft(integer, jsonb, jsonb, text)
to authenticated;

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
     or not (p_document_object_paths ? 'selfie')
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

drop function if exists public.submit_kyc_application(
  text, text, date, text, text, jsonb, text, text,
  boolean, boolean, jsonb, uuid
);

create function public.submit_kyc_application(
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
  p_document_type text,
  p_document_number text,
  p_issuing_country text,
  p_document_expires_on date,
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
  perform private.validate_kyc_submission(
    p_first_name,
    p_last_name,
    p_date_of_birth,
    p_place_of_birth,
    p_nationality,
    p_address,
    p_occupation,
    p_income_range,
    p_document_type,
    p_document_number,
    p_issuing_country,
    p_document_expires_on,
    p_document_object_paths
  );

  if exists (
    select 1
    from public.kyc_applications
    where owner_id = caller_id
  ) then
    raise exception 'KYC_APPLICATION_ALREADY_EXISTS' using errcode = '23505';
  end if;

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
    document_type,
    document_number,
    issuing_country,
    document_expires_on,
    document_object_paths,
    status
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
    p_document_type,
    trim(p_document_number),
    trim(p_issuing_country),
    p_document_expires_on,
    p_document_object_paths,
    'submitted'
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

  insert into public.kyc_events (
    kyc_id, actor_id, event_type, to_status
  )
  values (kyc_row.id, caller_id, 'submitted', 'submitted');

  delete from public.kyc_drafts where owner_id = caller_id;
  return kyc_row;
end;
$$;

revoke all on function public.submit_kyc_application(
  text, text, date, text, text, jsonb, text, text,
  boolean, boolean, text, text, text, date, jsonb, uuid
) from public, anon;
grant execute on function public.submit_kyc_application(
  text, text, date, text, text, jsonb, text, text,
  boolean, boolean, text, text, text, date, jsonb, uuid
) to authenticated;

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

  insert into public.kyc_review_checklists (kyc_id, updated_by)
  values (p_kyc_id, caller_id)
  on conflict (kyc_id) do update
  set
    document_quality = 'pending',
    data_consistency = 'pending',
    selfie_match = 'pending',
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
grant execute on function public.begin_kyc_review(uuid) to authenticated;

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
begin
  if caller_id is null
     or not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.kyc_applications
    where id = p_kyc_id and status = 'under_review'
  ) then
    raise exception 'KYC_NOT_UNDER_REVIEW' using errcode = '55000';
  end if;

  update public.kyc_review_checklists
  set
    document_quality = p_document_quality,
    data_consistency = p_data_consistency,
    selfie_match = p_selfie_match,
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
) to authenticated;

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
         'id_front', 'id_back', 'selfie', 'proof_of_address'
       ]::text[]
     )
     or p_reason_code not in (
       'unreadable_document', 'expired_document',
       'inconsistent_information', 'missing_document', 'selfie_mismatch',
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
) to authenticated;

create or replace function public.resubmit_kyc_application(
  p_kyc_id uuid,
  p_changes jsonb,
  p_document_object_paths jsonb
)
returns public.kyc_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  kyc_row public.kyc_applications;
  item text;
  merged_paths jsonb;
  old_status text;
begin
  select * into kyc_row
  from public.kyc_applications
  where id = p_kyc_id and owner_id = caller_id
  for update;

  if not found then
    raise exception 'KYC_NOT_FOUND' using errcode = 'P0002';
  end if;
  if kyc_row.status not in ('needs_information', 'rejected') then
    raise exception 'INVALID_KYC_TRANSITION' using errcode = '55000';
  end if;
  old_status := kyc_row.status;
  if jsonb_typeof(coalesce(p_changes, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_document_object_paths, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_KYC_CORRECTION' using errcode = '22023';
  end if;

  for item in select jsonb_object_keys(coalesce(p_changes, '{}'::jsonb))
  loop
    if not (item = any(kyc_row.requested_items)) then
      raise exception 'UNREQUESTED_KYC_FIELD' using errcode = '42501';
    end if;
  end loop;
  for item in select jsonb_object_keys(coalesce(p_document_object_paths, '{}'::jsonb))
  loop
    if not (item = any(kyc_row.requested_items)) then
      raise exception 'UNREQUESTED_KYC_DOCUMENT' using errcode = '42501';
    end if;
  end loop;

  merged_paths := kyc_row.document_object_paths
    || coalesce(p_document_object_paths, '{}'::jsonb);

  update public.kyc_applications
  set
    first_name = case when 'identity' = any(requested_items)
      then trim(coalesce(p_changes #>> '{identity,firstName}', first_name))
      else first_name end,
    last_name = case when 'identity' = any(requested_items)
      then trim(coalesce(p_changes #>> '{identity,lastName}', last_name))
      else last_name end,
    place_of_birth = case when 'identity' = any(requested_items)
      then trim(coalesce(p_changes #>> '{identity,placeOfBirth}', place_of_birth))
      else place_of_birth end,
    nationality = case when 'identity' = any(requested_items)
      then trim(coalesce(p_changes #>> '{identity,nationality}', nationality))
      else nationality end,
    date_of_birth = case when 'birth' = any(requested_items)
      then coalesce((p_changes ->> 'birth')::date, date_of_birth)
      else date_of_birth end,
    address = case when 'address' = any(requested_items)
      then coalesce(p_changes -> 'address', address)
      else address end,
    occupation = case when 'profile' = any(requested_items)
      then trim(coalesce(p_changes #>> '{profile,occupation}', occupation))
      else occupation end,
    income_range = case when 'profile' = any(requested_items)
      then trim(coalesce(p_changes #>> '{profile,incomeRange}', income_range))
      else income_range end,
    fatca = case when 'profile' = any(requested_items)
      then coalesce((p_changes #>> '{profile,fatca}')::boolean, fatca)
      else fatca end,
    pep = case when 'profile' = any(requested_items)
      then coalesce((p_changes #>> '{profile,pep}')::boolean, pep)
      else pep end,
    document_type = case when 'document_metadata' = any(requested_items)
      then coalesce(p_changes #>> '{document_metadata,documentType}', document_type)
      else document_type end,
    document_number = case when 'document_metadata' = any(requested_items)
      then trim(coalesce(p_changes #>> '{document_metadata,documentNumber}', document_number))
      else document_number end,
    issuing_country = case when 'document_metadata' = any(requested_items)
      then trim(coalesce(p_changes #>> '{document_metadata,issuingCountry}', issuing_country))
      else issuing_country end,
    document_expires_on = case when 'document_metadata' = any(requested_items)
      then coalesce(
        (p_changes #>> '{document_metadata,documentExpiresOn}')::date,
        document_expires_on
      )
      else document_expires_on end,
    document_object_paths = merged_paths,
    status = 'resubmitted',
    submitted_at = now(),
    reviewed_at = null,
    requested_items = '{}',
    correction_reason_code = null,
    correction_due_at = null
  where id = p_kyc_id
  returning * into kyc_row;

  perform private.validate_kyc_submission(
    kyc_row.first_name,
    kyc_row.last_name,
    kyc_row.date_of_birth,
    kyc_row.place_of_birth,
    kyc_row.nationality,
    kyc_row.address,
    kyc_row.occupation,
    kyc_row.income_range,
    kyc_row.document_type,
    kyc_row.document_number,
    kyc_row.issuing_country,
    kyc_row.document_expires_on,
    kyc_row.document_object_paths
  );

  insert into public.kyc_events (
    kyc_id, actor_id, event_type, from_status, to_status
  )
  values (
    p_kyc_id,
    caller_id,
    'resubmitted',
    old_status,
    'resubmitted'
  );
  return kyc_row;
end;
$$;

revoke all on function public.resubmit_kyc_application(uuid, jsonb, jsonb)
from public, anon;
grant execute on function public.resubmit_kyc_application(uuid, jsonb, jsonb)
to authenticated;

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
  if not found
     or 'pending' in (
       checklist_row.document_quality,
       checklist_row.data_consistency,
       checklist_row.selfie_match,
       checklist_row.adulthood,
       checklist_row.fatca,
       checklist_row.pep
     ) then
    raise exception 'KYC_CHECKLIST_INCOMPLETE' using errcode = '22023';
  end if;

  if p_decision = 'approved' and 'non_compliant' in (
    checklist_row.document_quality,
    checklist_row.data_consistency,
    checklist_row.selfie_match,
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
        profile_row.preferred_currency,
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
          'id_front', 'id_back', 'selfie', 'proof_of_address'
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
to authenticated;

-- The former generic endpoint is intentionally retired. Every transition now
-- has a dedicated RPC and server-side invariant.
revoke all on function public.review_kyc_application(uuid, text, text)
from public, anon, authenticated;

create or replace function private.enqueue_kyc_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  language text;
  email_address text;
  title_text text;
  message_text text;
  template text;
  action_text text;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  template := case new.status
    when 'submitted' then 'kyc_submitted'
    when 'needs_information' then 'kyc_information_requested'
    when 'resubmitted' then 'kyc_resubmitted'
    when 'approved' then 'kyc_approved'
    when 'rejected' then 'kyc_rejected'
    else null
  end;
  if template is null then return new; end if;

  select preferred_language, email
  into language, email_address
  from public.profiles
  where user_id = new.owner_id;

  action_text := '/myaccount?tab=kyc&kyc=' || new.id::text;

  title_text := case language
    when 'en' then case new.status
      when 'submitted' then 'Identity file received'
      when 'needs_information' then 'Action required on your identity file'
      when 'resubmitted' then 'Identity file resubmitted'
      when 'approved' then 'Identity approved'
      else 'Identity file rejected' end
    when 'de' then case new.status
      when 'submitted' then 'Identitätsunterlagen erhalten'
      when 'needs_information' then 'Aktion für Ihre Identitätsprüfung erforderlich'
      when 'resubmitted' then 'Identitätsunterlagen erneut eingereicht'
      when 'approved' then 'Identität bestätigt'
      else 'Identitätsunterlagen abgelehnt' end
    when 'es' then case new.status
      when 'submitted' then 'Expediente de identidad recibido'
      when 'needs_information' then 'Acción necesaria en su expediente'
      when 'resubmitted' then 'Expediente de identidad reenviado'
      when 'approved' then 'Identidad aprobada'
      else 'Expediente de identidad rechazado' end
    else case new.status
      when 'submitted' then 'Dossier d’identité reçu'
      when 'needs_information' then 'Action requise sur votre dossier'
      when 'resubmitted' then 'Dossier d’identité resoumis'
      when 'approved' then 'Identité approuvée'
      else 'Dossier d’identité rejeté' end
  end;

  message_text := case language
    when 'en' then case new.status
      when 'submitted' then 'Your file has been received and is waiting for human review.'
      when 'needs_information' then 'Open your file to correct only the requested items.'
      when 'resubmitted' then 'Your corrections have been received.'
      when 'approved' then 'Your identity is confirmed and your internal account has been created.'
      else 'Open your file to see the reason and resubmit your corrections.' end
    when 'de' then case new.status
      when 'submitted' then 'Ihre Unterlagen wurden empfangen und warten auf die manuelle Prüfung.'
      when 'needs_information' then 'Öffnen Sie Ihre Unterlagen und korrigieren Sie nur die angeforderten Elemente.'
      when 'resubmitted' then 'Ihre Korrekturen wurden empfangen.'
      when 'approved' then 'Ihre Identität wurde bestätigt und Ihr internes Konto erstellt.'
      else 'Öffnen Sie Ihre Unterlagen, prüfen Sie den Grund und reichen Sie Korrekturen ein.' end
    when 'es' then case new.status
      when 'submitted' then 'Su expediente ha sido recibido y espera una revisión humana.'
      when 'needs_information' then 'Abra su expediente y corrija únicamente los elementos solicitados.'
      when 'resubmitted' then 'Hemos recibido sus correcciones.'
      when 'approved' then 'Su identidad está confirmada y se ha creado su cuenta interna.'
      else 'Abra su expediente, consulte el motivo y vuelva a enviar sus correcciones.' end
    else case new.status
      when 'submitted' then 'Votre dossier a été reçu et attend un contrôle humain.'
      when 'needs_information' then 'Ouvrez votre dossier et corrigez uniquement les éléments demandés.'
      when 'resubmitted' then 'Vos corrections ont bien été reçues.'
      when 'approved' then 'Votre identité est confirmée et votre compte interne a été créé.'
      else 'Ouvrez votre dossier, consultez le motif puis resoumettez vos corrections.' end
  end;

  insert into public.notifications (
    recipient_id, title, message, notification_type, action_path
  )
  values (new.owner_id, title_text, message_text, 'kyc', action_text);

  if email_address is not null then
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
      'kyc:' || new.id::text || ':' || new.status || ':' || new.version::text,
      new.owner_id,
      email_address,
      template,
      'kyc',
      new.id,
      jsonb_build_object(
        'actionPath', action_text,
        'reason', new.review_note,
        'dueAt', new.correction_due_at
      )
    )
    on conflict (event_key) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.enqueue_kyc_message()
from public, anon, authenticated, service_role;

drop trigger if exists kyc_enqueue_message on public.kyc_applications;
create trigger kyc_enqueue_message
after insert or update of status on public.kyc_applications
for each row execute function private.enqueue_kyc_message();

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
     or jsonb_typeof(p_document_object_paths) <> 'array' then
    raise exception 'INVALID_LOAN_DOCUMENTS' using errcode = '22023';
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
    select * into loan_row
    from public.loan_applications
    where owner_id = caller_id and idempotency_key = p_idempotency_key;
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
  values (loan_row.id, caller_id, 'submitted', 'submitted');

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

revoke all on function public.submit_loan_application(
  bigint, text, integer, bigint, numeric, text, jsonb, uuid
) from public, anon;
grant execute on function public.submit_loan_application(
  bigint, text, integer, bigint, numeric, text, jsonb, uuid
) to authenticated;
