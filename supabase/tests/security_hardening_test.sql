begin;
select plan(47);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'upload-staging'
      and name = 'upload-staging'
  ),
  'the upload-staging bucket exists'
);
select is(
  (select public from storage.buckets where id = 'upload-staging'),
  false,
  'the upload-staging bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'upload-staging'),
  10485760::bigint,
  'the upload-staging bucket is limited to 10 MiB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'upload-staging'),
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]::text[],
  'the upload-staging bucket accepts only the approved MIME types'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'kyc_evidence_insert_own',
        'loan_evidence_insert_own',
        'external_execution_evidence_staff_insert',
        'kyc_evidence_update_current_requested'
      )
  ),
  0,
  'browser sessions cannot bypass evidence finalization policies'
);

select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  0,
  'anon cannot execute any application function'
);
select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prosecdef
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  0,
  'anon cannot execute any SECURITY DEFINER application function'
);
select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ),
  1,
  'authenticated can execute only one private helper'
);
select ok(
  has_function_privilege(
    'authenticated',
    'private.is_active_staff(text[])',
    'EXECUTE'
  ),
  'authenticated can execute the RLS staff helper'
);
select ok(
  not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'rls_auto_enable'
      and (
        has_function_privilege('anon', procedure.oid, 'EXECUTE')
        or has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      )
  ),
  'rls_auto_enable is unavailable to browser roles when present'
);

