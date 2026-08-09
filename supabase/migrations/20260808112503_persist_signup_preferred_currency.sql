-- Separate the immutable contractual currency from the mutable display
-- preference. Existing customers inherit the currency of their canonical
-- current account when possible.
alter table public.profiles
add column base_currency text;

update public.profiles as profile
set base_currency = coalesce(
  (
    select financial_position.currency
    from public.financial_positions as financial_position
    where financial_position.owner_id = profile.user_id
      and financial_position.account_type = 'current'
      and financial_position.currency in ('EUR', 'USD', 'CAD', 'CHF', 'GBP')
    order by
      (financial_position.source_kyc_id is not null) desc,
      (financial_position.account_status = 'active') desc,
      financial_position.opened_at asc nulls last,
      financial_position.created_at asc,
      financial_position.id asc
    limit 1
  ),
  case
    when profile.preferred_currency in ('EUR', 'USD', 'CAD', 'CHF', 'GBP')
    then profile.preferred_currency
  end,
  'EUR'
);

-- Historical values outside the supported application contract are brought
-- back to the newly resolved contractual currency before tightening checks.
update public.profiles
set preferred_currency = base_currency
where preferred_currency not in ('EUR', 'USD', 'CAD', 'CHF', 'GBP');

alter table public.profiles
alter column base_currency set default 'EUR',
alter column base_currency set not null;

alter table public.profiles
drop constraint if exists profiles_preferred_currency_check;

alter table public.profiles
add constraint profiles_preferred_currency_check
check (preferred_currency in ('EUR', 'USD', 'CAD', 'CHF', 'GBP')),
add constraint profiles_base_currency_check
check (base_currency in ('EUR', 'USD', 'CAD', 'CHF', 'GBP'));

create or replace function private.enforce_profile_base_currency_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.base_currency is distinct from old.base_currency then
    raise exception 'PROFILE_BASE_CURRENCY_IMMUTABLE' using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_profile_base_currency_immutability()
from public, anon, authenticated;
grant execute on function private.enforce_profile_base_currency_immutability()
to service_role;

create trigger profiles_enforce_base_currency_immutability
before update of base_currency on public.profiles
for each row
execute function private.enforce_profile_base_currency_immutability();

-- Authenticated customers may change the presentation currency, never the
-- contractual currency selected when their profile was created.
revoke update (base_currency) on table public.profiles from authenticated;

