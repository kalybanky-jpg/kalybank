begin;
select plan(207);

-- Schema and database API contract.
-- 1
select has_table(
  'public',
  'transactional_email_outbox',
  'transactional email outbox exists'
);
-- 2
select has_column(
  'public',
  'financial_positions',
  'account_type',
  'financial positions expose their account type'
);
select has_column('public', 'notifications', 'message_key', 'notifications expose a stable localization key');
select has_column('public', 'notifications', 'message_params', 'notifications expose structured localization parameters');
select has_column('public', 'loan_applications', 'motive_code', 'loan applications expose a stable motive code');
select has_column('public', 'official_documents', 'localization_revision', 'official documents expose their localization revision');
select has_column('public', 'official_documents', 'supersedes_document_id', 'localized documents retain their replacement chain');

select has_table(
  'private',
  'account_number_configuration',
  'the singleton account-number configuration exists outside the Data API'
);
-- 3
select has_column(
  'public',
  'loan_applications',
  'credited_position_id',
  'loan applications record the credited current position'
);
-- 4
select col_type_is(
  'public',
  'financial_positions',
  'amount_minor',
  'bigint',
  'money remains stored in exact minor units'
);
-- 5
select ok(
  (select relrowsecurity from pg_class where oid = 'public.transfer_intents'::regclass),
  'RLS is enabled on transfer intents'
);
-- 6
select ok(
  (select relrowsecurity from pg_class where oid = 'public.transactional_email_outbox'::regclass),
  'RLS is enabled on the transactional email outbox'
);
-- 7
select ok(
  not has_function_privilege(
    'anon',
    'public.submit_transfer_intent(uuid,text,text,jsonb,text,bigint,text,bigint,text,numeric,timestamptz,text,uuid)',
    'execute'
  ),
  'anonymous users cannot submit transfer intents'
);
-- 8
select ok(
  has_function_privilege(
    'authenticated',
    'public.branch_manager_review_transfer_check(uuid,text,text)',
    'execute'
  ),
  'authenticated sessions can reach the guarded sequential transfer-check RPC'
);
-- 9
select ok(
  not has_function_privilege(
    'authenticated',
    'public.branch_manager_approve_transfer(uuid,text)',
    'execute'
  ),
  'the legacy bulk transfer approval RPC is no longer exposed to authenticated clients'
);
-- 10
select ok(
  not has_function_privilege(
    'authenticated',
    'public.review_loan_check(uuid,text,text,text)',
    'execute'
  ),
  'the legacy multi-review loan RPC is no longer exposed to authenticated clients'
);

select has_table(
  'public',
  'loan_product_settings',
  'loan product settings exist in the public API schema'
);
select has_column(
  'public',
  'loan_product_settings',
  'fixed_annual_rate',
  'loan product settings expose the server-authoritative fixed annual rate'
);
select has_column(
  'public',
  'loan_product_settings',
  'reference_prefix',
  'loan product settings expose the customizable reference prefix'
);
select is(
  (select count(*) from public.loan_product_settings),
  5::bigint,
  'all five supported currencies are seeded'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.loan_product_settings'::regclass),
  'RLS is enabled on loan product settings'
);
select ok(
  has_table_privilege('authenticated', 'public.loan_product_settings', 'select'),
  'authenticated sessions may read loan product settings'
);
select ok(
  not has_table_privilege('authenticated', 'public.loan_product_settings', 'update'),
  'authenticated sessions cannot update loan product settings directly'
);
select ok(
  not has_table_privilege('anon', 'public.loan_product_settings', 'select'),
  'anonymous sessions cannot read loan product settings'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.submit_loan_application(bigint,text,integer,text,jsonb,uuid)',
    'execute'
  ),
  'authenticated sessions can reach the server-authoritative loan submission RPC'
);
select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'submit_loan_application'
      and pg_get_function_identity_arguments(procedure.oid) =
        'p_requested_amount_minor bigint, p_currency text, p_duration_months integer, p_indicative_monthly_payment_minor bigint, p_indicative_annual_rate numeric, p_motive_code text, p_document_object_paths jsonb, p_idempotency_key uuid'
  ),
  0::bigint,
  'the client-priced loan submission signature is removed'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.update_loan_product_settings(text,bigint,bigint,integer,integer,integer,numeric,text,boolean)',
    'execute'
  ),
  'authenticated sessions can reach the guarded loan settings RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.update_loan_product_settings(text,bigint,bigint,integer,integer,integer,numeric,text,boolean)',
    'execute'
  ),
  'anonymous sessions cannot reach the loan settings RPC'
);

-- Synthetic identities. The auth trigger creates their public profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'owner@monalyz.test', '{"base_currency":"EUR"}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'other-owner@monalyz.test', '{"base_currency":"EUR"}'::jsonb),
  ('20000000-0000-0000-0000-000000000001', 'reviewer@monalyz.test', '{"base_currency":"EUR"}'::jsonb),
  ('30000000-0000-0000-0000-000000000001', 'branch-manager@monalyz.test', '{"base_currency":"EUR"}'::jsonb);

