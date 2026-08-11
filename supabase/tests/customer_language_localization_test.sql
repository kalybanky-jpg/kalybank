begin;
select plan(26);

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '81000000-0000-4000-8000-000000000001',
    'italiano@monalyz.test',
    '{"base_currency":"EUR","preferred_language":"it"}'::jsonb
  ),
  (
    '82000000-0000-4000-8000-000000000001',
    'nederlands@monalyz.test',
    '{"base_currency":"EUR","preferred_language":"nl"}'::jsonb
  ),
  (
    '83000000-0000-4000-8000-000000000001',
    'unsupported-language@monalyz.test',
    '{"base_currency":"EUR","preferred_language":"pt"}'::jsonb
  );

select is(
  (
    select preferred_language
    from public.profiles
    where user_id = '81000000-0000-4000-8000-000000000001'
  ),
  'it',
  'Italian is persisted from the strictly allowlisted signup metadata'
);

select is(
  (
    select preferred_language
    from public.profiles
    where user_id = '82000000-0000-4000-8000-000000000001'
  ),
  'nl',
  'Dutch is persisted from the strictly allowlisted signup metadata'
);

select is(
  (
    select preferred_language
    from public.profiles
    where user_id = '83000000-0000-4000-8000-000000000001'
  ),
  'fr',
  'unsupported signup languages still fall back to French'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $test$
    select public.save_kyc_draft(
      4,
      '{"firstName":"Giulia","lastName":"Rossi"}'::jsonb,
      '{}'::jsonb,
      'it'
    )
  $test$,
  'an active customer can persist an Italian KYC draft'
);

select is(
  (
    select preferred_language
    from public.kyc_drafts
    where owner_id = '81000000-0000-4000-8000-000000000001'
  ),
  'it',
  'the Italian KYC draft keeps its language contract'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $test$
    select public.save_kyc_draft(
      4,
      '{"firstName":"Sophie","lastName":"De Vries"}'::jsonb,
      '{}'::jsonb,
      'nl'
    )
  $test$,
  'an active customer can persist a Dutch KYC draft'
);

select is(
  (
    select preferred_language
    from public.kyc_drafts
    where owner_id = '82000000-0000-4000-8000-000000000001'
  ),
  'nl',
  'the Dutch KYC draft keeps its language contract'
);

select throws_ok(
  $test$
    select public.save_kyc_draft(
      4,
      '{}'::jsonb,
      '{}'::jsonb,
      'pt'
    )
  $test$,
  '22023',
  'INVALID_KYC_DRAFT',
  'the KYC draft RPC still rejects languages outside the six-language contract'
);

reset role;

select ok(
  (
    select pg_get_constraintdef(oid) like '%''it''::text%'
      and pg_get_constraintdef(oid) like '%''nl''::text%'
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_preferred_language_allowed'
  ),
  'the profile language constraint includes Italian and Dutch'
);

select ok(
  (
    select pg_get_constraintdef(oid) like '%''it''::text%'
      and pg_get_constraintdef(oid) like '%''nl''::text%'
    from pg_constraint
    where conrelid = 'public.kyc_drafts'::regclass
      and conname = 'kyc_drafts_preferred_language_check'
  ),
  'the KYC draft language constraint includes Italian and Dutch'
);

select ok(
  (
    select pg_get_constraintdef(oid) like '%''it''::text%'
      and pg_get_constraintdef(oid) like '%''nl''::text%'
    from pg_constraint
    where conrelid = 'public.official_documents'::regclass
      and conname = 'official_documents_language_check'
  ),
  'the official-document language constraint includes Italian and Dutch'
);

select ok(
  pg_catalog.strpos(
    pg_catalog.pg_get_functiondef('private.handle_new_user()'::regprocedure),
    $allowlist$('fr', 'en', 'de', 'es', 'it', 'nl')$allowlist$
  ) > 0,
  'the Auth profile trigger uses the six-language allowlist'
);

select ok(
  pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      'public.save_kyc_draft(integer,jsonb,jsonb,text)'::regprocedure
    ),
    $allowlist$('fr', 'en', 'de', 'es', 'it', 'nl')$allowlist$
  ) > 0,
  'the KYC draft RPC uses the six-language allowlist'
);

