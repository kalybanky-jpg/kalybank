create table public.loan_product_settings (
  currency text primary key,
  minimum_amount_minor bigint not null,
  maximum_amount_minor bigint not null,
  minimum_duration_months integer not null,
  maximum_duration_months integer not null,
  duration_step_months integer not null,
  fixed_annual_rate numeric(8, 5) not null,
  reference_prefix text not null,
  is_active boolean not null default true,
  updated_by uuid references public.staff_members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loan_product_settings_currency_check
    check (currency in ('EUR', 'USD', 'CAD', 'CHF', 'GBP')),
  constraint loan_product_settings_amount_range_check
    check (
      minimum_amount_minor > 0
      and minimum_amount_minor < maximum_amount_minor
      and maximum_amount_minor <= 1000000000000000
    ),
  constraint loan_product_settings_duration_range_check
    check (
      minimum_duration_months > 0
      and minimum_duration_months <= maximum_duration_months
      and maximum_duration_months <= 600
      and duration_step_months > 0
      and (
        (maximum_duration_months - minimum_duration_months)
        % duration_step_months
      ) = 0
    ),
  constraint loan_product_settings_fixed_annual_rate_check
    check (fixed_annual_rate between 0 and 1),
  constraint loan_product_settings_reference_prefix_check
    check (reference_prefix ~ '^[A-Za-z0-9_-]{1,24}$')
);

comment on table public.loan_product_settings is
  'Server-authoritative loan limits, fixed annual rate, and reference prefix by currency.';
comment on column public.loan_product_settings.fixed_annual_rate is
  'Annual rate represented as a decimal; 0.035 means 3.5 percent.';

create trigger loan_product_settings_set_updated_at
before update on public.loan_product_settings
for each row execute function private.set_updated_at();

alter table public.loan_product_settings enable row level security;

create policy loan_product_settings_authenticated_select
on public.loan_product_settings
for select
to authenticated
using (true);

revoke all on table public.loan_product_settings
from public, anon, authenticated, service_role;
grant select on table public.loan_product_settings to authenticated;

insert into public.loan_product_settings (
  currency,
  minimum_amount_minor,
  maximum_amount_minor,
  minimum_duration_months,
  maximum_duration_months,
  duration_step_months,
  fixed_annual_rate,
  reference_prefix,
  is_active
)
select
  currency,
  100000,
  5000000,
  12,
  84,
  6,
  0.035,
  'Monalyz-',
  true
from unnest(array['EUR', 'USD', 'CAD', 'CHF', 'GBP']) as currency;

create function public.update_loan_product_settings(
  p_currency text,
  p_minimum_amount_minor bigint,
  p_maximum_amount_minor bigint,
  p_minimum_duration_months integer,
  p_maximum_duration_months integer,
  p_duration_step_months integer,
  p_fixed_annual_rate numeric,
  p_reference_prefix text,
  p_is_active boolean
) returns public.loan_product_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  normalized_currency text := upper(trim(coalesce(p_currency, '')));
  normalized_prefix text := trim(coalesce(p_reference_prefix, ''));
  previous_settings public.loan_product_settings;
  updated_settings public.loan_product_settings;
begin
  if normalized_currency not in ('EUR', 'USD', 'CAD', 'CHF', 'GBP') then
    raise exception 'INVALID_LOAN_PRODUCT_CURRENCY' using errcode = '22023';
  end if;
  if p_minimum_amount_minor is null
    or p_maximum_amount_minor is null
    or p_minimum_amount_minor <= 0
    or p_minimum_amount_minor >= p_maximum_amount_minor
    or p_maximum_amount_minor > 1000000000000000
  then
    raise exception 'INVALID_LOAN_AMOUNT_RANGE' using errcode = '22023';
  end if;
  if p_minimum_duration_months is null
    or p_maximum_duration_months is null
    or p_minimum_duration_months <= 0
    or p_minimum_duration_months > p_maximum_duration_months
    or p_maximum_duration_months > 600
  then
    raise exception 'INVALID_LOAN_DURATION_RANGE' using errcode = '22023';
  end if;
  if p_duration_step_months is null
    or p_duration_step_months <= 0
    or (
      (p_maximum_duration_months - p_minimum_duration_months)
      % p_duration_step_months
    ) <> 0
  then
    raise exception 'INVALID_LOAN_DURATION_STEP' using errcode = '22023';
  end if;
  if p_fixed_annual_rate is null
    or p_fixed_annual_rate < 0
    or p_fixed_annual_rate > 1
  then
    raise exception 'INVALID_LOAN_ANNUAL_RATE' using errcode = '22023';
  end if;
  if normalized_prefix !~ '^[A-Za-z0-9_-]{1,24}$' then
    raise exception 'INVALID_LOAN_REFERENCE_PREFIX' using errcode = '22023';
  end if;
  if p_is_active is null then
    raise exception 'INVALID_LOAN_PRODUCT_STATUS' using errcode = '22023';
  end if;

  select *
  into previous_settings
  from public.loan_product_settings
  where currency = normalized_currency
  for update;

  if previous_settings.currency is null then
    raise exception 'LOAN_PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.loan_product_settings
  set
    minimum_amount_minor = p_minimum_amount_minor,
    maximum_amount_minor = p_maximum_amount_minor,
    minimum_duration_months = p_minimum_duration_months,
    maximum_duration_months = p_maximum_duration_months,
    duration_step_months = p_duration_step_months,
    fixed_annual_rate = p_fixed_annual_rate,
    reference_prefix = normalized_prefix,
    is_active = p_is_active,
    updated_by = caller_id
  where currency = normalized_currency
  returning * into updated_settings;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    caller_id,
    'branch_manager_update_loan_product_settings',
    'loan_product_settings',
    null,
    jsonb_build_object(
      'currency', normalized_currency,
      'before', to_jsonb(previous_settings),
      'after', to_jsonb(updated_settings)
    )
  );

  return updated_settings;
end;
$$;

revoke all on function public.update_loan_product_settings(
  text, bigint, bigint, integer, integer, integer, numeric, text, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.update_loan_product_settings(
  text, bigint, bigint, integer, integer, integer, numeric, text, boolean
) to authenticated, service_role;

revoke all on function public.submit_loan_application(
  bigint, text, integer, bigint, numeric, text, jsonb, uuid
) from public, anon, authenticated, service_role;
drop function public.submit_loan_application(
  bigint, text, integer, bigint, numeric, text, jsonb, uuid
);

create function public.submit_loan_application(
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