insert into public.staff_members (user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', 'reviewer'),
  ('30000000-0000-0000-0000-000000000001', 'admin');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
select throws_ok(
  $test$
    select public.update_loan_product_settings(
      'EUR', 100000, 5000000, 12, 84, 6, 0.04, 'TestLoan_', true
    )
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a reviewer cannot modify loan product settings'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
select throws_ok(
  $test$
    select public.update_loan_product_settings(
      'EUR', 100000, 5000000, 12, 84, 5, 0.04, 'TestLoan_', true
    )
  $test$,
  '22023',
  'INVALID_LOAN_DURATION_STEP',
  'the settings RPC rejects a step that does not span the configured range'
);
select throws_ok(
  $test$
    select public.update_loan_product_settings(
      'EUR', 100000, 5000000, 12, 84, 6, 0.04, 'Loan prefix!', true
    )
  $test$,
  '22023',
  'INVALID_LOAN_REFERENCE_PREFIX',
  'the settings RPC rejects an unsafe reference prefix'
);
select lives_ok(
  $test$
    select public.update_loan_product_settings(
      'EUR', 100000, 5000000, 12, 84, 6, 0.04, 'TestLoan_', true
    )
  $test$,
  'the branch manager can update loan product settings'
);

reset role;
select is(
  (
    select jsonb_build_object(
      'rate', fixed_annual_rate,
      'prefix', reference_prefix,
      'updatedBy', updated_by
    )
    from public.loan_product_settings
    where currency = 'EUR'
  ),
  jsonb_build_object(
    'rate', 0.04::numeric,
    'prefix', 'TestLoan_',
    'updatedBy', '30000000-0000-0000-0000-000000000001'::uuid
  ),
  'the settings RPC persists normalized authoritative values and its actor'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'branch_manager_update_loan_product_settings'
      and entity_type = 'loan_product_settings'
      and metadata ->> 'currency' = 'EUR'
      and metadata #>> '{before,reference_prefix}' = 'Monalyz-'
      and metadata #>> '{after,reference_prefix}' = 'TestLoan_'
  ),
  1::bigint,
  'loan settings changes retain their complete before and after audit snapshots'
);

insert into public.financial_positions (
  id,
  owner_id,
  label,
  currency,
  amount_minor,
  as_of,
  account_type,
  account_number,
  iban,
  bic,
  account_holder_name,
  institution_name,
  branch_name,
  branch_code,
  account_status,
  opened_at,
  declared_by,
  is_demo
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Compte courant EUR',
    'EUR',
    100000,
    now(),
    'current',
    'TEST-EUR-000001',
    'FR0299999999990000000001000',
    'DEMOFRP1XXX',
    'Propriétaire Test',
    'Banque Test non routable',
    'Agence Test',
    'TEST-001',
    'active',
    now(),
    '30000000-0000-0000-0000-000000000001',
    true
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Épargne EUR',
    'EUR',
    20000,
    now(),
    'savings',
    'TEST-EUR-000002',
    'FR1899999999990000000001100',
    'DEMOFRP1XXX',
    'Propriétaire Test',
    'Banque Test non routable',
    'Agence Test',
    'TEST-001',
    'active',
    now(),
    '30000000-0000-0000-0000-000000000001',
    true
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Compte courant USD',
    'USD',
    30000,
    now(),
    'current',
    'TEST-USD-000003',
    'FR3499999999990000000001200',
    'DEMOFRP1XXX',
    'Propriétaire Test',
    'Banque Test non routable',
    'Agence Test',
    'TEST-001',
    'active',
    now(),
    '30000000-0000-0000-0000-000000000001',
    true
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000002',
    'Compte courant autre client',
    'EUR',
    50000,
    now(),
    'current',
    'TEST-EUR-000004',
    'FR5099999999990000000001300',
    'DEMOFRP1XXX',
    'Autre Propriétaire Test',
    'Banque Test non routable',
    'Agence Test',
    'TEST-001',
    'active',
    now(),
    '30000000-0000-0000-0000-000000000001',
    true
  );

-- Successful transfer: submit, single-manager validation, then finalization.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

-- 11
select lives_ok(
  $test$
    select public.submit_transfer_intent(
      '40000000-0000-0000-0000-000000000001',
      'Bénéficiaire test',
      '••••1234',
      '{"recipientAccount":"FR761234"}'::jsonb,
      'eurozone',
      2500,
      'EUR',
      2500,
      'EUR',
      1,
      timestamptz '2026-01-02 00:00:00+00',
      'Test de virement finalisé',
      '50000000-0000-0000-0000-000000000001'
    )
  $test$,
  'the owner can submit a transfer instruction'
);

reset role;
-- 12
select is(
  (
    select status
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000001'
  ),
  'submitted',
  'a new transfer starts submitted'
);
-- 13
select is(
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  100000::bigint,
  'transfer submission does not debit the current position'
);
-- 14
select is(
  (
    select reserved_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  2500::bigint,
  'transfer submission reserves the requested amount'
);
-- 15
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where event_key = (
      select 'transfer_intents:' || id::text || ':submitted'
      from public.transfer_intents
      where idempotency_key = '50000000-0000-0000-0000-000000000001'
    )
      and template_key = 'transfer_submitted'
  ),
  1::bigint,
  'transfer submission enqueues one submission email'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
-- 16
select lives_ok(
  $test$
    select public.submit_transfer_intent(
      '40000000-0000-0000-0000-000000000001',
      'Bénéficiaire test',
      '••••1234',
      '{"recipientAccount":"FR761234"}'::jsonb,
      'eurozone',
      2500,
      'EUR',
      2500,
      'EUR',
      1,
      timestamptz '2026-01-02 00:00:00+00',
      'Nouvelle tentative idempotente',
      '50000000-0000-0000-0000-000000000001'
    )
  $test$,
  'an idempotent transfer retry succeeds'
);

reset role;
-- 17
select is(
  (
    select reserved_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  2500::bigint,
  'an idempotent retry does not reserve twice'
);
-- 18
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'transfer_submitted'
      and entity_id = (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000001'
      )
  ),
  1::bigint,
  'an idempotent retry does not duplicate the submission email'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
-- 19
select throws_ok(
  $test$
    select public.branch_manager_approve_transfer(
      (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000001'
      ),
      'Tentative par un simple reviewer'
    )
  $test$,
  '42501',
  'permission denied for function branch_manager_approve_transfer',
  'a non-admin staff member cannot approve a transfer'
);

reset role;
-- 20
select is(
  (
    select status
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000001'
  ),
  'submitted',
  'a rejected non-admin approval leaves the transfer submitted'
);
-- 21
select is(
  (
    select count(*)
    from public.transfer_review_checks
    where transfer_id = (
      select id
      from public.transfer_intents
      where idempotency_key = '50000000-0000-0000-0000-000000000001'
    )
      and status = 'pending'
  ),
  4::bigint,
  'all four transfer checks remain pending after a forbidden approval'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 22
select lives_ok(
  $test$
    select public.branch_manager_review_transfer_check((select id from public.transfer_intents where idempotency_key = '50000000-0000-0000-0000-000000000001'), 'dual_review', 'Double validation terminée');
    select public.branch_manager_review_transfer_check((select id from public.transfer_intents where idempotency_key = '50000000-0000-0000-0000-000000000001'), 'escalation', 'Escalade terminée');
    select public.branch_manager_review_transfer_check((select id from public.transfer_intents where idempotency_key = '50000000-0000-0000-0000-000000000001'), 'compliance', 'Conformité terminée');
    select public.branch_manager_review_transfer_check((select id from public.transfer_intents where idempotency_key = '50000000-0000-0000-0000-000000000001'), 'final_authorization', 'Autorisation finale confirmée')
  $test$,
  'the branch manager approves the transfer atomically'
);

reset role;
-- 23
select is(
  (
    select status
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000001'
  ),
  'external_settlement_confirmed',
  'the fourth check authorizes and settles the transfer'
);
-- 24
select is(
  (
    select count(*)
    from public.transfer_review_checks
    where transfer_id = (
      select id
      from public.transfer_intents
      where idempotency_key = '50000000-0000-0000-0000-000000000001'
    )
      and status = 'completed'
  ),
  4::bigint,
  'one branch-manager call completes all four transfer checks'
);
-- 25
select is(
  (
    select count(distinct reviewer_id)
    from public.transfer_review_checks
    where transfer_id = (
      select id
      from public.transfer_intents
      where idempotency_key = '50000000-0000-0000-0000-000000000001'
    )
  ),
  1::bigint,
  'all transfer checks are completed by one branch manager'
);
-- 26
select ok(
  (
    select bool_and(reviewer_id = '30000000-0000-0000-0000-000000000001')
    from public.transfer_review_checks
    where transfer_id = (
      select id
      from public.transfer_intents
      where idempotency_key = '50000000-0000-0000-0000-000000000001'
    )
  ),
  'every transfer check records the branch manager as reviewer'
);
-- 27
select is(
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  97500::bigint,
  'the fourth check debits the position'
);
-- 28
select is(
  (
    select reserved_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'the fourth check releases the reservation'
);
-- 29
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'transfer_completed'
      and entity_id = (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000001'
      )
  ),
  1::bigint,
  'transfer finalization enqueues one completion email'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
-- 30
select throws_ok(
  $test$
    select public.branch_manager_finalize_transfer(
      (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000001'
      ),
      'Tentative de finalisation'
    )
  $test$,
  '42501',
  'permission denied for function branch_manager_finalize_transfer',
  'a non-admin staff member cannot finalize a transfer'
);

reset role;
-- 31
select is(
  (
    select status
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000001'
  ),
  'external_settlement_confirmed',
  'the fourth review check already finalized the transfer'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 32: the legacy finalization endpoint is no longer exposed to clients.
select throws_ok(
  $test$
    select public.branch_manager_finalize_transfer(
      (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000001'
      ),
      'Virement confirmé effectif'
    )
  $test$,
  '42501',
  'permission denied for function branch_manager_finalize_transfer',
  'the legacy finalization endpoint is blocked'
);

reset role;
-- 33
select is(
  (
    select status
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000001'
  ),
  'external_settlement_confirmed',
  'the transfer reaches its final status'
);
-- 34
select is(
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  97500::bigint,
  'finalization debits the position exactly once'
);
-- 35
select is(
  (
    select reserved_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'finalization releases the reservation atomically'
);
-- 36
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'transfer_completed'
      and entity_id = (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000001'
      )
  ),
  1::bigint,
  'transfer finalization enqueues one completion email'
);

-- Rejected transfer: only the manager may reject and the reservation is released.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
-- 37
select lives_ok(
  $test$
    select public.submit_transfer_intent(
      '40000000-0000-0000-0000-000000000001',
      'Bénéficiaire refusé',
      '••••9999',
      '{}'::jsonb,
      'eurozone',
      1000,
      'EUR',
      1000,
      'EUR',
      1,
      timestamptz '2026-01-02 00:00:00+00',
      'Test de refus',
      '50000000-0000-0000-0000-000000000002'
    )
  $test$,
  'the owner can submit a transfer that will be rejected'
);

reset role;
-- 38
select is(
  (
    select reserved_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  1000::bigint,
  'the second transfer reserves its amount'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
-- 39
select throws_ok(
  $test$
    select public.branch_manager_reject_transfer(
      (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000002'
      ),
      'Refus non autorisé'
    )
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a non-admin staff member cannot reject a transfer'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 40
select lives_ok(
  $test$
    select public.branch_manager_reject_transfer(
      (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000002'
      ),
      'Demande refusée après contrôle interne'
    )
  $test$,
  'the branch manager can reject the transfer'
);

reset role;
-- 41
select is(
  (
    select status
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000002'
  ),
  'rejected',
  'the rejected transfer reaches its terminal status'
);
-- 42
select is(
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  97500::bigint,
  'rejecting a transfer does not debit the position'
);
-- 43
select is(
  (
    select reserved_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'rejecting a transfer releases its reservation'
);
-- 44
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'transfer_rejected'
      and entity_id = (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000002'
      )
  ),
  1::bigint,
  'transfer rejection enqueues one rejection email'
);

-- Successful loan: submit, single-manager validation, then credit one current position.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
-- 45
select throws_ok(
  $test$
    select public.submit_loan_application(
      99999,
      'EUR',
      24,
      'personal',
      '[]'::jsonb,
      '60000000-0000-0000-0000-000000000011'
    )
  $test$,
  '22023',
  'LOAN_AMOUNT_OUT_OF_RANGE',
  'the server rejects loan amounts below the configured minimum'
);
select throws_ok(
  $test$
    select public.submit_loan_application(
      100000,
      'EUR',
      13,
      'personal',
      '[]'::jsonb,
      '60000000-0000-0000-0000-000000000012'
    )
  $test$,
  '22023',
  'LOAN_DURATION_STEP_MISMATCH',
  'the server rejects durations outside the configured step'
);
select throws_ok(
  $test$
    select public.submit_loan_application(
      100000,
      'USD',
      12,
      'personal',
      '[]'::jsonb,
      '60000000-0000-0000-0000-000000000013'
    )
  $test$,
  '22023',
  'LOAN_CURRENCY_MUST_MATCH_BASE',
  'the server rejects a supported loan currency that differs from the contractual base'
);
select lives_ok(
  $test$
    select public.submit_loan_application(
      150000,
      'EUR',
      24,
      'personal',
      '["10000000-0000-0000-0000-000000000001/loans/test/income.pdf"]'::jsonb,
      '60000000-0000-0000-0000-000000000001'
    )
  $test$,
  'the owner can submit a loan application'
);
select is(
  (
    select jsonb_build_object(
      'annualRate', indicative_annual_rate,
      'monthlyPaymentMinor', indicative_monthly_payment_minor,
      'customReference', reference ~ '^TestLoan_[0-9]{8}-[A-F0-9]{32}$'
    )
    from public.loan_applications
    where idempotency_key = '60000000-0000-0000-0000-000000000001'
  ),
  jsonb_build_object(
    'annualRate', 0.04::numeric,
    'monthlyPaymentMinor', 6514::bigint,
    'customReference', true
  ),
  'loan pricing and reference generation use only the persisted product settings'
);
select lives_ok(
  $test$
    select public.submit_loan_application(
      150000,
      'EUR',
      24,
      'personal',
      '["10000000-0000-0000-0000-000000000001/loans/test/income.pdf"]'::jsonb,
      '60000000-0000-0000-0000-000000000001'
    )
  $test$,
  'a loan submission retry returns the original application idempotently'
);

reset role;
-- 46
select is(
  (
    select jsonb_build_object('status', status, 'motiveCode', motive_code)
    from public.loan_applications
    where idempotency_key = '60000000-0000-0000-0000-000000000001'
  ),
  jsonb_build_object('status', 'submitted', 'motiveCode', 'personal'),
  'a new loan starts submitted with a stable motive code'
);
-- 47
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'loan_submitted'
      and entity_id = (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      )
  ),
  1::bigint,
  'loan submission enqueues one submission email'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
-- 48
select throws_ok(
  $test$
    select public.branch_manager_approve_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      ),
      'Tentative par un reviewer'
    )
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a non-admin staff member cannot approve a loan'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 49
select lives_ok(
  $test$
    select public.branch_manager_approve_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      ),
      'Contrôles internes terminés'
    )
  $test$,
  'the branch manager approves the loan atomically'
);

