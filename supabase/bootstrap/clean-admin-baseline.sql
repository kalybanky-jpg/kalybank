do $clean_admin_baseline$
declare
  admin_id uuid;
  business_row_count bigint;
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'CLEAN_ADMIN_BASELINE_REQUIRES_ONE_AUTH_USER'
      using errcode = '55000';
  end if;

  select id
  into admin_id
  from auth.users
  where lower(email) = 'admin.demo.local@monalyz.test'
    and email_confirmed_at is not null
    and raw_app_meta_data ->> 'monalyz_demo' = 'true'
    and raw_app_meta_data ->> 'demo_scope' = 'local_clean_baseline';

  if admin_id is null then
    raise exception 'CLEAN_ADMIN_BASELINE_AUTH_USER_INVALID'
      using errcode = '55000';
  end if;

  if (
    select count(*)
    from auth.identities
    where user_id = admin_id
      and provider = 'email'
  ) <> 1 then
    raise exception 'CLEAN_ADMIN_BASELINE_EMAIL_IDENTITY_INVALID'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = admin_id
      and email = 'admin.demo.local@monalyz.test'
      and display_name = 'Administrateur Démo Local'
      and preferred_language = 'fr'
      and base_currency = 'CAD'
      and preferred_currency = 'CAD'
      and access_status = 'active'
  ) then
    raise exception 'CLEAN_ADMIN_BASELINE_PROFILE_INVALID'
      using errcode = '55000';
  end if;

  insert into public.staff_members (user_id, role, active)
  values (admin_id, 'admin', true)
  on conflict (user_id) do update
  set role = excluded.role,
      active = excluded.active;

  if (select count(*) from public.profiles) <> 1
     or (select count(*) from public.staff_members) <> 1
     or not exists (
       select 1
       from public.staff_members
       where user_id = admin_id
         and role = 'admin'
         and active
     )
     or (
       select count(*)
       from public.support_user_identities
       where user_id = admin_id
         and normalized_email = 'admin.demo.local@monalyz.test'
         and valid_to is null
     ) <> 1 then
    raise exception 'CLEAN_ADMIN_BASELINE_PROJECTIONS_INVALID'
      using errcode = '55000';
  end if;

  select
    (select count(*) from public.kyc_drafts)
    + (select count(*) from public.kyc_applications)
    + (select count(*) from public.kyc_events)
    + (select count(*) from public.kyc_review_checklists)
    + (select count(*) from public.financial_positions)
    + (select count(*) from public.financial_ledger_entries)
    + (select count(*) from public.transfer_intents)
    + (select count(*) from public.transfer_events)
    + (select count(*) from public.transfer_review_checks)
    + (select count(*) from public.external_transfer_executions)
    + (select count(*) from public.loan_applications)
    + (select count(*) from public.loan_events)
    + (select count(*) from public.loan_review_checks)
    + (select count(*) from public.external_loan_fundings)
    + (select count(*) from public.official_documents)
    + (select count(*) from public.notifications)
    + (select count(*) from public.transactional_email_outbox)
    + (select count(*) from public.push_subscriptions)
    + (select count(*) from public.support_transcripts)
    + (select count(*) from public.support_push_deliveries)
    + (select count(*) from public.audit_events)
    + (select count(*) from private.client_purge_operations)
    + (select count(*) from private.client_purge_storage_manifest)
    + (select count(*) from private.client_purge_storage_scan_queue)
    + (select count(*) from private.client_purge_entity_manifest)
    + (select count(*) from storage.objects)
  into business_row_count;

  if business_row_count <> 0 then
    raise exception 'CLEAN_ADMIN_BASELINE_BUSINESS_DATA_PRESENT'
      using errcode = '55000';
  end if;
end;
$clean_admin_baseline$;
