begin;
select plan(145);

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

-- Synthetic identities. The auth trigger creates their public profiles.
insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'owner@monalyz.test'),
  ('10000000-0000-0000-0000-000000000002', 'other-owner@monalyz.test'),
  ('20000000-0000-0000-0000-000000000001', 'reviewer@monalyz.test'),
  ('30000000-0000-0000-0000-000000000001', 'branch-manager@monalyz.test');

insert into public.staff_members (user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', 'reviewer'),
  ('30000000-0000-0000-0000-000000000001', 'admin');

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
select lives_ok(
  $test$
    select public.submit_loan_application(
      15000,
      'EUR',
      24,
      700,
      0.035,
      'Projet test',
      '["loans/test/income.pdf"]'::jsonb,
      '60000000-0000-0000-0000-000000000001'
    )
  $test$,
  'the owner can submit a loan application'
);

reset role;
-- 46
select is(
  (
    select status
    from public.loan_applications
    where idempotency_key = '60000000-0000-0000-0000-000000000001'
  ),
  'submitted',
  'a new loan starts submitted'
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
  112500::bigint,
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
  112500::bigint,
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
      7000,
      'EUR',
      12,
      620,
      0.035,
      'Projet refusé',
      '["loans/test/rejected.pdf"]'::jsonb,
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
  112500::bigint,
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
    '{"preferred_language":"de"}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'invalid-language-owner@monalyz.test',
    '{"preferred_language":"it"}'::jsonb
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
    set preferred_language = 'it'
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

insert into auth.users (id, email, raw_app_meta_data)
values
  (
    'd2000000-0000-4000-8000-000000000001',
    'admin.demo@monalyz.com',
    '{"monalyz_demo":true,"demo_role":"admin"}'::jsonb
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    'client.demo@monalyz.com',
    '{"monalyz_demo":true,"demo_role":"client"}'::jsonb
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
      and amount_minor = 15000
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

select * from finish();
rollback;