reset role;
-- 50
select is(
  (
    select status
    from public.loan_applications
    where idempotency_key = '60000000-0000-0000-0000-000000000001'
  ),
  'approved_for_external_funding',
  'the approved loan is ready for internal disbursement'
);
-- 51
select is(
  (
    select count(*)
    from public.loan_review_checks
    where loan_id = (
      select id
      from public.loan_applications
      where idempotency_key = '60000000-0000-0000-0000-000000000001'
    )
      and status = 'completed'
  ),
  4::bigint,
  'one branch-manager call completes all four loan checks'
);
-- 52
select is(
  (
    select count(distinct reviewer_id)
    from public.loan_review_checks
    where loan_id = (
      select id
      from public.loan_applications
      where idempotency_key = '60000000-0000-0000-0000-000000000001'
    )
  ),
  1::bigint,
  'all loan checks are completed by one branch manager'
);
-- 53
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'loan_approved'
      and entity_id = (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      )
  ),
  1::bigint,
  'loan approval enqueues one approval email'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
-- 54
select throws_ok(
  $test$
    select public.branch_manager_disburse_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      ),
      '40000000-0000-0000-0000-000000000001',
      'Tentative de décaissement'
    )
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a non-admin staff member cannot disburse a loan'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 55
select throws_ok(
  $test$
    select public.branch_manager_disburse_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      ),
      '40000000-0000-0000-0000-000000000004',
      'Mauvais propriétaire'
    )
  $test$,
  'P0002',
  'LOAN_DESTINATION_POSITION_NOT_FOUND',
  'a loan cannot credit another user position'
);
-- 56
select throws_ok(
  $test$
    select public.branch_manager_disburse_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      ),
      '40000000-0000-0000-0000-000000000002',
      'Compte épargne interdit'
    )
  $test$,
  '22023',
  'LOAN_DESTINATION_MUST_BE_CURRENT_ACCOUNT',
  'a loan cannot credit a savings position'
);
-- 57
select throws_ok(
  $test$
    select public.branch_manager_disburse_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      ),
      '40000000-0000-0000-0000-000000000003',
      'Mauvaise devise'
    )
  $test$,
  '22023',
  'LOAN_DESTINATION_CURRENCY_MISMATCH',
  'a loan cannot credit a position in another currency'
);

reset role;
-- 58
select is(
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  97500::bigint,
  'failed disbursement attempts do not change the destination balance'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 59
select lives_ok(
  $test$
    select public.branch_manager_disburse_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      ),
      '40000000-0000-0000-0000-000000000001',
      'Décaissement interne confirmé'
    )
  $test$,
  'the branch manager records disbursement to the owner current position'
);

reset role;
-- 60
select is(
  (
    select status
    from public.loan_applications
    where idempotency_key = '60000000-0000-0000-0000-000000000001'
  ),
  'external_settlement_confirmed',
  'the disbursed loan reaches its final status'
);
-- 61
select is(
  (
    select credited_position_id
    from public.loan_applications
    where idempotency_key = '60000000-0000-0000-0000-000000000001'
  ),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'the loan records exactly which current position was credited'
);
-- 62
select is(
  (
    select disbursed_by
    from public.loan_applications
    where idempotency_key = '60000000-0000-0000-0000-000000000001'
  ),
  '30000000-0000-0000-0000-000000000001'::uuid,
  'the loan records the branch manager who disbursed it'
);
-- 63
select is(
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  247500::bigint,
  'loan disbursement credits the requested amount exactly once'
);
-- 64
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'loan_disbursed'
      and entity_id = (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      )
  ),
  1::bigint,
  'loan disbursement enqueues one disbursement email'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 65
