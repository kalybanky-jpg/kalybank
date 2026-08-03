begin;
select plan(9);

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select has_function(
  'public',
  'claim_transactional_emails_for_recipient',
  array['uuid', 'integer'],
  'the recipient-scoped email claim RPC exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.claim_transactional_emails_for_recipient(uuid,integer)',
    'execute'
  ),
  'anonymous sessions cannot claim transactional emails'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_transactional_emails_for_recipient(uuid,integer)',
    'execute'
  ),
  'authenticated sessions cannot call the worker claim RPC directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_transactional_emails_for_recipient(uuid,integer)',
    'execute'
  ),
  'the service worker can claim recipient-scoped emails'
);

insert into auth.users (id, email)
values
  ('81000000-0000-4000-8000-000000000001', 'email-one@monalyz.test'),
  ('82000000-0000-4000-8000-000000000001', 'email-two@monalyz.test');

insert into public.transactional_email_outbox (
  event_key,
  recipient_id,
  recipient_email,
  template_key,
  entity_type,
  entity_id
)
values
  (
    'test:scoped-email:first',
    '81000000-0000-4000-8000-000000000001',
    'email-one@monalyz.test',
    'transfer_submitted',
    'transfer',
    '83000000-0000-4000-8000-000000000001'
  ),
  (
    'test:scoped-email:second',
    '82000000-0000-4000-8000-000000000001',
    'email-two@monalyz.test',
    'transfer_submitted',
    'transfer',
    '84000000-0000-4000-8000-000000000001'
  );

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  (
    select count(*)::integer
    from public.claim_transactional_emails_for_recipient(
      '81000000-0000-4000-8000-000000000001',
      10
    )
  ),
  1,
  'a scoped claim returns only one recipient batch'
);
select is(
  (
    select status
    from public.transactional_email_outbox
    where recipient_id = '81000000-0000-4000-8000-000000000001'
  ),
  'sending',
  'the selected recipient job is atomically marked as sending'
);
select is(
  (
    select status
    from public.transactional_email_outbox
    where recipient_id = '82000000-0000-4000-8000-000000000001'
  ),
  'pending',
  'a scoped claim leaves other recipients untouched'
);

select public.complete_transactional_email(
  id,
  claim_token,
  false,
  null,
  'provider temporarily unavailable'
)
from public.transactional_email_outbox
where recipient_id = '81000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.claim_transactional_emails_for_recipient(
      '81000000-0000-4000-8000-000000000001',
      10
    )
  ),
  0,
  'a failed email is not retried immediately'
);

reset role;
update public.transactional_email_outbox
set claimed_at = now() - interval '2 minutes'
where recipient_id = '81000000-0000-4000-8000-000000000001';
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  (
    select count(*)::integer
    from public.claim_transactional_emails_for_recipient(
      '81000000-0000-4000-8000-000000000001',
      10
    )
  ),
  1,
  'a failed email becomes claimable after its backoff window'
);

select * from finish();
rollback;
