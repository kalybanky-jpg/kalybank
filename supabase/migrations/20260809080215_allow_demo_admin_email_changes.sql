-- Keep the public profile and support identity history aligned with the Auth
-- login address. This trigger runs inside the same transaction as auth.users,
-- so a profile e-mail collision rejects the Auth change atomically.
create or replace function private.sync_support_user_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_new_email text := lower(btrim(coalesce(new.email, '')));
  changed_at timestamptz := statement_timestamp();
begin
  update public.support_user_identities
  set valid_to = greatest(changed_at, valid_from)
  where user_id = new.id
    and valid_to is null
    and normalized_email is distinct from normalized_new_email;

  if normalized_new_email = '' then
    return new;
  end if;

  if char_length(normalized_new_email) > 254
     or normalized_new_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
  then
    raise exception 'INVALID_SUPPORT_IDENTITY_EMAIL' using errcode = '22023';
  end if;

  update public.profiles
  set email = normalized_new_email
  where user_id = new.id
    and email is distinct from normalized_new_email;

  if not exists (
    select 1
    from public.support_user_identities
    where user_id = new.id
      and normalized_email = normalized_new_email
      and valid_to is null
  ) then
    insert into public.support_user_identities (
      user_id,
      normalized_email,
      valid_from
    )
    values (
      new.id,
      normalized_new_email,
      changed_at
    );
  end if;

  return new;
end;
$$;

revoke all on function private.sync_support_user_identity()
from public, anon, authenticated;
grant execute on function private.sync_support_user_identity()
to service_role;

-- The demo financial-position guard identifies the branch manager by stable
-- Auth metadata and its active staff role. The administrator login e-mail is
-- intentionally mutable and must never be used as an authorization key.
create or replace function private.prepare_demo_financial_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_admin_id uuid;
  demo_admin_count integer;
  owner_email text;
  owner_metadata jsonb;
begin
  if new.id <> uuid 'd3000000-0000-4000-8000-000000000003' then
    return new;
  end if;

  select
    lower(coalesce(email, '')),
    coalesce(raw_app_meta_data, '{}'::jsonb)
  into owner_email, owner_metadata
  from auth.users
  where id = new.owner_id;

  if not found
     or owner_email <> 'client.demo@monalyz.com'
     or owner_metadata ->> 'monalyz_demo' <> 'true'
     or owner_metadata ->> 'demo_role' <> 'client' then
    raise exception 'INVALID_DEMO_BANK_ACCOUNT_OWNER'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into demo_admin_count
  from auth.users as user_record
  join public.staff_members as staff
    on staff.user_id = user_record.id
  where user_record.raw_app_meta_data ->> 'monalyz_demo' = 'true'
    and user_record.raw_app_meta_data ->> 'demo_role' = 'admin'
    and staff.role = 'admin'
    and staff.active;

  if demo_admin_count <> 1 then
    raise exception 'DEMO_BRANCH_MANAGER_REQUIRED'
      using errcode = '23514';
  end if;

  select user_record.id
  into demo_admin_id
  from auth.users as user_record
  join public.staff_members as staff
    on staff.user_id = user_record.id
  where user_record.raw_app_meta_data ->> 'monalyz_demo' = 'true'
    and user_record.raw_app_meta_data ->> 'demo_role' = 'admin'
    and staff.role = 'admin'
    and staff.active;

  new.account_number := 'DEMO-EUR-000001';
  new.iban := 'FR5299999999990000000000100';
  new.bic := 'DEMOFRP1XXX';
  new.account_holder_name := 'Client Démo Monalyz';
  new.institution_name := 'Monalyz Démonstration — non routable';
  new.branch_name := 'Agence Démonstration';
  new.branch_code := 'DEMO-001';
  new.account_status := 'active';
  new.opened_at := coalesce(
    new.opened_at,
    timestamptz '2026-01-01 00:00:00+00'
  );
  new.declared_by := demo_admin_id;
  new.is_demo := true;

  return new;
end;
$$;

revoke all on function private.prepare_demo_financial_position()
from public, anon, authenticated;
grant execute on function private.prepare_demo_financial_position()
to service_role;

-- The original provisioner is intentionally large and contains audited demo
-- invariants. Patch only its three legacy address literals in place so all of
-- those invariants remain byte-for-byte unchanged while the admin e-mail is
-- sourced from the selected Auth UUID.
do $migration$
declare
  function_definition text;
  updated_definition text;
  legacy_email constant text := $value$'admin.demo@monalyz.com'$value$;
  legacy_occurrences integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.provision_demo_accounts(uuid,uuid,text)'::regprocedure
  )
  into function_definition;

  legacy_occurrences := (
    char_length(function_definition)
    - char_length(replace(function_definition, legacy_email, ''))
  ) / char_length(legacy_email);

  if legacy_occurrences <> 3 then
    raise exception 'UNEXPECTED_DEMO_PROVISIONER_DEFINITION'
      using errcode = '55000';
  end if;

  updated_definition := replace(
    function_definition,
    $clause$admin_email <> 'admin.demo@monalyz.com'$clause$,
    $clause$admin_email = ''$clause$
  );
  updated_definition := replace(
    updated_definition,
    legacy_email,
    'admin_email'
  );

  execute updated_definition;
end;
$migration$;

-- The privileged application client intentionally has no direct INSERT grant
-- on the append-only audit table. Expose one narrow, validated write instead.
create or replace function public.record_admin_credentials_update(
  p_actor_id uuid,
  p_email_changed boolean,
  p_password_changed boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id bigint;
begin
  if p_actor_id is null
     or p_email_changed is null
     or p_password_changed is null
     or p_email_changed = p_password_changed then
    raise exception 'INVALID_ADMIN_CREDENTIAL_AUDIT'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users as user_record
    join public.staff_members as staff
      on staff.user_id = user_record.id
    where user_record.id = p_actor_id
      and staff.role = 'admin'
      and staff.active
  ) then
    raise exception 'ADMIN_CREDENTIAL_AUDIT_ACTOR_REQUIRED'
      using errcode = '42501';
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_actor_id,
    'admin_credentials_updated',
    'auth_user',
    p_actor_id,
    jsonb_build_object(
      'emailChanged', p_email_changed,
      'passwordChanged', p_password_changed
    )
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function public.record_admin_credentials_update(
  uuid,
  boolean,
  boolean
) from public, anon, authenticated;
grant execute on function public.record_admin_credentials_update(
  uuid,
  boolean,
  boolean
) to service_role;

-- Reassert least privilege on the role table. Authorization stays exposed
-- only through current_app_role() and the caller-scoped self SELECT policy.
revoke all on table public.staff_members from anon, authenticated;
grant select on table public.staff_members to authenticated;