select throws_ok(
  $test$
    select public.branch_manager_disburse_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      ),
      '40000000-0000-0000-0000-000000000001',
      'Nouvelle tentative'
    )
  $test$,
  '55000',
  'LOAN_NOT_READY_FOR_DISBURSEMENT',
  'a finalized loan cannot be disbursed twice'
);

reset role;
-- 66
select is(
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  247500::bigint,
  'a repeated disbursement attempt cannot duplicate the credit'
);
-- 67
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'loan_disbursed'
      and entity_id = (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000001'
      )
  ),
  1::bigint,
  'a repeated disbursement attempt cannot duplicate its email'
);

-- Rejected loan: only the manager may reject and no current position is credited.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
-- 68
select lives_ok(
  $test$
    select public.submit_loan_application(
      100000,
      'EUR',
      12,
      'other',
      '["10000000-0000-0000-0000-000000000001/loans/test/rejected.pdf"]'::jsonb,
      '60000000-0000-0000-0000-000000000002'
    )
  $test$,
  'a second loan sharing the same first UUID block can be submitted'
);

reset role;
-- 69
select is(
  (
    select count(distinct reference)
    from public.loan_applications
    where idempotency_key in (
      '60000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000002'
    )
  ),
  2::bigint,
  'full idempotency entropy keeps references distinct when UUID prefixes collide'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
-- 70
select throws_ok(
  $test$
    select public.branch_manager_reject_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000002'
      ),
      'Refus non autorisé'
    )
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a non-admin staff member cannot reject a loan'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 71
select lives_ok(
  $test$
    select public.branch_manager_reject_loan(
      (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000002'
      ),
      'Demande refusée après contrôle interne'
    )
  $test$,
  'the branch manager can reject the loan'
);

reset role;
-- 72
select is(
  (
    select status
    from public.loan_applications
    where idempotency_key = '60000000-0000-0000-0000-000000000002'
  ),
  'rejected',
  'the rejected loan reaches its terminal status'
);
-- 73
select is(
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  247500::bigint,
  'rejecting a loan does not credit the current position'
);
-- 74
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'loan_rejected'
      and entity_id = (
        select id
        from public.loan_applications
        where idempotency_key = '60000000-0000-0000-0000-000000000002'
      )
  ),
  1::bigint,
  'loan rejection enqueues one rejection email'
);

-- The outbox contains one immutable event per relevant business transition.
-- 75
select is(
  (select count(*) from public.transactional_email_outbox),
  9::bigint,
  'the two transfer and two loan scenarios enqueue nine relevant emails'
);
-- 76
select is(
  (select count(distinct event_key) from public.transactional_email_outbox),
  9::bigint,
  'every transactional email event key is unique'
);
-- 77
select is(
  (
    select array_agg(template_key order by template_key)::text
    from public.transactional_email_outbox
  ),
  array[
    'loan_approved',
    'loan_disbursed',
    'loan_rejected',
    'loan_submitted',
    'loan_submitted',
    'transfer_completed',
    'transfer_rejected',
    'transfer_submitted',
    'transfer_submitted'
  ]::text,
  'the outbox contains exactly the expected workflow templates'
);
-- 78
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_transactional_emails(integer)',
    'execute'
  ),
  'authenticated end users cannot consume the transactional email outbox'
);
-- 79
select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_transactional_email(uuid,uuid,boolean,text,text)',
    'execute'
  ),
  'authenticated end users cannot mark transactional emails as sent'
);

