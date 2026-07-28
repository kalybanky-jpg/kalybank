begin;
select plan(19);

select has_table('public', 'transfer_intents', 'transfer intent table exists');
select has_table('public', 'external_transfer_executions', 'external evidence table exists');
select has_table('public', 'audit_events', 'append-only audit table exists');
select col_type_is(
  'public',
  'financial_positions',
  'amount_minor',
  'bigint',
  'money is stored in exact minor units'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.transfer_intents'::regclass),
  'RLS is enabled on transfer intents'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.submit_transfer_intent(uuid,text,text,jsonb,text,bigint,text,bigint,text,numeric,timestamptz,text,uuid)',
    'execute'
  ),
  'anonymous users cannot submit transfer intents'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.submit_transfer_intent(uuid,text,text,jsonb,text,bigint,text,bigint,text,numeric,timestamptz,text,uuid)',
    'execute'
  ),
  'authenticated users can call the guarded submit function'
);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'owner@kaly.test'),
  ('20000000-0000-0000-0000-000000000001', 'operator@kaly.test'),
  ('30000000-0000-0000-0000-000000000001', 'supervisor@kaly.test');

insert into public.staff_members (user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', 'supervisor'),
  ('30000000-0000-0000-0000-000000000001', 'supervisor');

insert into public.financial_positions (
  id,
  owner_id,
  label,
  currency,
  amount_minor,
  as_of
)
values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Position déclarée test',
  'EUR',
  100000,
  now()
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
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
      'Test',
      '50000000-0000-0000-0000-000000000001'
    )
  $$,
  'owner can submit one idempotent instruction'
);

select is(
  (select amount_minor from public.financial_positions where id = '40000000-0000-0000-0000-000000000001'),
  100000::bigint,
  'submission does not debit the internal position'
);
select is(
  (select reserved_minor from public.financial_positions where id = '40000000-0000-0000-0000-000000000001'),
  2500::bigint,
  'submission only creates an internal reservation'
);

-- The same idempotency key must not reserve the amount twice.
do $$
begin
  perform public.submit_transfer_intent(
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
    'Test',
    '50000000-0000-0000-0000-000000000001'
  );
end;
$$;
select is(
  (select reserved_minor from public.financial_positions where id = '40000000-0000-0000-0000-000000000001'),
  2500::bigint,
  'idempotent retry does not duplicate the reservation'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);

do $$
declare
  transfer_id uuid := (
    select id
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000001'
  );
begin
  perform public.review_transfer_check(transfer_id, 'dual_review', 'completed', 'Revue 1');
  perform public.review_transfer_check(transfer_id, 'escalation', 'completed', 'Revue 2');
  perform public.review_transfer_check(transfer_id, 'compliance', 'completed', 'Revue 3');
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);

do $$
begin
  perform public.review_transfer_check(
    (
      select id
      from public.transfer_intents
      where idempotency_key = '50000000-0000-0000-0000-000000000001'
    ),
    'final_authorization',
    'completed',
    'Revue finale indépendante'
  );
end;
$$;

select is(
  (
    select status
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000001'
  ),
  'approved_for_external_execution',
  'all reviews only authorize external execution'
);
select is(
  (select amount_minor from public.financial_positions where id = '40000000-0000-0000-0000-000000000001'),
  100000::bigint,
  'compliance completion still does not debit the position'
);

do $$
begin
  perform public.transition_transfer(
    (
      select id
      from public.transfer_intents
      where idempotency_key = '50000000-0000-0000-0000-000000000001'
    ),
    'record_external_execution',
    'Exécuté dans le système externe de test',
    'EXT-TEST-001',
    'transfers/test/proof.pdf',
    now()
  );
end;
$$;
select is(
  (select amount_minor from public.financial_positions where id = '40000000-0000-0000-0000-000000000001'),
  100000::bigint,
  'recording external execution still does not debit the position'
);

select throws_ok(
  $$
    select public.transition_transfer(
      (select id from public.transfer_intents where idempotency_key = '50000000-0000-0000-0000-000000000001'),
      'confirm_external_settlement',
      'Tentative par le même opérateur'
    )
  $$,
  '42501',
  'SECOND_STAFF_MEMBER_REQUIRED',
  'the staff member who recorded execution cannot self-confirm settlement'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
    select public.transition_transfer(
      (select id from public.transfer_intents where idempotency_key = '50000000-0000-0000-0000-000000000001'),
      'confirm_external_settlement',
      'Preuve rapprochée par un second acteur'
    )
  $$,
  'a distinct supervisor can confirm settlement'
);
select is(
  (select amount_minor from public.financial_positions where id = '40000000-0000-0000-0000-000000000001'),
  97500::bigint,
  'position changes only after second-actor settlement confirmation'
);
select is(
  (select reserved_minor from public.financial_positions where id = '40000000-0000-0000-0000-000000000001'),
  0::bigint,
  'reservation is released atomically on confirmation'
);
select is(
  (
    select status
    from public.transfer_intents
    where idempotency_key = '50000000-0000-0000-0000-000000000001'
  ),
  'external_settlement_confirmed',
  'workflow reaches the confirmed terminal state'
);

select * from finish();
rollback;