-- raw_user_meta_data is user-controlled. It is safe here only because the
-- selected value is normalized and restricted to the product allowlist.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_currency text;
begin
  signup_currency := upper(trim(coalesce(
    new.raw_user_meta_data ->> 'base_currency',
    new.raw_user_meta_data ->> 'preferred_currency',
    ''
  )));

  if signup_currency = '' then
    raise exception 'SIGNUP_CURRENCY_REQUIRED' using errcode = '22023';
  end if;

  if signup_currency not in ('EUR', 'USD', 'CAD', 'CHF', 'GBP') then
    raise exception 'SIGNUP_CURRENCY_UNSUPPORTED' using errcode = '22023';
  end if;

  insert into public.profiles (
    user_id,
    email,
    display_name,
    base_currency,
    preferred_currency,
    preferred_language
  )
  values (
    new.id,
    coalesce(new.email, ''),
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')),
    signup_currency,
    signup_currency,
    case
      when new.raw_user_meta_data ->> 'preferred_language'
        in ('fr', 'en', 'de', 'es')
      then new.raw_user_meta_data ->> 'preferred_language'
      else 'fr'
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user()
from public, anon, authenticated;
grant execute on function private.handle_new_user()
to service_role;

-- KYC approval always opens the contractual account in base_currency. A later
-- display preference change cannot alter the currency of that account.
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
to authenticated, service_role;

-- A loan is a contractual product and must remain denominated in the immutable
-- base currency, not in the customer's mutable display preference.
create or replace function public.submit_loan_application(
  p_requested_amount_minor bigint,
  p_currency text,
  p_duration_months integer,
  p_motive_code text,
  p_document_object_paths jsonb,
  p_idempotency_key uuid
) returns public.loan_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  caller_base_currency text;
  loan_row public.loan_applications;
  product_settings public.loan_product_settings;
  new_loan_id uuid := gen_random_uuid();
  normalized_currency text := upper(trim(coalesce(p_currency, '')));
  generated_reference text;
  canonical_motive text;
  monthly_rate numeric;
  compound_factor numeric;
  calculated_monthly_payment_minor bigint;
begin
  if p_idempotency_key is null then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select profile.base_currency
  into caller_base_currency
  from public.profiles as profile
  where profile.user_id = caller_id;

  if normalized_currency is distinct from caller_base_currency then
    raise exception 'LOAN_CURRENCY_MUST_MATCH_BASE' using errcode = '22023';
  end if;

  select *
  into loan_row
  from public.loan_applications
  where owner_id = caller_id
    and idempotency_key = p_idempotency_key;

  if loan_row.id is not null then
    return loan_row;
  end if;

  if p_motive_code is null
    or p_motive_code not in (
      'personal',
      'real_estate',
      'vehicle',
      'renovation',
      'business_cashflow',
      'other'
    )
  then
    raise exception 'INVALID_LOAN_MOTIVE_CODE' using errcode = '22023';
  end if;
  if p_document_object_paths is null
    or jsonb_typeof(p_document_object_paths) <> 'array'
  then
    raise exception 'INVALID_LOAN_DOCUMENTS' using errcode = '22023';
  end if;

  select *
  into product_settings
  from public.loan_product_settings
  where currency = normalized_currency;

  if product_settings.currency is null or not product_settings.is_active then
    raise exception 'LOAN_PRODUCT_UNAVAILABLE' using errcode = '22023';
  end if;
  if p_requested_amount_minor is null
    or p_requested_amount_minor < product_settings.minimum_amount_minor
    or p_requested_amount_minor > product_settings.maximum_amount_minor
  then
    raise exception 'LOAN_AMOUNT_OUT_OF_RANGE' using errcode = '22023';
  end if;
  if p_duration_months is null
    or p_duration_months < product_settings.minimum_duration_months
    or p_duration_months > product_settings.maximum_duration_months
  then
    raise exception 'LOAN_DURATION_OUT_OF_RANGE' using errcode = '22023';
  end if;
  if (
    (p_duration_months - product_settings.minimum_duration_months)
    % product_settings.duration_step_months
  ) <> 0
  then
    raise exception 'LOAN_DURATION_STEP_MISMATCH' using errcode = '22023';
  end if;

  if product_settings.fixed_annual_rate = 0 then
    calculated_monthly_payment_minor :=
      round(p_requested_amount_minor::numeric / p_duration_months)::bigint;
  else
    monthly_rate := product_settings.fixed_annual_rate / 12;
    compound_factor := power(1 + monthly_rate, p_duration_months);
    calculated_monthly_payment_minor := round(
      p_requested_amount_minor::numeric
      * monthly_rate
      * compound_factor
      / (compound_factor - 1)
    )::bigint;
  end if;

  canonical_motive := case p_motive_code
    when 'personal' then 'Projet personnel'
    when 'real_estate' then 'Projet immobilier'
    when 'vehicle' then 'Achat d’un véhicule'
    when 'renovation' then 'Travaux et rénovation'
    when 'business_cashflow' then 'Trésorerie professionnelle'
    else 'Autre'
  end;
  generated_reference := product_settings.reference_prefix
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
    motive_code,
    document_object_paths
  ) values (
    new_loan_id,
    caller_id,
    p_idempotency_key,
    generated_reference,
    p_requested_amount_minor,
    normalized_currency,
    p_duration_months,
    calculated_monthly_payment_minor,
    product_settings.fixed_annual_rate,
    canonical_motive,
    p_motive_code,
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

  insert into public.loan_events (loan_id, actor_id, event_type, to_status)
  values (loan_row.id, caller_id, 'submitted', 'submitted');

  insert into public.notifications (
    recipient_id,
    title,
    message,
    notification_type,
    message_key,
    message_params
  ) values (
    caller_id,
    'Demande de prêt enregistrée',
    'La demande de prêt a été transmise pour analyse.',
    'loan',
    'loan_submitted',
    jsonb_build_object('reference', loan_row.reference)
  );

  return loan_row;
end;
$$;

revoke all on function public.submit_loan_application(
  bigint, text, integer, text, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.submit_loan_application(
  bigint, text, integer, text, jsonb, uuid
) to authenticated, service_role;