select ok(
  not exists (
    select 1
    from pg_namespace as namespace
    cross join pg_roles as owner_role
    cross join lateral aclexplode(
      coalesce(
        (
          select default_acl.defaclacl
          from pg_default_acl as default_acl
          where default_acl.defaclrole = owner_role.oid
            and default_acl.defaclnamespace = namespace.oid
            and default_acl.defaclobjtype = 'f'
        ),
        acldefault('f', owner_role.oid)
      )
    ) as privilege
    left join pg_roles as grantee_role on grantee_role.oid = privilege.grantee
    where owner_role.rolname = 'postgres'
      and namespace.nspname in ('public', 'private')
      and privilege.privilege_type = 'EXECUTE'
      and (
        privilege.grantee = 0
        or grantee_role.rolname in ('anon', 'authenticated')
      )
  ),
  'future application functions require explicit browser-role EXECUTE grants'
);
select is(
  (
    select count(distinct namespace.nspname)::integer
    from pg_namespace as namespace
    join pg_default_acl as default_acl
      on default_acl.defaclnamespace = namespace.oid
    cross join lateral aclexplode(default_acl.defaclacl) as privilege
    join pg_roles as owner_role on owner_role.oid = default_acl.defaclrole
    join pg_roles as grantee_role on grantee_role.oid = privilege.grantee
    where owner_role.rolname = 'postgres'
      and namespace.nspname in ('public', 'private')
      and default_acl.defaclobjtype = 'f'
      and privilege.privilege_type = 'EXECUTE'
      and grantee_role.rolname = 'service_role'
  ),
  2,
  'future public and private functions remain executable by service_role'
);
select is(
  (
    select count(*)::integer
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and not has_function_privilege('service_role', procedure.oid, 'EXECUTE')
  ),
  0,
  'service_role can execute every current application function'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.branch_manager_approve_transfer(uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the legacy bulk transfer approval RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.branch_manager_finalize_transfer(uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the legacy transfer finalization RPC'
);

select ok(
  has_function_privilege(test_role, routine_signature, 'EXECUTE'),
  description
)
from (
  values
    ('authenticated', 'public.begin_kyc_review(uuid)', 'authenticated keeps begin_kyc_review'),
    ('authenticated', 'public.branch_manager_adjust_balance(uuid,bigint,timestamp with time zone,text,uuid)', 'authenticated keeps branch_manager_adjust_balance'),
    ('authenticated', 'public.branch_manager_approve_loan(uuid,text)', 'authenticated keeps branch_manager_approve_loan'),
    ('authenticated', 'public.branch_manager_declare_account(uuid,text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone,boolean,text,uuid)', 'authenticated keeps branch_manager_declare_account'),
    ('authenticated', 'public.branch_manager_disburse_loan(uuid,uuid,text)', 'authenticated keeps branch_manager_disburse_loan'),
    ('authenticated', 'public.branch_manager_issue_official_document(uuid,uuid,uuid,uuid,text,text,text,date,date,uuid)', 'authenticated keeps branch_manager_issue_official_document'),
    ('authenticated', 'public.branch_manager_reject_loan(uuid,text)', 'authenticated keeps branch_manager_reject_loan'),
    ('authenticated', 'public.branch_manager_reject_transfer(uuid,text)', 'authenticated keeps branch_manager_reject_transfer'),
    ('authenticated', 'public.branch_manager_review_transfer_check(uuid,text,text)', 'authenticated keeps branch_manager_review_transfer_check'),
    ('authenticated', 'public.branch_manager_revoke_official_document(uuid,text)', 'authenticated keeps branch_manager_revoke_official_document'),
    ('authenticated', 'public.current_app_role()', 'authenticated keeps current_app_role'),
    ('authenticated', 'public.decide_kyc_application(uuid,text,text,text)', 'authenticated keeps decide_kyc_application'),
    ('authenticated', 'public.get_account_number_configuration()', 'authenticated keeps get_account_number_configuration'),
    ('authenticated', 'public.mark_notification_read(uuid)', 'authenticated keeps mark_notification_read'),
    ('authenticated', 'public.publish_brand_settings(bigint,text,text,integer,integer,text,integer,integer,text,text,text,text,text,text,text,text,text,text,text)', 'authenticated keeps publish_brand_settings'),
    ('authenticated', 'public.request_kyc_information(uuid,text[],text,text,timestamp with time zone)', 'authenticated keeps request_kyc_information'),
    ('authenticated', 'public.resubmit_kyc_application(uuid,jsonb,jsonb)', 'authenticated keeps resubmit_kyc_application'),
    ('authenticated', 'public.save_kyc_draft(integer,jsonb,jsonb,text)', 'authenticated keeps save_kyc_draft'),
    ('authenticated', 'public.set_account_number_prefix(text)', 'authenticated keeps set_account_number_prefix'),
    ('authenticated', 'public.set_user_access_status(uuid,text,text)', 'authenticated keeps set_user_access_status'),
    ('authenticated', 'public.submit_kyc_application(text,text,date,text,text,jsonb,text,text,boolean,boolean,text,text,text,date,jsonb,uuid)', 'authenticated keeps submit_kyc_application'),
    ('authenticated', 'public.submit_loan_application(bigint,text,integer,text,jsonb,uuid)', 'authenticated keeps submit_loan_application'),
    ('authenticated', 'public.submit_transfer_intent(uuid,text,text,jsonb,text,bigint,text,bigint,text,numeric,timestamp with time zone,text,uuid)', 'authenticated keeps submit_transfer_intent'),
    ('authenticated', 'public.update_kyc_review_checklist(uuid,text,text,text,text,text,text,text)', 'authenticated keeps update_kyc_review_checklist'),
    ('authenticated', 'public.update_loan_product_settings(text,bigint,bigint,integer,integer,integer,numeric,text,boolean)', 'authenticated keeps update_loan_product_settings'),
    ('service_role', 'public.claim_transactional_emails(integer)', 'service_role keeps claim_transactional_emails'),
    ('service_role', 'public.claim_transactional_emails_for_recipient(uuid,integer)', 'service_role keeps claim_transactional_emails_for_recipient'),
    ('service_role', 'public.complete_official_document(uuid,text,text,boolean,text)', 'service_role keeps complete_official_document'),
    ('service_role', 'public.complete_transactional_email(uuid,uuid,boolean,text,text)', 'service_role keeps complete_transactional_email'),
    ('service_role', 'public.create_official_document_localized_reissue(uuid,uuid)', 'service_role keeps create_official_document_localized_reissue'),
    ('service_role', 'public.finalize_official_document_localized_reissue(uuid)', 'service_role keeps finalize_official_document_localized_reissue'),
    ('service_role', 'public.provision_demo_accounts(uuid,uuid,text)', 'service_role keeps provision_demo_accounts')
) as required_rpc(test_role, routine_signature, description);

select * from finish();
rollback;