-- Profile language invariants.
-- 80
select has_column(
  'public',
  'profiles',
  'preferred_language',
  'profiles persist the preferred language'
);
-- 81
select ok(
  (
    select attnotnull
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname = 'preferred_language'
      and not attisdropped
  ),
  'the preferred language is mandatory'
);
-- 82
select is(
  (
    select pg_get_expr(adbin, adrelid)
    from pg_attrdef
    where adrelid = 'public.profiles'::regclass
      and adnum = (
        select attnum
        from pg_attribute
        where attrelid = 'public.profiles'::regclass
          and attname = 'preferred_language'
          and not attisdropped
      )
  ),
  '''fr''::text',
  'the preferred language defaults to French'
);
-- 83
select is(
  (
    select preferred_language
    from public.profiles
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  'fr',
  'a signup without language metadata falls back to French'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '10000000-0000-0000-0000-000000000003',
    'german-owner@monalyz.test',
    '{"preferred_language":"de","base_currency":"EUR"}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'invalid-language-owner@monalyz.test',
    '{"preferred_language":"pt","base_currency":"EUR"}'::jsonb
  );

-- 84
select is(
  (
    select preferred_language
    from public.profiles
    where user_id = '10000000-0000-0000-0000-000000000003'
  ),
  'de',
  'the signup trigger copies an allowlisted language'
);
-- 85
select is(
  (
    select preferred_language
    from public.profiles
    where user_id = '10000000-0000-0000-0000-000000000004'
  ),
  'fr',
  'the signup trigger rejects unsupported language metadata'
);
-- 86
select throws_ok(
  $test$
    update public.profiles
    set preferred_language = 'pt'
    where user_id = '10000000-0000-0000-0000-000000000001'
  $test$,
  '23514',
  null,
  'the preferred-language constraint rejects unsupported values'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
with own_update as (
  update public.profiles
  set preferred_language = 'es'
  where user_id = '10000000-0000-0000-0000-000000000001'
  returning 1
),
other_update as (
  update public.profiles
  set preferred_language = 'en'
  where user_id = '10000000-0000-0000-0000-000000000002'
  returning 1
)
select
  set_config(
    'test.language_own_update_count',
    (select count(*)::text from own_update),
    true
  ),
  set_config(
    'test.language_other_update_count',
    (select count(*)::text from other_update),
    true
  );
-- 87
select is(
  current_setting('test.language_own_update_count')::bigint,
  1::bigint,
  'a user can update their own preferred language'
);
-- 88
select is(
  current_setting('test.language_other_update_count')::bigint,
  0::bigint,
  'a user cannot update another profile language'
);

reset role;
-- 89
select is(
  (
    select preferred_language
    from public.profiles
    where user_id = '10000000-0000-0000-0000-000000000002'
  ),
  'fr',
  'the forbidden profile update leaves the other preference unchanged'
);

-- Demo provisioning is privileged, deterministic and idempotent.
-- 90
select has_function(
  'public',
  'provision_demo_accounts',
  array['uuid', 'uuid', 'text'],
  'the demo provisioner RPC exists'
);
-- 91
select ok(
  not has_function_privilege(
    'anon',
    'public.provision_demo_accounts(uuid,uuid,text)',
    'execute'
  ),
  'anonymous sessions cannot provision demo accounts'
);
-- 92
select ok(
  not has_function_privilege(
    'authenticated',
    'public.provision_demo_accounts(uuid,uuid,text)',
    'execute'
  ),
  'authenticated sessions cannot provision demo accounts'
);
-- 93
select ok(
  has_function_privilege(
    'service_role',
    'public.provision_demo_accounts(uuid,uuid,text)',
    'execute'
  ),
  'only the server worker role can reach the demo provisioner'
);

-- A developer database may already contain the persistent demo accounts. The
-- whole pgTAP file runs in a transaction that is rolled back, so temporarily
-- isolate their deterministic fixtures and emails before exercising the RPC
-- with stable test UUIDs.
select set_config(
  'monalyz.allow_official_document_maintenance',
  'on',
  true
);
delete from public.official_documents
where owner_id in (
  select id
  from auth.users
  where lower(email) in (
    'admin.demo@monalyz.com',
    'client.demo@monalyz.com'
  )
);

select set_config(
  'monalyz.allow_ledger_maintenance',
  'on',
  true
);
delete from public.financial_ledger_entries
where owner_id in (
  select id
  from auth.users
  where lower(email) in (
    'admin.demo@monalyz.com',
    'client.demo@monalyz.com'
  )
);

delete from public.kyc_events
where kyc_id in (
  select id
  from public.kyc_applications
  where owner_id in (
    select id
    from auth.users
    where lower(email) in (
      'admin.demo@monalyz.com',
      'client.demo@monalyz.com'
    )
  )
);

delete from public.audit_events
where actor_id in (
  select id
  from auth.users
  where lower(email) in (
    'admin.demo@monalyz.com',
    'client.demo@monalyz.com'
  )
);

delete from public.financial_positions
where owner_id in (
  select id
  from auth.users
  where lower(email) in (
    'admin.demo@monalyz.com',
    'client.demo@monalyz.com'
  )
);

delete from public.kyc_applications
where owner_id in (
  select id
  from auth.users
  where lower(email) in (
    'admin.demo@monalyz.com',
    'client.demo@monalyz.com'
  )
);

delete from public.staff_members
where user_id in (
  select id
  from auth.users
  where lower(email) in (
    'admin.demo@monalyz.com',
    'client.demo@monalyz.com'
  )
);

select set_config(
  'monalyz.allow_official_document_maintenance',
  'off',
  true
);
select set_config(
  'monalyz.allow_ledger_maintenance',
  'off',
  true
);

update public.profiles
set email = 'pgtap-existing-' || user_id::text || '@monalyz.invalid'
where user_id in (
  select id
  from auth.users
  where lower(email) in (
    'admin.demo@monalyz.com',
    'client.demo@monalyz.com'
  )
);

update auth.users
set email = 'pgtap-existing-' || id::text || '@monalyz.invalid'
where lower(email) in (
  'admin.demo@monalyz.com',
  'client.demo@monalyz.com'
);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
  (
    'd2000000-0000-4000-8000-000000000001',
    'admin.demo@monalyz.com',
    '{"monalyz_demo":true,"demo_role":"admin"}'::jsonb,
    '{"base_currency":"EUR"}'::jsonb
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    'client.demo@monalyz.com',
    '{"monalyz_demo":true,"demo_role":"client"}'::jsonb,
    '{"base_currency":"EUR"}'::jsonb
  );

set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
-- 94
select lives_ok(
  $test$
    select public.provision_demo_accounts(
      'd2000000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000002',
      'local'
    )
  $test$,
  'the service worker can provision the two synthetic identities'
);
-- 95
select lives_ok(
  $test$
    select public.provision_demo_accounts(
      'd2000000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000002',
      'local'
    )
  $test$,
  'a second provisioning run is idempotent'
);
reset role;

-- 96
select is(
  jsonb_build_object(
    'active_admins',
    (
      select count(*)
      from public.staff_members
      where user_id = 'd2000000-0000-4000-8000-000000000001'
        and role = 'admin'
        and active
    ),
    'client_staff',
    (
      select count(*)
      from public.staff_members
      where user_id = 'd2000000-0000-4000-8000-000000000002'
    ),
    'client_kyc',
    (
      select count(*)
      from public.kyc_applications
      where id = 'd3000000-0000-4000-8000-000000000001'
        and owner_id = 'd2000000-0000-4000-8000-000000000002'
        and status = 'approved'
        and document_object_paths = '{}'::jsonb
        and address ->> 'monalyz_demo' = 'true'
    ),
    'client_positions',
    (
      select count(*)
      from public.financial_positions
      where id = 'd3000000-0000-4000-8000-000000000003'
        and owner_id = 'd2000000-0000-4000-8000-000000000002'
        and account_type = 'current'
        and currency = 'EUR'
        and amount_minor = 2500000
        and external_identifier_masked is null
    ),
    'kyc_events',
    (
      select count(*)
      from public.kyc_events
      where kyc_id = 'd3000000-0000-4000-8000-000000000001'
        and event_type = 'demo_approved'
    ),
    'audit_events',
    (
      select count(*)
      from public.audit_events
      where actor_id = 'd2000000-0000-4000-8000-000000000001'
        and metadata ->> 'source' = 'demo_provisioner'
    )
  ),
  jsonb_build_object(
    'active_admins', 1,
    'client_staff', 0,
    'client_kyc', 1,
    'client_positions', 1,
    'kyc_events', 1,
    'audit_events', 4
  ),
  'demo fixtures remain exact after two runs'
);

-- 97
select is(
  jsonb_build_object(
    'admin_kyc',
    (
      select count(*)
      from public.kyc_applications
      where owner_id = 'd2000000-0000-4000-8000-000000000001'
    ),
    'admin_positions',
    (
      select count(*)
      from public.financial_positions
      where owner_id = 'd2000000-0000-4000-8000-000000000001'
    ),
    'transfers',
    (
      select count(*)
      from public.transfer_intents
      where owner_id = 'd2000000-0000-4000-8000-000000000002'
    ),
    'loans',
    (
      select count(*)
      from public.loan_applications
      where owner_id = 'd2000000-0000-4000-8000-000000000002'
    )
  ),
  jsonb_build_object(
    'admin_kyc', 0,
    'admin_positions', 0,
    'transfers', 0,
    'loans', 0
  ),
  'demo provisioning creates no bank workflow or client fixture for the admin'
);

-- The demo administrator may change its login address without changing its
-- immutable Auth identity or causing a later provisioner run to duplicate it.
select lives_ok(
  $test$
    update auth.users
    set email = 'direction.demo@monalyz.invalid'
    where id = 'd2000000-0000-4000-8000-000000000001'
  $test$,
  'the demo administrator Auth e-mail can change'
);

select is(
  (
    select email
    from public.profiles
    where user_id = 'd2000000-0000-4000-8000-000000000001'
  ),
  'direction.demo@monalyz.invalid',
  'the demo administrator profile follows the Auth e-mail'
);

set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
select lives_ok(
  $test$
    select public.provision_demo_accounts(
      'd2000000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000002',
      'local'
    )
  $test$,
  'demo provisioning remains idempotent after the admin e-mail changes'
);
reset role;

select is(
  (
    select jsonb_build_object(
      'demo_admin_users', count(*) filter (
        where raw_app_meta_data ->> 'monalyz_demo' = 'true'
          and raw_app_meta_data ->> 'demo_role' = 'admin'
      ),
      'new_email_users', count(*) filter (
        where lower(email) = 'direction.demo@monalyz.invalid'
      ),
      'legacy_email_users', count(*) filter (
        where lower(email) = 'admin.demo@monalyz.com'
      )
    )
    from auth.users
    where id = 'd2000000-0000-4000-8000-000000000001'
       or raw_app_meta_data ->> 'demo_role' = 'admin'
  ),
  jsonb_build_object(
    'demo_admin_users', 1,
    'new_email_users', 1,
    'legacy_email_users', 0
  ),
  'reprovisioning keeps one demo administrator at the changed address'
);

-- Official accounts, append-only ledger and official documents.
-- 98
select has_column(
  'public',
  'financial_positions',
  'account_number',
  'financial positions expose the official account number'
);
-- 99
select has_column(
  'public',
  'financial_positions',
  'iban',
  'financial positions expose a normalized IBAN'
);
-- 100
select has_column(
  'public',
  'financial_positions',
  'account_status',
  'financial positions expose the bank account lifecycle'
);
-- 101
select has_table(
  'public',
  'financial_ledger_entries',
  'the append-only financial ledger exists'
);
-- 102
select has_table(
  'public',
  'official_documents',
  'the official document registry exists'
);
-- 103
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.financial_ledger_entries'::regclass
  ),
  'RLS is enabled on financial ledger entries'
);
-- 104
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.official_documents'::regclass
  ),
  'RLS is enabled on official documents'
);
-- 105
select is(
  private.normalize_iban('fr52 99999 99999 00000000001 00'),
  'FR5299999999990000000000100',
  'IBAN normalization removes spaces and uppercases letters'
);
-- 106
select ok(
  private.is_valid_iban('FR5299999999990000000000100'),
  'the deterministic test IBAN passes MOD-97 validation'
);
-- 107
select ok(
  not private.is_valid_iban('FR0099999999990000000000100'),
  'an IBAN with an invalid checksum is rejected'
);
-- 108
select ok(
  not has_function_privilege(
    'authenticated',
    'public.adjust_financial_position(uuid,bigint,timestamptz,text)',
    'execute'
  ),
  'the legacy balance adjustment RPC is no longer callable'
);

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
  'b1000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'b1000000-0000-4000-8000-000000000002',
  'Autre',
  'Propriétaire',
  date '1990-01-01',
  'Test',
  'Test',
  '{"street":"Test","postalCode":"00000","city":"Test","country":"FR"}',
  'Test',
  'Test',
  false,
  false,
  '{}'::jsonb,
  'approved',
  now(),
  '30000000-0000-0000-0000-000000000001',
  'Dossier de test approuvé.'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
-- 109
select throws_ok(
  $test$
    select public.branch_manager_declare_account(
      '10000000-0000-0000-0000-000000000002',
      'Compte officiel refusé',
      'current',
      'EUR',
      'FR6699999999990000000001400',
      'DEMOFRP1XXX',
      'Autre Propriétaire Test',
      'Banque Test non routable',
      'Agence Test',
      'TEST-001',
      70000,
      timestamptz '2026-01-02 00:00:00+00',
      true,
      'Tentative par un non-administrateur.',
      'b2000000-0000-4000-8000-000000000001'
    )
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a non-admin cannot declare a bank account'
);

select throws_ok(
  $test$
    select public.set_account_number_prefix('12345')
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a non-admin cannot configure the account-number prefix'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
select throws_ok(
  $test$
    select public.set_account_number_prefix('1234A')
  $test$,
  '22023',
  'INVALID_ACCOUNT_NUMBER_PREFIX',
  'the account-number prefix accepts digits only and requires 5 to 9 digits'
);

select lives_ok(
  $test$
    select public.set_account_number_prefix('12345')
  $test$,
  'the branch manager configures the account-number prefix'
);

select is(
  (
    select jsonb_build_object(
      'prefix', prefix,
      'length', prefix_length,
      'capacity', capacity
    )
    from public.get_account_number_configuration()
  ),
  jsonb_build_object(
    'prefix', '12345',
    'length', 5,
    'capacity', 100000
  ),
  'the account-number configuration exposes its length and capacity'
);

-- 110
select lives_ok(
  $test$
    select public.branch_manager_declare_account(
      '10000000-0000-0000-0000-000000000002',
      'Compte officiel de test',
      'current',
      'EUR',
      'FR6699999999990000000001400',
      'DEMOFRP1XXX',
      'Autre Propriétaire Test',
      'Banque Test non routable',
      'Agence Test',
      'TEST-001',
      70000,
      timestamptz '2026-01-02 00:00:00+00',
      true,
      'Ouverture déclarée après traitement interne.',
      'b2000000-0000-4000-8000-000000000002'
    )
  $test$,
  'the branch manager declares an active account atomically'
);
reset role;

-- 111
select is(
  (
    select jsonb_build_object(
      'status', account_status,
      'account_number_valid',
        account_number ~ '^12345[0-9]{5}$',
      'iban', iban,
      'amount', amount_minor,
      'demo', is_demo
    )
    from public.financial_positions
    where declaration_idempotency_key =
      'b2000000-0000-4000-8000-000000000002'
  ),
  jsonb_build_object(
    'status', 'active',
    'account_number_valid', true,
    'iban', 'FR6699999999990000000001400',
    'amount', 70000,
    'demo', true
  ),
  'the declared account persists its official identifiers and balance'
);
-- 112
select is(
  (
    select count(*)
    from public.financial_ledger_entries
    where entry_key =
      'account-opening:b2000000-0000-4000-8000-000000000002'
      and entry_kind = 'account_opening'
      and amount_minor = 70000
      and balance_before_minor = 0
      and balance_after_minor = 70000
  ),
  1::bigint,
  'account declaration creates exactly one opening ledger entry'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 113
select lives_ok(
  $test$
    select public.branch_manager_declare_account(
      '10000000-0000-0000-0000-000000000002',
      'Compte officiel de test',
      'current',
      'EUR',
      'FR6699999999990000000001400',
      'DEMOFRP1XXX',
      'Autre Propriétaire Test',
      'Banque Test non routable',
      'Agence Test',
      'TEST-001',
      70000,
      timestamptz '2026-01-02 00:00:00+00',
      true,
      'Ouverture déclarée après traitement interne.',
      'b2000000-0000-4000-8000-000000000002'
    )
  $test$,
  'an exact account declaration retry is idempotent'
);

select lives_ok(
  $test$
    select public.set_account_number_prefix('987654321')
  $test$,
  'the branch manager can change the prefix for future accounts'
);

select ok(
  (
    select account_number ~ '^12345[0-9]{5}$'
    from public.financial_positions
    where declaration_idempotency_key =
      'b2000000-0000-4000-8000-000000000002'
  ),
  'changing the prefix preserves existing account numbers'
);

reset role;

insert into public.financial_positions (
  owner_id,
  label,
  position_kind,
  currency,
  amount_minor,
  reserved_minor,
  as_of,
  account_type,
  account_number,
  account_status
)
select
  '10000000-0000-0000-0000-000000000002',
  'Réservation de capacité ' || suffix,
  'declared',
  'EUR',
  0,
  0,
  now(),
  'current',
  '987654321' || suffix,
  'pending'
from generate_series(0, 9) as suffix;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $test$
    select public.branch_manager_declare_account(
      '10000000-0000-0000-0000-000000000002',
      'Compte impossible',
      'current',
      'EUR',
      'FR6699999999990000000001400',
      'DEMOFRP1XXX',
      'Autre Propriétaire Test',
      'Banque Test non routable',
      'Agence Test',
      'TEST-001',
      0,
      timestamptz '2026-01-03 00:00:00+00',
      true,
      'Capacité volontairement épuisée pour le test.',
      'b2000000-0000-4000-8000-000000000099'
    )
  $test$,
  '54000',
  'ACCOUNT_NUMBER_PREFIX_EXHAUSTED',
  'account creation fails explicitly when the configured prefix is exhausted'
);

-- 114
select lives_ok(
  $test$
    select public.branch_manager_adjust_balance(
      (
        select id
        from public.financial_positions
        where declaration_idempotency_key =
          'b2000000-0000-4000-8000-000000000002'
      ),
      75000,
      now(),
      'Rapprochement interne de test.',
      'b2000000-0000-4000-8000-000000000003'
    )
  $test$,
  'the branch manager records an audited balance adjustment'
);
reset role;

-- 115
select is(
  (
    select amount_minor
    from public.financial_positions
    where declaration_idempotency_key =
      'b2000000-0000-4000-8000-000000000002'
  ),
  75000::bigint,
  'the balance aggregate reflects the adjustment'
);
-- 116
select is(
  (
    select count(*)
    from public.financial_ledger_entries
    where entry_key =
      'adjustment:b2000000-0000-4000-8000-000000000003'
      and entry_kind = 'manual_adjustment'
      and amount_minor = 5000
      and balance_before_minor = 70000
      and balance_after_minor = 75000
  ),
  1::bigint,
  'the adjustment records exact before and after balances'
);
-- 117
select throws_ok(
  $test$
    update public.financial_ledger_entries
    set description = 'Mutation interdite'
    where entry_key =
      'adjustment:b2000000-0000-4000-8000-000000000003'
  $test$,
  '55000',
  'FINANCIAL_LEDGER_IS_APPEND_ONLY',
  'financial ledger entries cannot be modified'
);
-- 118
select is(
  (
    select count(*)
    from public.financial_ledger_entries
    where source_transfer_id = (
      select id
      from public.transfer_intents
      where idempotency_key =
        '50000000-0000-0000-0000-000000000001'
    )
      and entry_kind = 'transfer_debit'
      and amount_minor = -2500
      and balance_before_minor = 100000
      and balance_after_minor = 97500
  ),
  1::bigint,
  'a finalized transfer creates exactly one matching debit'
);
-- 119
select is(
  (
    select count(*)
    from public.financial_ledger_entries
    where source_transfer_id = (
      select id
      from public.transfer_intents
      where idempotency_key =
        '50000000-0000-0000-0000-000000000002'
    )
  ),
  0::bigint,
  'a rejected transfer creates no ledger entry'
);
-- 120
select is(
  (
    select count(*)
    from public.financial_ledger_entries
    where source_loan_id = (
      select id
      from public.loan_applications
      where idempotency_key =
        '60000000-0000-0000-0000-000000000001'
    )
      and entry_kind = 'loan_credit'
      and amount_minor = 150000
  ),
  1::bigint,
  'a disbursed loan creates exactly one matching credit'
);
-- 121
select is(
  (
    select count(*)
    from public.financial_ledger_entries
    where source_loan_id = (
      select id
      from public.loan_applications
      where idempotency_key =
        '60000000-0000-0000-0000-000000000002'
    )
  ),
  0::bigint,
  'a rejected loan creates no ledger entry'
);
-- 122
select is(
  (
    select entry.balance_after_minor
    from public.financial_ledger_entries as entry
    where entry.account_id =
      '40000000-0000-0000-0000-000000000001'
    order by entry.sequence_no desc
    limit 1
  ),
  (
    select amount_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  'the latest ledger balance equals the account aggregate'
);
-- 123
select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_official_document(uuid,text,text,boolean,text)',
    'execute'
  ),
  'authenticated users cannot complete official documents'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
-- 124
select throws_ok(
  $test$
    select public.branch_manager_issue_official_document(
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      null,
      null,
      'bank_details',
      'RIB officiel de test',
      'fr',
      null,
      null,
      'b3000000-0000-4000-8000-000000000001'
    )
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a non-admin cannot issue an official document'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 125
select lives_ok(
  $test$
    select public.branch_manager_issue_official_document(
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      null,
      null,
      'bank_details',
      'RIB officiel de test',
      'fr',
      null,
      null,
      'b3000000-0000-4000-8000-000000000002'
    )
  $test$,
  'the branch manager creates an immutable pending document snapshot'
);
-- 126
select lives_ok(
  $test$
    select public.branch_manager_issue_official_document(
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      null,
      null,
      'bank_details',
      'RIB officiel de test',
      'fr',
      null,
      null,
      'b3000000-0000-4000-8000-000000000002'
    )
  $test$,
  'an exact official-document retry is idempotent'
);
reset role;

-- 127
select is(
  (
    select count(*)
    from public.official_documents
    where owner_id = '10000000-0000-0000-0000-000000000001'
      and idempotency_key =
        'b3000000-0000-4000-8000-000000000002'
      and status = 'pending'
      and char_length(snapshot_hash) = 64
      and not (snapshot -> 'account' ? 'iban')
      and snapshot -> 'account' ->> 'accountNumber' is not null
  ),
  1::bigint,
  'the pending document stores one hashed snapshot without a client IBAN'
);
-- 128
select is(
  (
    select count(*)
    from public.official_documents
    where owner_id = '10000000-0000-0000-0000-000000000001'
      and idempotency_key =
        'b3000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'an official-document retry does not duplicate the document'
);

set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
-- 129
select lives_ok(
  $test$
    select public.complete_official_document(
      (
        select id
        from public.official_documents
        where idempotency_key =
          'b3000000-0000-4000-8000-000000000002'
      ),
      '10000000-0000-0000-0000-000000000001/rib/v1.pdf',
      repeat('a', 64),
      true,
      null
    )
  $test$,
  'the service worker completes a rendered official PDF'
);
reset role;

-- 130
select is(
  (
    select jsonb_build_object(
      'status', status,
      'path', storage_path,
      'hash', content_hash,
      'issued', issued_at is not null
    )
    from public.official_documents
    where idempotency_key =
      'b3000000-0000-4000-8000-000000000002'
  ),
  jsonb_build_object(
    'status', 'issued',
    'path',
      '10000000-0000-0000-0000-000000000001/rib/v1.pdf',
    'hash', repeat('a', 64),
    'issued', true
  ),
  'a completed document retains its immutable artifact metadata'
);
-- 131
select throws_ok(
  $test$
    update public.official_documents
    set snapshot = '{"tampered":true}'::jsonb
    where idempotency_key =
      'b3000000-0000-4000-8000-000000000002'
  $test$,
  '55000',
  'OFFICIAL_DOCUMENT_SNAPSHOT_IS_IMMUTABLE',
  'an issued document snapshot cannot be altered'
);
-- 132
select is(
  (
    select count(*)
    from public.official_documents
    where idempotency_key =
      'b3000000-0000-4000-8000-000000000002'
      and snapshot ->> 'documentType' = 'bank_details'
  ),
  1::bigint,
  'failed tampering leaves the official snapshot intact'
);
-- 133
select is(
  (
    select jsonb_build_object(
      'active', account_status,
      'iban', iban,
      'valid_iban', private.is_valid_iban(iban),
      'demo', is_demo,
      'holder', account_holder_name
    )
    from public.financial_positions
    where id = 'd3000000-0000-4000-8000-000000000003'
  ),
  jsonb_build_object(
    'active', 'active',
    'iban', 'FR5299999999990000000000100',
    'valid_iban', true,
    'demo', true,
    'holder', 'Client Démo Monalyz'
  ),
  'the demo position is an explicit validated non-routable demo account'
);
-- 134
select is(
  (
    select count(*)
    from public.financial_ledger_entries
    where account_id = 'd3000000-0000-4000-8000-000000000003'
      and balance_after_minor = 2500000
      and metadata ->> 'demo' = 'true'
  ),
  1::bigint,
  'the freshly provisioned demo account has one synthetic opening entry'
);
-- 135
select is(
  (
    select count(*)
    from public.official_documents
    where owner_id = 'd2000000-0000-4000-8000-000000000002'
      and account_id = 'd3000000-0000-4000-8000-000000000003'
      and status = 'pending'
      and is_demo
      and snapshot -> 'demo' ->> 'watermark' =
        'DÉMONSTRATION — AUCUNE VALEUR'
  ),
  3::bigint,
  'the demo account exposes three pending watermarked documents'
);
-- 136
select is(
  (
    select array_agg(document_type order by document_type)::text
    from public.official_documents
    where owner_id = 'd2000000-0000-4000-8000-000000000002'
  ),
  array[
    'account_statement',
    'balance_certificate',
    'bank_details'
  ]::text,
  'the demo document set contains RIB, statement and balance certificate'
);
-- 137
select is(
  (
    select count(*)
    from public.official_documents
    where owner_id = 'd2000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'the demo administrator receives no client official document'
);

-- Dynamic bank identity contract.
select has_table('public', 'brand_settings', 'the public brand singleton exists');
select has_column('public', 'official_documents', 'brand_name_snapshot', 'official documents snapshot the published bank name');
select has_column('public', 'official_documents', 'brand_revision_snapshot', 'official documents snapshot the brand revision');
select has_column('public', 'official_documents', 'brand_logo_path_snapshot', 'official documents snapshot the versioned PDF logo path');
select is(
  (select relrowsecurity from pg_class where oid = 'public.brand_settings'::regclass),
  true,
  'RLS is enabled on brand settings'
);
select ok(
  has_table_privilege('authenticated', 'public.brand_settings', 'select'),
  'authenticated sessions can read the published brand'
);
select ok(
  has_table_privilege('anon', 'public.brand_settings', 'select'),
  'anonymous visitors can read the published brand'
);
select ok(
  not has_table_privilege('authenticated', 'public.brand_settings', 'update'),
  'authenticated sessions cannot update branding directly'
);
select ok(
  not has_table_privilege('anon', 'public.brand_settings', 'update'),
  'anonymous visitors cannot update branding directly'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'INSERT'
      and 'authenticated' = any(roles)
      and coalesce(qual, with_check, '') like '%brand-assets%'
  ),
  0::bigint,
  'no direct authenticated upload policy exists for brand assets'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $test$
    select public.publish_brand_settings(
      1, 'Reviewer Bank',
      'releases/reviewer/logo-primary.png', 1200, 320,
      'releases/reviewer/logo-reversed.png', 1200, 320,
      'releases/reviewer/logo-email.png', 'releases/reviewer/logo-pdf.png',
      'releases/reviewer/favicon.ico', 'releases/reviewer/favicon-16.png',
      'releases/reviewer/favicon-32.png', 'releases/reviewer/favicon-48.png',
      'releases/reviewer/apple.png', 'releases/reviewer/app-192.png',
      'releases/reviewer/app-512.png', 'releases/reviewer/maskable.png',
      'releases/reviewer/social.png'
    )
  $test$,
  '42501',
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
  'a non-administrator cannot publish bank identity'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $test$
    select public.publish_brand_settings(
      1, 'Kaly Banque',
      'releases/test/logo-primary.png', 1200, 320,
      'releases/test/logo-reversed.png', 1200, 320,
      'releases/test/logo-email.png', 'releases/test/logo-pdf.png',
      'releases/test/favicon.ico', 'releases/test/favicon-16.png',
      'releases/test/favicon-32.png', 'releases/test/favicon-48.png',
      'releases/test/apple.png', 'releases/test/app-192.png',
      'releases/test/app-512.png', 'releases/test/maskable.png',
      'releases/test/social.png'
    )
  $test$,
  'the administrator publishes all brand fields atomically'
);
reset role;

select is(
  (select jsonb_build_object('name', bank_name, 'revision', revision, 'actor', updated_by) from public.brand_settings where singleton),
  jsonb_build_object('name', 'Kaly Banque', 'revision', 2::bigint, 'actor', '30000000-0000-0000-0000-000000000001'::uuid),
  'publication normalizes the bank name, increments revision and records its actor'
);
select is(
  (select count(*) from public.audit_events where action = 'branch_manager_publish_brand_settings'),
  1::bigint,
  'brand publication writes one audit event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $test$
    select public.publish_brand_settings(
      1, 'Stale Bank',
      'releases/stale/logo-primary.png', 1200, 320,
      'releases/stale/logo-reversed.png', 1200, 320,
      'releases/stale/logo-email.png', 'releases/stale/logo-pdf.png',
      'releases/stale/favicon.ico', 'releases/stale/favicon-16.png',
      'releases/stale/favicon-32.png', 'releases/stale/favicon-48.png',
      'releases/stale/apple.png', 'releases/stale/app-192.png',
      'releases/stale/app-512.png', 'releases/stale/maskable.png',
      'releases/stale/social.png'
    )
  $test$,
  '40001',
  'BRAND_REVISION_CONFLICT',
  'optimistic locking rejects a stale brand publication'
);
reset role;

select is((select bank_name from public.brand_settings where singleton), 'Kaly Banque', 'a conflict leaves the current publication unchanged');
select is((select public from storage.buckets where id = 'brand-assets'), true, 'the brand-assets bucket is publicly readable');
select is((select file_size_limit from storage.buckets where id = 'brand-assets'), 5242880::bigint, 'the brand-assets bucket enforces the five-megabyte limit');

-- Contractual base-currency invariants.
select has_column(
  'public',
  'profiles',
  'base_currency',
  'profiles persist an immutable contractual currency'
);

select ok(
  (
    select attnotnull
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname = 'base_currency'
      and not attisdropped
  ),
  'the contractual currency is mandatory'
);

select is(
  (
    select pg_get_expr(adbin, adrelid)
    from pg_attrdef
    where adrelid = 'public.profiles'::regclass
      and adnum = (
        select attnum
        from pg_attribute
        where attrelid = 'public.profiles'::regclass
          and attname = 'base_currency'
          and not attisdropped
      )
  ),
  '''EUR''::text',
  'the contractual currency has a safe EUR fallback'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '91000000-0000-4000-8000-000000000001',
    'usd-base-owner@monalyz.test',
    '{"base_currency":" usd ","preferred_currency":"CHF"}'::jsonb
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    'legacy-currency-owner@monalyz.test',
    '{"preferred_currency":"CAD"}'::jsonb
  );