select ok(
  pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      'public.branch_manager_issue_official_document(uuid,uuid,uuid,uuid,text,text,text,date,date,uuid)'::regprocedure
    ),
    $allowlist$('fr', 'en', 'de', 'es', 'it', 'nl')$allowlist$
  ) > 0,
  'the official-document issuer uses the six-language allowlist'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    where oid in (
      'private.handle_new_user()'::regprocedure,
      'public.save_kyc_draft(integer,jsonb,jsonb,text)'::regprocedure,
      'public.branch_manager_issue_official_document(uuid,uuid,uuid,uuid,text,text,text,date,date,uuid)'::regprocedure,
      'private.enqueue_kyc_message()'::regprocedure
    )
      and prosecdef
  ),
  4,
  'all rewritten customer-language routines remain SECURITY DEFINER'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.enqueue_kyc_message()',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the private KYC notification trigger'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_kyc_draft(integer,jsonb,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated customers retain access to the KYC draft RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.branch_manager_issue_official_document(uuid,uuid,uuid,uuid,text,text,text,date,date,uuid)',
    'EXECUTE'
  ),
  'authenticated staff sessions retain access to the guarded document RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.enqueue_kyc_message()',
    'EXECUTE'
  ),
  'service_role retains access to the private KYC notification trigger'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $test$
    select public.submit_kyc_application(
      'Giulia',
      'Rossi',
      date '1990-01-01',
      'Roma',
      'Italiana',
      '{"street":"1 Via Roma","postalCode":"00100","city":"Roma","country":"Italia"}'::jsonb,
      'Ingegnera',
      '1500_3000',
      false,
      false,
      'passport',
      'IT123456',
      'Italia',
      current_date + 365,
      '{"id_front":"owner/current/id_front.jpg","selfie":"owner/current/selfie.jpg","proof_of_address":"owner/current/proof_of_address.pdf"}'::jsonb,
      '84000000-0000-4000-8000-000000000001'
    )
  $test$,
  'an Italian customer can submit a KYC application'
);

reset role;

select is(
  (
    select message_key
    from public.notifications
    where recipient_id = '81000000-0000-4000-8000-000000000001'
      and notification_type = 'kyc'
    order by created_at desc
    limit 1
  ),
  'kyc_submitted',
  'the KYC trigger persists a stable message key without text inference'
);

select is(
  (
    select title
    from public.notifications
    where recipient_id = '81000000-0000-4000-8000-000000000001'
      and notification_type = 'kyc'
    order by created_at desc
    limit 1
  ),
  'Dossier d’identité transmis',
  'the audit notification title remains canonical French for an Italian customer'
);

select is(
  (
    select message
    from public.notifications
    where recipient_id = '81000000-0000-4000-8000-000000000001'
      and notification_type = 'kyc'
    order by created_at desc
    limit 1
  ),
  'Le dossier d’identité a été transmis pour vérification.',
  'the audit notification message remains canonical French for an Italian customer'
);

select ok(
  (
    select jsonb_typeof(message_params) = 'object'
      and message_params ->> 'kycId' = kyc.id::text
      and message_params ->> 'status' = 'submitted'
      and (message_params ->> 'version')::integer = kyc.version
    from public.notifications as notification
    join public.kyc_applications as kyc
      on kyc.owner_id = notification.recipient_id
    where notification.recipient_id = '81000000-0000-4000-8000-000000000001'
      and notification.notification_type = 'kyc'
    order by notification.created_at desc
    limit 1
  ),
  'the KYC notification exposes stable structured parameters'
);

select is(
  (
    select action_path
    from public.notifications
    where recipient_id = '81000000-0000-4000-8000-000000000001'
      and notification_type = 'kyc'
    order by created_at desc
    limit 1
  ),
  '/myaccount?tab=kyc&kyc=' || (
    select id::text
    from public.kyc_applications
    where owner_id = '81000000-0000-4000-8000-000000000001'
  ),
  'the KYC notification keeps its deterministic deep link'
);

select is(
  (
    select template_key
    from public.transactional_email_outbox
    where recipient_id = '81000000-0000-4000-8000-000000000001'
      and entity_type = 'kyc'
    order by created_at desc
    limit 1
  ),
  'kyc_submitted',
  'the transactional e-mail uses the same stable KYC message key'
);

select * from finish();
rollback;
