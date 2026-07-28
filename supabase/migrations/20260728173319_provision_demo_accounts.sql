-- Atomically materialize the two documented Monalyz demo identities after
-- they have been created with Supabase Auth Admin. No identity or password is
-- stored in migrations: the caller supplies the two Auth UUIDs.
create or replace function public.provision_demo_accounts(
  p_admin_user_id uuid,
  p_client_user_id uuid,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_kyc_id constant uuid := 'd3000000-0000-4000-8000-000000000001';
  demo_kyc_idempotency_key constant uuid := 'd3000000-0000-4000-8000-000000000002';
  demo_position_id constant uuid := 'd3000000-0000-4000-8000-000000000003';
  admin_email text;
  client_email text;
  admin_app_metadata jsonb;
  client_app_metadata jsonb;
  demo_user_count integer;
  active_admin_count integer;
  client_staff_count integer;
  approved_kyc_count integer;
  current_position_count integer;
  audit_count integer;
begin
  if (select auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_admin_user_id is null
     or p_client_user_id is null
     or p_admin_user_id = p_client_user_id then
    raise exception 'INVALID_DEMO_USER_IDS' using errcode = '22023';
  end if;

  if p_environment not in ('local', 'remote') then
    raise exception 'INVALID_DEMO_ENVIRONMENT' using errcode = '22023';
  end if;

  -- Serialize provisioners so the read-before-insert audit guards remain
  -- deterministic even when two operators start the command concurrently.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('monalyz:provision-demo-accounts', 0)
  );

  select
    lower(coalesce(email, '')),
    coalesce(raw_app_meta_data, '{}'::jsonb)
  into admin_email, admin_app_metadata
  from auth.users
  where id = p_admin_user_id;

  if not found
     or admin_email <> 'admin.demo@monalyz.com'
     or admin_app_metadata ->> 'monalyz_demo' <> 'true'
     or admin_app_metadata ->> 'demo_role' <> 'admin' then
    raise exception 'INVALID_DEMO_ADMIN_IDENTITY' using errcode = '22023';
  end if;

  select
    lower(coalesce(email, '')),
    coalesce(raw_app_meta_data, '{}'::jsonb)
  into client_email, client_app_metadata
  from auth.users
  where id = p_client_user_id;

  if not found
     or client_email <> 'client.demo@monalyz.com'
     or client_app_metadata ->> 'monalyz_demo' <> 'true'
     or client_app_metadata ->> 'demo_role' <> 'client' then
    raise exception 'INVALID_DEMO_CLIENT_IDENTITY' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.financial_positions
    where owner_id = p_admin_user_id
  ) or exists (
    select 1
    from public.kyc_applications
    where owner_id = p_admin_user_id
  ) then
    raise exception 'DEMO_ADMIN_MUST_NOT_HAVE_CLIENT_FIXTURES'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.transfer_intents
    where owner_id = p_client_user_id
  ) or exists (
    select 1
    from public.loan_applications
    where owner_id = p_client_user_id
  ) or exists (
    select 1
    from public.external_transfer_executions execution
    join public.transfer_intents transfer
      on transfer.id = execution.transfer_id
    where transfer.owner_id = p_client_user_id
  ) or exists (
    select 1
    from public.external_loan_fundings funding
    join public.loan_applications loan
      on loan.id = funding.loan_id
    where loan.owner_id = p_client_user_id
  ) then
    raise exception 'DEMO_CLIENT_FINANCIAL_WORKFLOW_MUST_BE_EMPTY'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.financial_positions
    where id = demo_position_id
      and (
        owner_id <> p_client_user_id
        or label <> 'Compte courant démo'
        or external_identifier_masked is not null
      )
  ) or exists (
    select 1
    from public.financial_positions
    where owner_id = p_client_user_id
      and id <> demo_position_id
  ) then
    raise exception 'DEMO_POSITION_ID_COLLISION' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.kyc_applications
    where id = demo_kyc_id
      and (
        owner_id <> p_client_user_id
        or idempotency_key <> demo_kyc_idempotency_key
        or address ->> 'monalyz_demo' is distinct from 'true'
      )
  ) or exists (
    select 1
    from public.kyc_applications
    where owner_id = p_client_user_id
      and id <> demo_kyc_id
  ) then
    raise exception 'DEMO_KYC_ID_COLLISION' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.kyc_events
    where kyc_id = demo_kyc_id
      and actor_id = p_admin_user_id
      and event_type = 'demo_approved'
      and reason is distinct from
        'Dossier synthétique Monalyz; aucune vérification réelle.'
  ) then
    raise exception 'DEMO_KYC_EVENT_COLLISION' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.audit_events existing
    where existing.actor_id = p_admin_user_id
      and (
        (
          existing.action = 'demo_admin_account_provisioned'
          and existing.entity_type = 'profile'
          and existing.entity_id = p_admin_user_id
        )
        or (
          existing.action = 'demo_client_account_provisioned'
          and existing.entity_type = 'profile'
          and existing.entity_id = p_client_user_id
        )
        or (
          existing.action = 'demo_kyc_provisioned'
          and existing.entity_type = 'kyc_application'
          and existing.entity_id = demo_kyc_id
        )
        or (
          existing.action = 'demo_financial_position_provisioned'
          and existing.entity_type = 'financial_position'
          and existing.entity_id = demo_position_id
        )
      )
      and (
        existing.metadata ->> 'source' is distinct from 'demo_provisioner'
        or existing.metadata ->> 'demo' is distinct from 'true'
        or existing.metadata ->> 'synthetic' is distinct from 'true'
      )
  ) then
    raise exception 'DEMO_AUDIT_EVENT_COLLISION' using errcode = '23505';
  end if;

  insert into public.profiles (
    user_id,
    email,
    display_name,
    preferred_currency,
    preferred_language,
    access_status,
    access_status_reason
  )
  values
    (
      p_admin_user_id,
      'admin.demo@monalyz.com',
      'Administrateur Démo Monalyz',
      'EUR',
      'fr',
      'active',
      null
    ),
    (
      p_client_user_id,
      'client.demo@monalyz.com',
      'Client Démo Monalyz',
      'EUR',
      'fr',
      'active',
      null
    )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    preferred_currency = excluded.preferred_currency,
    preferred_language = excluded.preferred_language,
    access_status = excluded.access_status,
    access_status_reason = null;

  insert into public.staff_members (user_id, role, active)
  values (p_admin_user_id, 'admin', true)
  on conflict (user_id) do update
  set role = excluded.role, active = excluded.active;

  delete from public.staff_members
  where user_id = p_client_user_id;

  insert into public.kyc_applications (
    id,
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
    document_object_paths,
    status,
    reviewed_at,
    reviewed_by,
    review_note
  )
  values (
    demo_kyc_id,
    p_client_user_id,
    demo_kyc_idempotency_key,
    'Client',
    'Démo Monalyz',
    date '1990-01-01',
    'Donnée synthétique',
    'Donnée synthétique',
    jsonb_build_object(
      'street', 'Adresse synthétique — aucune adresse réelle',
      'postalCode', '00000',
      'city', 'Démonstration',
      'country', 'FR',
      'monalyz_demo', true
    ),
    'Compte de démonstration',
    'Donnée synthétique',
    false,
    false,
    '{}'::jsonb,
    'approved',
    timestamptz '2026-01-01 00:00:00+00',
    p_admin_user_id,
    'DOSSIER SYNTHÉTIQUE MONALYZ — aucune identité ni pièce réelle.'
  )
  on conflict (id) do update
  set
    owner_id = excluded.owner_id,
    idempotency_key = excluded.idempotency_key,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    date_of_birth = excluded.date_of_birth,
    place_of_birth = excluded.place_of_birth,
    nationality = excluded.nationality,
    address = excluded.address,
    occupation = excluded.occupation,
    income_range = excluded.income_range,
    fatca = excluded.fatca,
    pep = excluded.pep,
    document_object_paths = excluded.document_object_paths,
    status = excluded.status,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by,
    review_note = excluded.review_note;

  insert into public.kyc_events (
    kyc_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    reason
  )
  select
    demo_kyc_id,
    p_admin_user_id,
    'demo_approved',
    null,
    'approved',
    'Dossier synthétique Monalyz; aucune vérification réelle.'
  where not exists (
    select 1
    from public.kyc_events
    where kyc_id = demo_kyc_id
      and actor_id = p_admin_user_id
      and event_type = 'demo_approved'
  );

  insert into public.financial_positions (
    id,
    owner_id,
    label,
    position_kind,
    account_type,
    currency,
    amount_minor,
    reserved_minor,
    as_of,
    external_identifier_masked
  )
  values (
    demo_position_id,
    p_client_user_id,
    'Compte courant démo',
    'declared',
    'current',
    'EUR',
    2500000,
    0,
    timestamptz '2026-01-01 00:00:00+00',
    null
  )
  on conflict (id) do update
  set
    owner_id = excluded.owner_id,
    label = excluded.label,
    position_kind = excluded.position_kind,
    account_type = excluded.account_type,
    currency = excluded.currency,
    amount_minor = excluded.amount_minor,
    reserved_minor = excluded.reserved_minor,
    as_of = excluded.as_of,
    external_identifier_masked = null;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  select
    event.actor_id,
    event.action,
    event.entity_type,
    event.entity_id,
    jsonb_build_object(
      'demo', true,
      'synthetic', true,
      'source', 'demo_provisioner',
      'environment', p_environment
    )
  from (
    values
      (
        p_admin_user_id,
        'demo_admin_account_provisioned'::text,
        'profile'::text,
        p_admin_user_id
      ),
      (
        p_admin_user_id,
        'demo_client_account_provisioned'::text,
        'profile'::text,
        p_client_user_id
      ),
      (
        p_admin_user_id,
        'demo_kyc_provisioned'::text,
        'kyc_application'::text,
        demo_kyc_id
      ),
      (
        p_admin_user_id,
        'demo_financial_position_provisioned'::text,
        'financial_position'::text,
        demo_position_id
      )
  ) as event(actor_id, action, entity_type, entity_id)
  where not exists (
    select 1
    from public.audit_events existing
    where existing.actor_id = event.actor_id
      and existing.action = event.action
      and existing.entity_type = event.entity_type
      and existing.entity_id = event.entity_id
      and existing.metadata ->> 'source' = 'demo_provisioner'
  );

  select count(*)
  into demo_user_count
  from auth.users
  where lower(coalesce(email, '')) in (
      'admin.demo@monalyz.com',
      'client.demo@monalyz.com'
    )
    and raw_app_meta_data ->> 'monalyz_demo' = 'true';

  select count(*)
  into active_admin_count
  from public.staff_members
  where user_id = p_admin_user_id
    and role = 'admin'
    and active;

  select count(*)
  into client_staff_count
  from public.staff_members
  where user_id = p_client_user_id;

  select count(*)
  into approved_kyc_count
  from public.kyc_applications
  where id = demo_kyc_id
    and owner_id = p_client_user_id
    and status = 'approved'
    and document_object_paths = '{}'::jsonb
    and address ->> 'monalyz_demo' = 'true';

  select count(*)
  into current_position_count
  from public.financial_positions
  where id = demo_position_id
    and owner_id = p_client_user_id
    and label = 'Compte courant démo'
    and position_kind = 'declared'
    and account_type = 'current'
    and currency = 'EUR'
    and amount_minor = 2500000
    and reserved_minor = 0
    and external_identifier_masked is null;

  select count(*)
  into audit_count
  from public.audit_events
  where actor_id = p_admin_user_id
    and metadata ->> 'source' = 'demo_provisioner'
    and metadata ->> 'demo' = 'true'
    and metadata ->> 'synthetic' = 'true'
    and (
      (
        action = 'demo_admin_account_provisioned'
        and entity_type = 'profile'
        and entity_id = p_admin_user_id
      )
      or (
        action = 'demo_client_account_provisioned'
        and entity_type = 'profile'
        and entity_id = p_client_user_id
      )
      or (
        action = 'demo_kyc_provisioned'
        and entity_type = 'kyc_application'
        and entity_id = demo_kyc_id
      )
      or (
        action = 'demo_financial_position_provisioned'
        and entity_type = 'financial_position'
        and entity_id = demo_position_id
      )
    );

  if demo_user_count <> 2
     or active_admin_count <> 1
     or client_staff_count <> 0
     or approved_kyc_count <> 1
     or current_position_count <> 1
     or audit_count <> 4 then
    raise exception 'DEMO_PROVISIONING_VERIFICATION_FAILED'
      using
        errcode = '23514',
        detail = jsonb_build_object(
          'demo_users', demo_user_count,
          'active_admins', active_admin_count,
          'client_staff_memberships', client_staff_count,
          'approved_kyc_applications', approved_kyc_count,
          'current_positions', current_position_count,
          'audit_events', audit_count
        )::text;
  end if;

  return jsonb_build_object(
    'demoUsers', demo_user_count,
    'activeAdmins', active_admin_count,
    'clientStaffMemberships', client_staff_count,
    'approvedKycApplications', approved_kyc_count,
    'currentPositions', current_position_count,
    'auditEvents', audit_count,
    'transfers', 0,
    'loans', 0,
    'externalExecutions', 0,
    'adminClientFixtures', 0
  );
end;
$$;

revoke execute on function public.provision_demo_accounts(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.provision_demo_accounts(uuid, uuid, text)
to service_role;
