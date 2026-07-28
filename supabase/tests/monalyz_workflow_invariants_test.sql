begin;
select plan(79);

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
    'public.branch_manager_approve_transfer(uuid,text)',
    'execute'
  ),
  'authenticated sessions can reach the guarded branch-manager transfer RPC'
);
-- 9
select ok(
  not has_function_privilege(
    'authenticated',
    'public.review_transfer_check(uuid,text,text,text)',
    'execute'
  ),
  'the legacy multi-review transfer RPC is no longer exposed to authenticated clients'
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
  account_type
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Compte courant EUR',
    'EUR',
    100000,
    now(),
    'current'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Épargne EUR',
    'EUR',
    20000,
    now(),
    'savings'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Compte courant USD',
    'USD',
    30000,
    now(),
    'current'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000002',
    'Compte courant autre client',
    'EUR',
    50000,
    now(),
    'current'
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
      now(),
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
      now(),
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
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
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
    select public.branch_manager_approve_transfer(
      (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000001'
      ),
      'Contrôles internes terminés'
    )
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
  'approved_for_external_execution',
  'branch-manager approval authorizes external execution'
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
  100000::bigint,
  'approval does not debit the position'
);
-- 28
select is(
  (
    select reserved_minor
    from public.financial_positions
    where id = '40000000-0000-0000-0000-000000000001'
  ),
  2500::bigint,
  'approval keeps the transfer amount reserved'
);
-- 29
select is(
  (
    select count(*)
    from public.transactional_email_outbox
    where template_key = 'transfer_approved'
      and entity_id = (
        select id
        from public.transfer_intents
        where idempotency_key = '50000000-0000-0000-0000-000000000001'
      )
  ),
  1::bigint,
  'transfer approval enqueues one approval email'
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
  'BRANCH_MANAGER_PERMISSION_REQUIRED',
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
  'approved_for_external_execution',
  'a forbidden finalization leaves the transfer approved'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
-- 32
select lives_ok(
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
  'the branch manager finalizes the externally completed transfer'
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
      now(),
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
  10::bigint,
  'the two transfer and two loan scenarios enqueue ten relevant emails'
);
-- 76
select is(
  (select count(distinct event_key) from public.transactional_email_outbox),
  10::bigint,
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
    'transfer_approved',
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

select * from finish();
rollback;
