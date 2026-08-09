begin;
select plan(37);

select is(
  (
    select count(*)::integer
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'push_subscriptions',
        'support_push_deliveries',
        'support_transcripts',
        'support_user_identities'
      )
      and relation.relkind = 'r'
  ),
  4,
  'all support backend tables exist'
);

select is(
  (
    select count(*)::integer
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and (
        relation.relname like 'support_%'
        or relation.relname = 'push_subscriptions'
      )
      and relation.relrowsecurity
  ),
  4,
  'all support backend tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name in (
        'push_subscriptions',
        'support_push_deliveries',
        'support_transcripts',
        'support_user_identities'
      )
  ),
  0,
  'anon has no direct support table grants'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name in (
        'push_subscriptions',
        'support_push_deliveries',
        'support_transcripts',
        'support_user_identities'
      )
  ),
  0,
  'authenticated has no direct support table grants'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.register_push_subscription(uuid,text,text,text,bigint,text)',
    'EXECUTE'
  ),
  'authenticated can register a Push subscription through the RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.unregister_push_subscription(uuid,text)',
    'EXECUTE'
  ),
  'authenticated can unregister a Push subscription through the RPC'
);
select ok(
  to_regprocedure('public.resolve_support_user_identity(text)') is null,
  'no e-mail-based identity resolver exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_support_transcript(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot claim transcript jobs'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.release_support_transcript_claim(uuid,uuid,boolean)',
    'EXECUTE'
  ),
  'authenticated cannot release transcript jobs'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_transcripts'
      and column_name = 'email_request_payload'
  ),
  'the exact Resend request can be snapshotted before delivery'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_support_transcript(uuid,uuid)',
    'EXECUTE'
  ),
  'service_role can claim transcript jobs'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.release_support_transcript_claim(uuid,uuid,boolean)',
    'EXECUTE'
  ),
  'service_role can release transcript jobs'
);

select ok(
  to_regclass('public.support_user_identities_active_user_uidx') is not null,
  'only one active identity can exist per user'
);
select ok(
  to_regclass('public.support_user_identities_active_email_uidx') is not null,
  'only one active identity can exist per e-mail'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.support_transcripts'::regclass
      and conname = 'support_transcripts_raw_hash_key'
      and contype = 'u'
  ),
  'raw transcript hashes are unique against replay under a new event id'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.support_transcripts'::regclass
      and conname = 'support_transcripts_tawk_event_id_key'
      and contype = 'u'
  ),
  'tawk event ids are unique for provider retry idempotence'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and conname = 'push_subscriptions_endpoint_hash_key'
      and contype = 'u'
  ),
  'one Push endpoint can belong to only one current user'
);
select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid = 'public.support_user_identities'::regclass
      and contype = 'f'
  ),
  0,
  'support identities retain tombstones after auth user deletion'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_support_identity_changed'
      and not tgisinternal
  ),
  'auth insert and e-mail changes synchronize support identities'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_support_identity_deleted'
      and not tgisinternal
  ),
  'auth deletion retires but does not erase support identity history'
);
select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_transcripts'
      and column_name = 'user_id'
  ),
  'YES',
  'signed orphan transcripts can be archived without a guessed user'
);
select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_transcripts'
      and column_name = 'visitor_email_normalized'
  ),
  'YES',
  'signed transcripts with no visitor e-mail can be archived'
);
select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_transcripts'
      and column_name = 'raw_body'
  ),
  'NO',
  'the verified raw UTF-8 body is always archived'
);
select is(
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_transcripts'
      and column_name = 'identity_status'
  ),
  'NO',
  'each transcript records a deterministic identity outcome'
);
select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.register_push_subscription(uuid,text,text,text,bigint,text)'::regprocedure
  ),
  'Push registration is a SECURITY DEFINER RPC'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.support_transcripts'::regclass
      and conname = 'support_transcripts_notification_snapshot_check'
      and contype = 'c'
  ),
  'notification identity snapshots remain internally consistent'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'push_subscriptions',
        'support_push_deliveries',
        'support_transcripts',
        'support_user_identities'
      )
  ),
  0,
  'support tables expose no browser RLS policy'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.support_transcripts'::regclass
      and conname = 'support_transcripts_identity_consistency_check'
      and contype = 'c'
  ),
  'resolved and orphan identity states are constrained consistently'
);
select ok(
  (
    select pg_get_constraintdef(oid) like '%permanent_failed%'
    from pg_constraint
    where conrelid = 'public.support_transcripts'::regclass
      and conname = 'support_transcripts_email_status_check'
  ),
  'permanent e-mail failures are a terminal persisted state'
);

insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data
)
values (
  'd4000000-0000-4000-8000-000000000001',
  'admin-before@monalyz.invalid',
  '{"monalyz_demo":false}'::jsonb,
  '{"display_name":"Admin pgTAP","base_currency":"EUR"}'::jsonb
);

insert into public.staff_members (user_id, role, active)
values (
  'd4000000-0000-4000-8000-000000000001',
  'admin',
  true
);

update auth.users
set email = 'admin-after@monalyz.invalid'
where id = 'd4000000-0000-4000-8000-000000000001';

select is(
  (
    select email
    from public.profiles
    where user_id = 'd4000000-0000-4000-8000-000000000001'
  ),
  'admin-after@monalyz.invalid',
  'an Auth e-mail change updates the matching public profile atomically'
);

select is(
  (
    select count(*)::integer
    from public.support_user_identities
    where user_id = 'd4000000-0000-4000-8000-000000000001'
  ),
  2,
  'an Auth e-mail change retains both support identity versions'
);

select is(
  (
    select count(*)::integer
    from public.support_user_identities
    where user_id = 'd4000000-0000-4000-8000-000000000001'
      and normalized_email = 'admin-after@monalyz.invalid'
      and valid_to is null
  ),
  1,
  'the new support identity is the sole active identity'
);

select is(
  (
    select count(*)::integer
    from public.staff_members
    where user_id = 'd4000000-0000-4000-8000-000000000001'
      and role = 'admin'
      and active
  ),
  1,
  'changing the login e-mail preserves the administrator role by UUID'
);

select is(
  (
    select jsonb_build_object(
      'anon', count(*) filter (where grantee = 'anon'),
      'authenticated', count(*) filter (where grantee = 'authenticated'),
      'authenticated_select', count(*) filter (
        where grantee = 'authenticated'
          and privilege_type = 'SELECT'
      )
    )
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'staff_members'
      and grantee in ('anon', 'authenticated')
  ),
  jsonb_build_object(
    'anon', 0,
    'authenticated', 1,
    'authenticated_select', 1
  ),
  'staff role grants expose only authenticated self-read access'
);

select is(
  (
    select jsonb_build_object(
      'security_definer', prosecdef,
      'service_role', has_function_privilege(
        'service_role',
        oid,
        'EXECUTE'
      ),
      'authenticated', has_function_privilege(
        'authenticated',
        oid,
        'EXECUTE'
      ),
      'anon', has_function_privilege('anon', oid, 'EXECUTE')
    )
    from pg_proc
    where oid = 'public.record_admin_credentials_update(uuid,boolean,boolean)'::regprocedure
  ),
  jsonb_build_object(
    'security_definer', true,
    'service_role', true,
    'authenticated', false,
    'anon', false
  ),
  'credential audit writes use one service-only SECURITY DEFINER RPC'
);

set local role service_role;
select lives_ok(
  $test$
    select public.record_admin_credentials_update(
      'd4000000-0000-4000-8000-000000000001',
      true,
      false
    )
  $test$,
  'the service worker records an administrator e-mail change'
);
reset role;

select is(
  (
    select metadata
    from public.audit_events
    where actor_id = 'd4000000-0000-4000-8000-000000000001'
      and action = 'admin_credentials_updated'
    order by id desc
    limit 1
  ),
  jsonb_build_object(
    'emailChanged', true,
    'passwordChanged', false
  ),
  'the credential audit contains only non-secret change indicators'
);

select * from finish();
rollback;