select is(
  (
    select jsonb_build_object(
      'base', base_currency,
      'preferred', preferred_currency
    )
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  jsonb_build_object('base', 'USD', 'preferred', 'USD'),
  'the canonical signup currency wins and initializes both profile fields'
);

select is(
  (
    select jsonb_build_object(
      'base', base_currency,
      'preferred', preferred_currency
    )
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000003'
  ),
  jsonb_build_object('base', 'CAD', 'preferred', 'CAD'),
  'legacy signup metadata remains compatible when base_currency is absent'
);

select throws_ok(
  $test$
    insert into auth.users (id, email, raw_user_meta_data)
    values (
      '91000000-0000-4000-8000-000000000002',
      'invalid-base-owner@monalyz.test',
      '{"base_currency":"JPY"}'::jsonb
    )
  $test$,
  '22023',
  'SIGNUP_CURRENCY_UNSUPPORTED',
  'signup rejects unsupported contractual currency metadata'
);

select throws_ok(
  $test$
    insert into auth.users (id, email, raw_user_meta_data)
    values (
      '91000000-0000-4000-8000-000000000004',
      'missing-base-owner@monalyz.test',
      '{}'::jsonb
    )
  $test$,
  '22023',
  'SIGNUP_CURRENCY_REQUIRED',
  'signup rejects missing contractual currency metadata'
);

select throws_ok(
  $test$
    update public.profiles
    set base_currency = 'GBP'
    where user_id = '91000000-0000-4000-8000-000000000001'
  $test$,
  '55000',
  'PROFILE_BASE_CURRENCY_IMMUTABLE',
  'even a privileged direct update cannot mutate the contractual currency'
);

select throws_ok(
  $test$
    update public.profiles
    set preferred_currency = 'JPY'
    where user_id = '91000000-0000-4000-8000-000000000001'
  $test$,
  '23514',
  null,
  'the display preference is restricted to supported currencies'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
update public.profiles
set preferred_currency = 'CHF'
where user_id = '91000000-0000-4000-8000-000000000001';
reset role;

select is(
  (
    select jsonb_build_object(
      'base', base_currency,
      'preferred', preferred_currency
    )
    from public.profiles
    where user_id = '91000000-0000-4000-8000-000000000001'
  ),
  jsonb_build_object('base', 'USD', 'preferred', 'CHF'),
  'changing the display preference leaves the contractual currency unchanged'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
select public.set_account_number_prefix('24680');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);
select public.submit_kyc_application(
  'Nora',
  'Currency',
  date '1990-01-01',
  'Montréal',
  'Canadienne',
  '{"street":"1 rue Base","postalCode":"H1H1H1","city":"Montréal","country":"Canada"}',
  'Analyste',
  '1500_3000',
  false,
  false,
  'passport',
  'BASE123456',
  'Canada',
  current_date + 365,
  '{"id_front":"91000000-0000-4000-8000-000000000001/current/id_front.jpg","selfie":"91000000-0000-4000-8000-000000000001/current/selfie.jpg","proof_of_address":"91000000-0000-4000-8000-000000000001/current/proof_of_address.pdf"}',
  '92000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
select public.begin_kyc_review(
  (
    select id
    from public.kyc_applications
    where owner_id = '91000000-0000-4000-8000-000000000001'
  )
);
select public.update_kyc_review_checklist(
  (
    select id
    from public.kyc_applications
    where owner_id = '91000000-0000-4000-8000-000000000001'
  ),
  'compliant',
  'compliant',
  'compliant',
  'compliant',
  'compliant',
  'compliant',
  'Contractual currency verified.'
);
select public.decide_kyc_application(
  (
    select id
    from public.kyc_applications
    where owner_id = '91000000-0000-4000-8000-000000000001'
  ),
  'approved',
  null,
  'Identity confirmed.'
);
reset role;

select is(
  (
    select currency
    from public.financial_positions
    where source_kyc_id = (
      select id
      from public.kyc_applications
      where owner_id = '91000000-0000-4000-8000-000000000001'
    )
  ),
  'USD',
  'KYC approval opens the current account in the immutable base currency'
);

select is(
  (
    select currency
    from public.financial_ledger_entries
    where entry_key = 'kyc-account-opening:' || (
      select id::text
      from public.kyc_applications
      where owner_id = '91000000-0000-4000-8000-000000000001'
    )
  ),
  'USD',
  'the opening ledger entry inherits the contractual account currency'
);

select * from finish();
rollback;
