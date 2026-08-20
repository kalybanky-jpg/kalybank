begin;
select plan(30);

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select has_table('public', 'kyc_drafts', 'KYC drafts are persisted server-side');
select has_table('public', 'kyc_review_checklists', 'the structured KYC checklist exists');
select has_column('public', 'financial_positions', 'source_kyc_id', 'accounts retain their KYC source');
select has_column('public', 'notifications', 'action_path', 'notifications expose a deep link');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('71000000-0000-4000-8000-000000000001', 'kyc-owner@monalyz.test', '{"base_currency":"EUR"}'::jsonb),
  ('71000000-0000-4000-8000-000000000002', 'kyc-selfie-owner@monalyz.test', '{"base_currency":"EUR"}'::jsonb),
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
  '{"id_front":"71000000-0000-4000-8000-000000000001/current/id_front.jpg","proof_of_address":"71000000-0000-4000-8000-000000000001/current/proof_of_address.pdf"}',
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

select is(
  (select selfie_match from public.kyc_review_checklists
   where kyc_id = (
     select id from public.kyc_applications
     where owner_id = '71000000-0000-4000-8000-000000000001'
   )),
  'not_applicable',
  'a review without a submitted selfie starts as not applicable'
);

reset role;
update public.kyc_review_checklists
set selfie_match = 'compliant'
where kyc_id = (
  select id from public.kyc_applications
  where owner_id = '71000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-4000-8000-000000000001',
  true
);

select throws_ok(
  $test$
    select public.decide_kyc_application(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000001'),
      'approved',
      null,
      'État historique incohérent.'
    )
  $test$,
  '23514',
  'INVALID_KYC_SELFIE_REVIEW_STATE',
  'a decision rejects a legacy non-applicable selfie state mismatch'
);

select lives_ok(
  $test$
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
    )
  $test$,
  'an old reviewer client is canonicalized when the selfie is absent'
);

select is(
  (select document_quality from public.kyc_review_checklists),
  'compliant',
  'the structured checklist is stored'
);

select is(
  (select selfie_match from public.kyc_review_checklists
   where kyc_id = (
     select id from public.kyc_applications
     where owner_id = '71000000-0000-4000-8000-000000000001'
   )),
  'not_applicable',
  'an absent selfie remains not applicable after checklist updates'
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

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  true
);

select lives_ok(
  $test$
    select public.submit_kyc_application(
      'Moussa',
      'Ba',
      date '1988-02-02',
      'Dakar',
      'Sénégalaise',
      '{"street":"2 rue Test","postalCode":"10000","city":"Dakar","country":"Sénégal"}',
      'Analyste',
      '1500_3000',
      false,
      false,
      'passport',
      'P654321',
      'Sénégal',
      current_date + 365,
      '{"id_front":"71000000-0000-4000-8000-000000000002/current/id_front.jpg","selfie":"71000000-0000-4000-8000-000000000002/current/selfie.jpg","proof_of_address":"71000000-0000-4000-8000-000000000002/current/proof_of_address.pdf"}',
      '73000000-0000-4000-8000-000000000002'
    )
  $test$,
  'a KYC submission remains compatible with a supplied selfie'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $test$
    select public.begin_kyc_review(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002')
    )
  $test$,
  'a supplied selfie enters the review workflow'
);

select is(
  (select selfie_match from public.kyc_review_checklists
   where kyc_id = (
     select id from public.kyc_applications
     where owner_id = '71000000-0000-4000-8000-000000000002'
   )),
  'pending',
  'a supplied selfie must be reviewed before a decision'
);

select throws_ok(
  $test$
    select public.request_kyc_information(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002'),
      array['selfie']::text[],
      'other',
      'Veuillez fournir un autre selfie.',
      now() + interval '7 days'
    )
  $test$,
  '22023',
  'INVALID_KYC_INFORMATION_REQUEST',
  'a selfie can no longer be requested as additional information'
);

select throws_ok(
  $test$
    select public.request_kyc_information(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002'),
      array['id_front']::text[],
      'selfie_mismatch',
      'Le document obligatoire doit être revu.',
      now() + interval '7 days'
    )
  $test$,
  '22023',
  'INVALID_KYC_INFORMATION_REQUEST',
  'selfie mismatch is not a valid reason for a new information request'
);

select throws_ok(
  $test$
    select public.update_kyc_review_checklist(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002'),
      'compliant',
      'compliant',
      'not_applicable',
      'compliant',
      'compliant',
      'compliant',
      null
    )
  $test$,
  '22023',
  'INVALID_KYC_SELFIE_REVIEW_STATE',
  'a supplied selfie cannot be marked as not applicable'
);

select throws_ok(
  $test$
    select public.decide_kyc_application(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002'),
      'approved',
      null,
      'Revue incomplète.'
    )
  $test$,
  '22023',
  'KYC_CHECKLIST_INCOMPLETE',
  'a supplied selfie cannot remain pending at decision time'
);

select lives_ok(
  $test$
    select public.update_kyc_review_checklist(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002'),
      'compliant',
      'compliant',
      'non_compliant',
      'compliant',
      'compliant',
      'compliant',
      'Le selfie est consultatif.'
    )
  $test$,
  'a supplied selfie can be reviewed as non-compliant'
);

select throws_ok(
  $test$
    select public.decide_kyc_application(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002'),
      'rejected',
      'selfie_mismatch',
      'Le selfie consultatif ne suffit pas.'
    )
  $test$,
  '22023',
  'INVALID_KYC_DECISION_REASON',
  'selfie mismatch is not a valid reason for a new KYC decision'
);

select throws_ok(
  $test$
    select public.decide_kyc_application(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002'),
      'rejected',
      'other',
      'Le selfie consultatif ne suffit pas.'
    )
  $test$,
  '23514',
  'KYC_REJECTION_REQUIRES_MANDATORY_FAILURE',
  'a selfie mismatch alone cannot justify rejection'
);

select lives_ok(
  $test$
    select public.decide_kyc_application(
      (select id from public.kyc_applications
       where owner_id = '71000000-0000-4000-8000-000000000002'),
      'approved',
      null,
      'Les contrôles obligatoires sont conformes.'
    )
  $test$,
  'a selfie mismatch alone does not prevent KYC approval'
);

select is(
  (select status from public.kyc_applications
   where owner_id = '71000000-0000-4000-8000-000000000002'),
  'approved',
  'the consultative selfie file is approved'
);

reset role;

select * from finish();
rollback;
