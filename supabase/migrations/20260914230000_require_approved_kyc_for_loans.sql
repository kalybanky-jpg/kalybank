-- A loan application requires a validated KYC identity file
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

  if not exists (
    select 1
    from public.kyc_applications
    where owner_id = caller_id
      and status = 'approved'
  ) then
    raise exception 'APPROVED_KYC_REQUIRED' using errcode = '23514';
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
) from public;

grant execute on function public.submit_loan_application(
  bigint, text, integer, text, jsonb, uuid
) to authenticated;
