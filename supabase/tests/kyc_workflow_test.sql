begin;
select plan(14);

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select has_table('public', 'kyc_drafts', 'KYC drafts are persisted server-side');
select has_table('public', 'kyc_review_checklists', 'the structured KYC checklist exists');
select has_column('public', 'financial_positions', 'source_kyc_id', 'accounts retain their KYC source');
select has_column('public', 'notifications', 'action_path', 'notifications expose a deep link');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('71000000-0000-4000-8000-000000000001', 'kyc-owner@monalyz.test', '{"base_currency":"EUR"}'::jsonb),
  ('72000000-0000-4000-8000-000000000001', 'kyc-admin@monalyz.test', '{"base_currency":"EUR"}'::jsonb);

insert into public.staff_members (user_id, role)
values ('72000000-0000-4000-8000-000000000001', 'admin');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  true
);

select public.save_kyc_draft(
  4,
  '{"firstName":"Awa","lastName":"Diallo"}',
  '{}'::jsonb,
  'fr'
);

select is(
  (select current_step from public.kyc_drafts
   where owner_id = '71000000-0000-4000-8000-000000000001'),
  4,
  'the owner can resume the saved draft'
);

select public.submit_kyc_application(
  'Awa',
  'Diallo',
  date '1990-01-01',
  'Dakar',
  'Sénégalaise',
  '{"street":"1 rue Test","postalCode":"10000","city":"Dakar","country":"Sénégal"}',
  'Ingénieure',
  '1500_3000',
  false,
  false,
  'passport',
  'P123456',
  'Sénégal',
  current_date + 365,
  '{"id_front":"owner/current/id_front.jpg","selfie":"owner/current/selfie.jpg","proof_of_address":"owner/current/proof_of_address.pdf"}',
  '73000000-0000-4000-8000-000000000001'
);

select is(
  (select status from public.kyc_applications
   where owner_id = '71000000-0000-4000-8000-000000000001'),
  'submitted',
  'a complete KYC file is submitted'
);

select is(
  (select count(*)::integer from public.kyc_drafts
   where owner_id = '71000000-0000-4000-8000-000000000001'),
  0,
  'submission removes the mutable draft'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-4000-8000-000000000001',
  true
);

select public.begin_kyc_review(
  (select id from public.kyc_applications
   where owner_id = '71000000-0000-4000-8000-000000000001')
);

select is(
  (select status from public.kyc_applications
   where owner_id = '71000000-0000-4000-8000-000000000001'),
  'under_review',
  'starting the examination explicitly enters under_review'
);

select public.update_kyc_review_checklist(
  (select id from public.kyc_applications
   where owner_id = '71000000-0000-4000-8000-000000000001'),
  'compliant',
  'compliant',
  'compliant',
  'compliant',
  'compliant',
  'compliant',
  'Contrôle humain terminé.'
);

select is(
  (select document_quality from public.kyc_review_checklists),
  'compliant',
  'the structured checklist is stored'
);

select public.decide_kyc_application(
  (select id from public.kyc_applications
   where owner_id = '71000000-0000-4000-8000-000000000001'),
  'approved',
  null,
  'Identité confirmée.'
);

select is(
  (select status from public.kyc_applications
   where owner_id = '71000000-0000-4000-8000-000000000001'),
  'approved',
  'the compliant file is approved'
);

select is(
  (select count(*)::integer from public.financial_positions
   where source_kyc_id = (
     select id from public.kyc_applications
     where owner_id = '71000000-0000-4000-8000-000000000001'
   )),
  1,
  'approval creates exactly one internal account'
);

select ok(
  (
    select account_status = 'active'
      and account_number ~ '^[0-9]{10}$'
      and iban is null
      and bic is null
      and branch_name is null
      and branch_code is null
    from public.financial_positions
    where source_kyc_id = (
      select id from public.kyc_applications
      where owner_id = '71000000-0000-4000-8000-000000000001'
    )
  ),
  'the account is active with only its internal number'
);

select ok(
  (
    select count(*) = 1
      and min(amount_minor) = 0
      and min(balance_after_minor) = 0
    from public.financial_ledger_entries
    where account_id = (
      select id from public.financial_positions
      where source_kyc_id = (
        select id from public.kyc_applications
        where owner_id = '71000000-0000-4000-8000-000000000001'
      )
    )
  ),
  'account opening records one zero-balance ledger entry'
);

reset role;

select is(
  (
    select array_agg(template_key order by template_key)
    from public.transactional_email_outbox
    where entity_type = 'kyc'
  ),
  array['kyc_approved', 'kyc_submitted']::text[],
  'submission and approval enqueue localized actionable emails'
);

select * from finish();
rollback;
