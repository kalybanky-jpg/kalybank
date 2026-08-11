begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create temporary table purge_test_state (
  label text primary key,
  challenge_id uuid not null,
  idempotency_key uuid not null,
  preview jsonb not null,
  work jsonb,
  retry_work jsonb,
  fingerprint text
);

create function pg_temp.drive_client_purge_storage(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  work jsonb;
  kind text;
begin
  for attempt in 1..200 loop
    work := public.admin_claim_client_purge_storage_work(
      p_actor_id, p_target_user_id, p_challenge_id, 1000
    );
    kind := work ->> 'kind';
    if kind = 'complete' then
      return work;
    elsif kind = 'database' then
      continue;
    elsif kind = 'scan' then
      perform public.admin_ack_client_purge_storage_work(
        p_actor_id, p_target_user_id, p_challenge_id,
        (work ->> 'claimToken')::uuid, 'scan',
        '{"objects":[],"prefixes":[],"returnedCount":0}'::jsonb
      );
    elsif kind = 'delete' then
      perform public.admin_ack_client_purge_storage_work(
        p_actor_id, p_target_user_id, p_challenge_id,
        (work ->> 'claimToken')::uuid, 'delete', '{"removed":true}'::jsonb
      );
    elsif kind = 'verify_manifest' then
      perform public.admin_ack_client_purge_storage_work(
        p_actor_id, p_target_user_id, p_challenge_id,
        (work ->> 'claimToken')::uuid, 'verify_manifest', '{"absent":true}'::jsonb
      );
    elsif kind = 'verify_prefix' then
      perform public.admin_ack_client_purge_storage_work(
        p_actor_id, p_target_user_id, p_challenge_id,
        (work ->> 'claimToken')::uuid, 'verify_prefix', '{"empty":true}'::jsonb
      );
    else
      raise exception 'UNEXPECTED_STORAGE_WORK:%', work;
    end if;
  end loop;
  raise exception 'STORAGE_WORK_LOOP_LIMIT';
end;
$$;

create function pg_temp.drive_client_purge_to_delete(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid
)
returns void
language plpgsql
as $$
declare
  work jsonb;
  kind text;
begin
  for attempt in 1..100 loop
    if (
      select storage_phase = 'delete'
      from private.client_purge_operations
      where challenge_id = p_challenge_id
    ) then
      return;
    end if;
    work := public.admin_claim_client_purge_storage_work(
      p_actor_id, p_target_user_id, p_challenge_id, 1000
    );
    kind := work ->> 'kind';
    if kind = 'scan' then
      perform public.admin_ack_client_purge_storage_work(
        p_actor_id, p_target_user_id, p_challenge_id,
        (work ->> 'claimToken')::uuid, 'scan',
        '{"objects":[],"prefixes":[],"returnedCount":0}'::jsonb
      );
    elsif kind <> 'database' then
      raise exception 'UNEXPECTED_PRE_DELETE_WORK:%', work;
    end if;
  end loop;
  raise exception 'PRE_DELETE_LOOP_LIMIT';
end;
$$;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('91000000-0000-4000-8000-000000000001', 'purge-admin@monalyz.test', '{"base_currency":"EUR","preferred_language":"fr"}'::jsonb),
  ('91000000-0000-4000-8000-000000000002', 'purge-client@monalyz.test', '{"base_currency":"EUR","preferred_language":"fr"}'::jsonb),
  ('91000000-0000-4000-8000-000000000003', 'purge-staff@monalyz.test', '{"base_currency":"EUR","preferred_language":"fr"}'::jsonb),
  ('91000000-0000-4000-8000-000000000004', 'purge-email-before@monalyz.test', '{"base_currency":"EUR","preferred_language":"fr"}'::jsonb),
  ('91000000-0000-4000-8000-000000000005', 'purge-client-b@monalyz.test', '{"base_currency":"EUR","preferred_language":"fr"}'::jsonb),
  ('91000000-0000-4000-8000-000000000006', 'purge-orphan@monalyz.test', '{"base_currency":"EUR","preferred_language":"fr"}'::jsonb),
  ('91000000-0000-4000-8000-000000000007', 'purge-admin-2@monalyz.test', '{"base_currency":"EUR","preferred_language":"fr"}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (user_id, email, display_name)
values
  ('91000000-0000-4000-8000-000000000001', 'purge-admin@monalyz.test', 'Purge Admin'),
  ('91000000-0000-4000-8000-000000000002', 'purge-client@monalyz.test', 'Purge Client'),
  ('91000000-0000-4000-8000-000000000003', 'purge-staff@monalyz.test', 'Purge Staff'),
  ('91000000-0000-4000-8000-000000000004', 'purge-email-before@monalyz.test', 'Changed Email'),
  ('91000000-0000-4000-8000-000000000005', 'purge-client-b@monalyz.test', 'Purge Client B'),
  ('91000000-0000-4000-8000-000000000007', 'purge-admin-2@monalyz.test', 'Purge Admin 2')
on conflict (user_id) do update
set email = excluded.email, display_name = excluded.display_name;

-- handle_new_user creates every profile; remove this one deliberately to cover
-- an Auth-only account that still has to remain visible and purgeable.
delete from public.profiles
where user_id = '91000000-0000-4000-8000-000000000006';

insert into public.staff_members (user_id, role, active)
values
  ('91000000-0000-4000-8000-000000000001', 'admin', true),
  ('91000000-0000-4000-8000-000000000003', 'reviewer', true),
  ('91000000-0000-4000-8000-000000000007', 'admin', true)
on conflict (user_id) do update set role = excluded.role, active = excluded.active;

insert into public.kyc_drafts (
  owner_id, current_step, payload, document_object_paths, preferred_language
) values (
  '91000000-0000-4000-8000-000000000002', 2, '{"draft":true}',
  '{"id_front":"91000000-0000-4000-8000-000000000002/id-front.pdf"}', 'fr'
);

insert into public.kyc_applications (
  id, owner_id, idempotency_key, first_name, last_name, date_of_birth,
  place_of_birth, nationality, address, occupation, income_range, fatca, pep,
  document_object_paths
) values (
  '93000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000002',
  'Purge', 'Client', '1990-01-01', 'Paris', 'FR', '{}', 'Test', 'Test', false,
  false, '{"id_back":"91000000-0000-4000-8000-000000000002/id-back.pdf"}'
);

insert into public.kyc_events (kyc_id, actor_id, event_type)
values (
  '93000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001', 'test_seed'
);

insert into public.financial_positions (id, owner_id, label, currency, amount_minor)
values
  (
    '94000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002', 'Purge account', 'EUR', 1000
  ),
  (
    '94000000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000005', 'Foreign account', 'EUR', 2000
  );

insert into public.financial_ledger_entries (
  id, account_id, owner_id, sequence_no, entry_key, entry_kind, amount_minor,
  currency, balance_before_minor, balance_after_minor, value_date, description
) values (
  '94000000-0000-4000-8000-000000000002',
  '94000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', 1, 'purge-test-opening',
  'account_opening', 1000, 'EUR', 0, 1000, statement_timestamp(),
  'Purge test opening'
);

insert into public.loan_applications (
  id, owner_id, idempotency_key, reference, requested_amount_minor, currency,
  duration_months, motive, motive_code, document_object_paths
) values (
  '95000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '95000000-0000-4000-8000-000000000002', 'PURGE-LOAN-1', 10000, 'EUR', 12,
  'Personal', 'personal',
  '["91000000-0000-4000-8000-000000000002/loan-proof.pdf"]'
), (
  '95000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000005',
  '95000000-0000-4000-8000-000000000004', 'PURGE-LOAN-FOREIGN', 20000,
  'EUR', 24, 'Foreign', 'personal', '[]'
);

insert into public.loan_events (loan_id, actor_id, event_type)
values (
  '95000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001', 'purge_reparent_seed'
);

insert into public.loan_review_checks (loan_id, check_kind)
values ('95000000-0000-4000-8000-000000000001', 'dual_review');

insert into public.transfer_intents (
  id, owner_id, source_position_id, idempotency_key, recipient_name,
  recipient_account_masked, transfer_type, amount_minor, currency,
  target_amount_minor, target_currency, quote_rate, quote_as_of, status
) values
  (
    '96000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000002',
    'Legacy recipient', '****1234', 'eurozone', 100, 'EUR', 100, 'EUR', 1,
    statement_timestamp(), 'external_execution_recorded'
  ),
  (
    '96000000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000004',
    'Preview move', '****2345', 'eurozone', 110, 'EUR', 110, 'EUR', 1,
    statement_timestamp(), 'external_execution_recorded'
  ),
  (
    '96000000-0000-4000-8000-000000000005',
    '91000000-0000-4000-8000-000000000005',
    '94000000-0000-4000-8000-000000000003',
    '96000000-0000-4000-8000-000000000006',
    'Foreign recipient', '****3456', 'eurozone', 120, 'EUR', 120, 'EUR', 1,
    statement_timestamp(), 'external_execution_recorded'
  );

alter table public.external_transfer_executions
disable trigger external_transfer_evidence_enforce_path_owner;
insert into public.external_transfer_executions (
  transfer_id, external_reference, evidence_object_path, executed_by, executed_at
) values (
  '96000000-0000-4000-8000-000000000001', 'PURGE-LEGACY-EXTERNAL',
  '91000000-0000-4000-8000-000000000001/legacy' || pg_catalog.chr(92) || 'preuve 🧾.pdf ',
  '91000000-0000-4000-8000-000000000001', statement_timestamp()
), (
  '96000000-0000-4000-8000-000000000003', 'PURGE-PREVIEW-MOVED',
  '91000000-0000-4000-8000-000000000001/preview-stale.pdf',
  '91000000-0000-4000-8000-000000000001', statement_timestamp()
);
alter table public.external_transfer_executions
enable trigger external_transfer_evidence_enforce_path_owner;

insert into public.external_loan_fundings (
  loan_id, external_reference, evidence_object_path, executed_by, executed_at
) values (
  '95000000-0000-4000-8000-000000000001', 'PURGE-QUARANTINE-SEED',
  '91000000-0000-4000-8000-000000000001/quarantine-evidence.pdf',
  '91000000-0000-4000-8000-000000000001', statement_timestamp()
);

insert into public.notifications (recipient_id, title, message, notification_type)
values ('91000000-0000-4000-8000-000000000002', 'Test', 'Purge me', 'info');

insert into public.transactional_email_outbox (
  event_key, recipient_id, recipient_email, template_key, entity_type,
  entity_id, payload
) values (
  'purge-test-email', '91000000-0000-4000-8000-000000000002',
  'purge-client@monalyz.test', 'loan_submitted', 'loan',
  '95000000-0000-4000-8000-000000000001', '{}'
);

insert into public.push_subscriptions (
  user_id, endpoint, endpoint_hash, p256dh, auth_key
) values (
  '91000000-0000-4000-8000-000000000002',
  'https://push.monalyz.test/purge-client', repeat('1', 64), repeat('A', 40),
  repeat('B', 10)
);

insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
values
  (
    '91000000-0000-4000-8000-000000000002', 'purge_exact_audit', 'kyc',
    '93000000-0000-4000-8000-000000000001',
    '{"email":"purge-client@monalyz.test"}'
  ),
  (
    '91000000-0000-4000-8000-000000000001', 'preserve_joann_audit', 'integration',
    '97000000-0000-4000-8000-000000000001',
    '{"email":"joann-purge-client@monalyz.test"}'
  ),
  (
    '91000000-0000-4000-8000-000000000001', 'purge_reassignment_audit', 'kyc_application',
    '93000000-0000-4000-8000-000000000001', '{}'
  ),
  (
    '91000000-0000-4000-8000-000000000001', 'purge_support_alias_audit', 'integration',
    '97000000-0000-4000-8000-000000000002',
    '{"email":"old-purge-alias@monalyz.test"}'
  ),
  (
    '91000000-0000-4000-8000-000000000001', 'preserve_shared_alias_audit', 'integration',
    '97000000-0000-4000-8000-000000000003',
    '{"email":"shared-history@monalyz.test"}'
  ),
  (
    '91000000-0000-4000-8000-000000000001',
    'preserve_preview_moved_entity_audit', 'support_transcript',
    '98000000-0000-4000-8000-000000000001', '{}'
  ),
  (
    '91000000-0000-4000-8000-000000000001',
    'preserve_preview_reassigned_alias_audit', 'integration',
    '97000000-0000-4000-8000-000000000004',
    '{"email":"preview-reassigned@monalyz.test"}'
  ),
  (
    '91000000-0000-4000-8000-000000000001',
    'preserve_cross_type_collision_audit', 'brand_settings',
    '95000000-0000-4000-8000-000000000001', '{}'
  ),
  (
    '91000000-0000-4000-8000-000000000001',
    'preserve_direct_user_uuid_wrong_type_audit', 'brand_settings',
    '91000000-0000-4000-8000-000000000002', '{}'
  );

insert into public.support_transcripts (
  user_id, tawk_event_id, tawk_property_id, tawk_chat_id, identity_status,
  event_at, payload, raw_body, raw_body_sha256
) values (
  '91000000-0000-4000-8000-000000000002', 'purge-event', 'purge-property',
  'purge-chat', 'resolved', statement_timestamp(), '{}', '{}', repeat('2', 64)
);

insert into public.support_transcripts (
  id, user_id, tawk_event_id, tawk_property_id, tawk_chat_id, identity_status,
  event_at, payload, raw_body, raw_body_sha256
) values (
  '98000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', 'purge-preview-move',
  'purge-property', 'purge-preview-move-chat', 'resolved',
  statement_timestamp(), '{}', '{}', repeat('4', 64)
);

insert into public.support_user_identities (
  user_id, normalized_email, valid_from, valid_to
) values (
  '91000000-0000-4000-8000-000000000002', 'shared-history@monalyz.test',
  statement_timestamp() - interval '2 days', statement_timestamp() - interval '1 day'
), (
  '91000000-0000-4000-8000-000000000002', 'old-purge-alias@monalyz.test',
  statement_timestamp() - interval '4 days', statement_timestamp() - interval '3 days'
), (
  '91000000-0000-4000-8000-000000000002', 'preview-reassigned@monalyz.test',
  statement_timestamp() - interval '6 days', statement_timestamp() - interval '5 days'
);
update auth.users set email = 'shared-history@monalyz.test'
where id = '91000000-0000-4000-8000-000000000005';
insert into public.support_transcripts (
  tawk_event_id, tawk_property_id, tawk_chat_id, visitor_email_normalized,
  identity_status, event_at, payload, raw_body, raw_body_sha256, email_status
) values (
  'purge-shared-event', 'purge-property', 'purge-shared-chat',
  'shared-history@monalyz.test', 'not_found', statement_timestamp(), '{}', '{}',
  repeat('3', 64), 'skipped'
), (
  'purge-preview-alias-event', 'purge-property', 'purge-preview-alias-chat',
  'preview-reassigned@monalyz.test', 'not_found', statement_timestamp(), '{}',
  '{}', repeat('5', 64), 'skipped'
);

select ok(to_regclass('private.client_purge_operations') is not null, 'private purge state exists');
select ok(to_regclass('private.client_purge_storage_manifest') is not null, 'normalized Storage manifest exists');
select ok(to_regclass('private.client_purge_storage_scan_queue') is not null, 'durable Storage scan queue exists');
select ok(to_regclass('private.client_purge_entity_manifest') is not null, 'entity verification manifest exists');
select col_type_is('private', 'client_purge_entity_manifest', 'entity_id', 'text', 'mixed UUID/bigint entity keys use a lossless text representation');
select col_type_is('private', 'client_purge_operations', 'scope_digest', 'text', 'preview scope digest is stored only in private operation state');
select has_index('private', 'client_purge_storage_manifest', 'client_purge_storage_manifest_work_idx', 'Storage work lookup is indexed by status and key');
select has_index('private', 'client_purge_storage_manifest', 'client_purge_storage_manifest_expired_claim_idx', 'expired Storage claims are indexed');
select has_index('private', 'client_purge_storage_manifest', 'client_purge_storage_manifest_relational_path_idx', 'relational path quarantine lookup is indexed');
select is(
  private.uuid_or_null('018f06f0-7b5a-7cc0-8000-000000000001'),
  '018f06f0-7b5a-7cc0-8000-000000000001'::uuid,
  'UUIDv7 metadata identifiers are recognized exactly'
);
select ok(to_regprocedure('public.admin_store_client_purge_manifest(uuid,uuid,uuid,jsonb)') is null, 'obsolete manifest writer is absent');
select ok(to_regprocedure('public.admin_client_purge_storage_paths(uuid,uuid,uuid,text,integer,text,text)') is null, 'obsolete path reader is absent');
select ok(not has_table_privilege('service_role', 'private.client_purge_operations', 'SELECT'), 'service role cannot read private operation rows directly');
select ok(not has_table_privilege('service_role', 'private.client_purge_storage_manifest', 'UPDATE'), 'service role cannot mutate private manifest directly');
select ok(has_function_privilege('service_role', 'public.admin_claim_client_purge_storage_work(uuid,uuid,uuid,integer)', 'EXECUTE'), 'service role uses the bounded claim RPC');
select ok(not has_function_privilege('authenticated', 'public.admin_claim_client_purge_storage_work(uuid,uuid,uuid,integer)', 'EXECUTE'), 'authenticated users cannot claim purge work');
select ok(not has_function_privilege('service_role', 'private.client_purge_scope_digest(uuid,uuid,jsonb)', 'EXECUTE'), 'scope digest helper has no direct service-role privilege');
select ok(not has_function_privilege('service_role', 'private.client_purge_storage_lock_key(text,text)', 'EXECUTE'), 'opaque path lock helper has no direct service-role privilege');
select ok(has_table_privilege('service_role', 'public.profiles', 'SELECT'), 'server-only workflows can read profiles');
select ok(has_table_privilege('service_role', 'public.staff_members', 'SELECT'), 'purge authorization can classify active and inactive staff');
select ok(not has_table_privilege('service_role', 'public.profiles', 'INSERT'), 'service role cannot insert profiles directly');
select ok(not has_table_privilege('service_role', 'public.profiles', 'UPDATE'), 'service role cannot update profiles directly');
select ok(not has_table_privilege('service_role', 'public.profiles', 'DELETE'), 'service role cannot delete profiles directly');
select ok(not has_table_privilege('service_role', 'public.staff_members', 'INSERT'), 'service role cannot insert staff directly');
select ok(not has_table_privilege('service_role', 'public.staff_members', 'UPDATE'), 'service role cannot update staff directly');
select ok(not has_table_privilege('service_role', 'public.staff_members', 'DELETE'), 'service role cannot delete staff directly');
select has_trigger('auth', 'users', 'auth_users_reject_reserved_purge_email_insert', 'Auth inserts reserve consumed purge e-mails');
select has_trigger('auth', 'users', 'auth_users_reject_reserved_purge_email_update', 'Auth e-mail updates reserve consumed purge e-mails');

select throws_ok(
  $$update public.kyc_drafts
    set document_object_paths = '{"foreign":"91000000-0000-4000-8000-000000000005/file.pdf"}'
    where owner_id = '91000000-0000-4000-8000-000000000002'$$,
  '23514', 'DOCUMENT_PATH_OWNER_MISMATCH',
  'future cross-tenant KYC document paths are rejected'
);
alter table public.kyc_drafts disable trigger kyc_drafts_enforce_document_path_owner;
update public.kyc_drafts
set document_object_paths = '{"legacy_foreign":"91000000-0000-4000-8000-000000000005/file.pdf"}'
where owner_id = '91000000-0000-4000-8000-000000000002';
alter table public.kyc_drafts enable trigger kyc_drafts_enforce_document_path_owner;
select is(
  (
    select count(*)::integer
    from private.client_purge_storage_references('91000000-0000-4000-8000-000000000002')
    where object_path = '91000000-0000-4000-8000-000000000005/file.pdf'
      and ownership_valid is false
  ),
  1,
  'a legacy foreign reference is reported unsafe rather than deleted'
);
select is(
  (
    select count(*)::integer
    from public.admin_list_client_purge_candidates(
      '91000000-0000-4000-8000-000000000001', 'purge-orphan', 10, 0
    )
    where user_id = '91000000-0000-4000-8000-000000000006'
      and access_status = 'missing'
  ),
  1,
  'an Auth user without a profile remains a purge candidate'
);
select throws_ok(
  $$select public.admin_prepare_client_purge(
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001', repeat('1',64),
    encode(extensions.digest(convert_to('purge-admin@monalyz.test','UTF8'),'sha256'),'hex'),
    'purge-admin@monalyz.test', '92000000-0000-4000-8000-000000000011')$$,
  '42501', 'SELF_PURGE_FORBIDDEN',
  'an administrator cannot purge their own account'
);
select throws_ok(
  $$select public.admin_prepare_client_purge(
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000003', repeat('3',64),
    encode(extensions.digest(convert_to('purge-staff@monalyz.test','UTF8'),'sha256'),'hex'),
    'purge-staff@monalyz.test', '92000000-0000-4000-8000-000000000013')$$,
  '42501', 'STAFF_PURGE_FORBIDDEN',
  'every staff account is excluded from purge targets'
);

with prepared as (
  select public.admin_prepare_client_purge(
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004', repeat('4', 64),
    encode(extensions.digest(convert_to('purge-email-before@monalyz.test', 'UTF8'), 'sha256'), 'hex'),
    'purge-email-before@monalyz.test',
    '92000000-0000-4000-8000-000000000004'
  ) as preview
)
insert into purge_test_state (label, challenge_id, idempotency_key, preview)
select 'changed-email', (preview ->> 'challengeId')::uuid,
  '92000000-0000-4000-8000-000000000004', preview
from prepared;
select pg_temp.drive_client_purge_storage(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000004', challenge_id
)
from purge_test_state where label = 'changed-email';
update auth.users set email = 'purge-email-after@monalyz.test'
where id = '91000000-0000-4000-8000-000000000004';
select throws_ok(
  format(
    $$select public.admin_begin_client_purge(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000004', '%s', repeat('4',64),
      '%s', '92000000-0000-4000-8000-000000000004')$$,
    challenge_id,
    encode(extensions.digest(convert_to('purge-email-before@monalyz.test', 'UTF8'), 'sha256'), 'hex')
  ),
  '55000', 'PURGE_TARGET_EMAIL_CHANGED',
  'begin revalidates the current Auth e-mail under lock'
)
from purge_test_state where label = 'changed-email';
select is(
  (
    public.admin_get_client_purge_preview(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000004'
    ) ->> 'reason'
  ),
  'email_changed',
  'preview recovery invalidates an e-mail snapshot that changed'
);
select is(
  (select count(*)::integer from private.client_purge_operations
   where target_user_id = '91000000-0000-4000-8000-000000000004'),
  0,
  'invalid preview state is removed atomically'
);

with prepared as (
  select public.admin_prepare_client_purge(
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002', repeat('a', 64),
    encode(extensions.digest(convert_to('purge-client@monalyz.test', 'UTF8'), 'sha256'), 'hex'),
    'purge-client@monalyz.test',
    '92000000-0000-4000-8000-000000000001'
  ) as preview
)
insert into purge_test_state (label, challenge_id, idempotency_key, preview)
select 'main', (preview ->> 'challengeId')::uuid,
  '92000000-0000-4000-8000-000000000001', preview
from prepared;
select is((select preview ->> 'inventoryComplete' from purge_test_state where label = 'main'), 'false', 'preview starts with a bounded unfinished inventory');
select throws_ok(
  format(
    $$select public.admin_begin_client_purge(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', '%s', repeat('a',64),
      '%s', '92000000-0000-4000-8000-000000000001')$$,
    challenge_id,
    encode(extensions.digest(convert_to('purge-client@monalyz.test', 'UTF8'), 'sha256'), 'hex')
  ),
  '55000', 'PURGE_PREVIEW_INCOMPLETE',
  'execution cannot consume an incomplete preview inventory'
)
from purge_test_state where label = 'main';
select pg_temp.drive_client_purge_storage(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', challenge_id
)
from purge_test_state where label = 'main';
update purge_test_state state
set preview = public.admin_prepare_client_purge(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', repeat('a', 64),
  encode(extensions.digest(convert_to('purge-client@monalyz.test', 'UTF8'), 'sha256'), 'hex'),
  'purge-client@monalyz.test', state.idempotency_key
)
where label = 'main';
select is((select preview ->> 'inventoryComplete' from purge_test_state where label = 'main'), 'true', 'the same preview resumes to completion');
select throws_ok(
  $$select public.admin_prepare_client_purge(
    '91000000-0000-4000-8000-000000000007',
    '91000000-0000-4000-8000-000000000002', repeat('b',64),
    encode(extensions.digest(convert_to('purge-client@monalyz.test','UTF8'),'sha256'),'hex'),
    'purge-client@monalyz.test', '92000000-0000-4000-8000-000000000007')$$,
  '55000', 'PURGE_PREVIEW_EXISTS',
  'another admin cannot replace an unexpired preview cursor'
);

select is(
  (
    select count(*)::integer
    from private.client_purge_entity_manifest entity
    join purge_test_state state on state.challenge_id = entity.challenge_id
    where state.label = 'main'
      and entity.entity_type = 'support_transcript'
      and entity.entity_id = '98000000-0000-4000-8000-000000000001'
  ),
  1,
  'the informational preview initially captures the target transcript'
);
select is(
  (
    select count(*)::integer
    from private.client_purge_storage_manifest manifest
    join purge_test_state state on state.challenge_id = manifest.challenge_id
    where state.label = 'main'
      and manifest.bucket = 'external-execution-evidence'
      and manifest.object_path =
        '91000000-0000-4000-8000-000000000001/preview-stale.pdf'
  ),
  1,
  'the informational preview initially captures the relational evidence path'
);

update public.support_transcripts
set user_id = '91000000-0000-4000-8000-000000000005'
where id = '98000000-0000-4000-8000-000000000001';
update public.external_transfer_executions
set transfer_id = '96000000-0000-4000-8000-000000000005'
where external_reference = 'PURGE-PREVIEW-MOVED';
update public.support_user_identities
set valid_to = statement_timestamp()
where user_id = '91000000-0000-4000-8000-000000000007'
  and valid_to is null;
insert into public.support_user_identities (
  user_id, normalized_email, valid_from, valid_to
) values (
  '91000000-0000-4000-8000-000000000007',
  'preview-reassigned@monalyz.test', statement_timestamp(), null
);

select throws_ok(
  format(
    $$select public.admin_begin_client_purge(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', '%s', repeat('a',64),
      '%s', '92000000-0000-4000-8000-000000000001')$$,
    challenge_id,
    encode(extensions.digest(convert_to('purge-client@monalyz.test','UTF8'),'sha256'),'hex')
  ),
  '55000', 'PURGE_PREVIEW_STALE',
  'execution rejects a preview whose relational ownership scope changed'
)
from purge_test_state where label = 'main';

update purge_test_state state
set preview = public.admin_prepare_client_purge(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', repeat('a', 64),
  encode(extensions.digest(convert_to('purge-client@monalyz.test', 'UTF8'), 'sha256'), 'hex'),
  'purge-client@monalyz.test', state.idempotency_key
)
where label = 'main';
select is(
  (select preview ->> 'inventoryComplete' from purge_test_state where label = 'main'),
  'false',
  'recovering a stale preview restarts its bounded Storage inventory'
);
select pg_temp.drive_client_purge_storage(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', challenge_id
)
from purge_test_state where label = 'main';
update purge_test_state state
set preview = public.admin_prepare_client_purge(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', repeat('a', 64),
  encode(extensions.digest(convert_to('purge-client@monalyz.test', 'UTF8'), 'sha256'), 'hex'),
  'purge-client@monalyz.test', state.idempotency_key
)
where label = 'main';
select is(
  (select preview ->> 'inventoryComplete' from purge_test_state where label = 'main'),
  'true',
  'the refreshed preview completes after the ownership change'
);
select is(
  (
    select char_length(operation.scope_digest)
    from private.client_purge_operations operation
    join purge_test_state state using (challenge_id)
    where state.label = 'main'
  ),
  64,
  'the refreshed preview stores a canonical SHA-256 scope digest'
);
select is(
  (
    select count(*)::integer
    from private.client_purge_entity_manifest entity
    join purge_test_state state on state.challenge_id = entity.challenge_id
    where state.label = 'main'
      and entity.entity_type = 'support_transcript'
      and entity.entity_id = '98000000-0000-4000-8000-000000000001'
  ),
  0,
  'the refreshed entity manifest drops the transcript now owned by another client'
);
select is(
  (
    select count(*)::integer
    from private.client_purge_storage_manifest manifest
    join purge_test_state state on state.challenge_id = manifest.challenge_id
    where state.label = 'main'
      and manifest.bucket = 'external-execution-evidence'
      and manifest.object_path =
        '91000000-0000-4000-8000-000000000001/preview-stale.pdf'
  ),
  0,
  'the refreshed Storage manifest drops foreign relational evidence'
);
select is(
  (
    public.admin_begin_client_purge(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', challenge_id, repeat('a',64),
      encode(extensions.digest(convert_to('purge-client@monalyz.test','UTF8'),'sha256'),'hex'),
      idempotency_key
    ) ->> 'stage'
  ),
  'storage',
  'the completed one-use challenge starts the guarded purge'
)
from purge_test_state where label = 'main';
select is((select access_status from public.profiles where user_id = '91000000-0000-4000-8000-000000000002'), 'frozen', 'begin atomically freezes the profile');
select ok(
  not (
    select support_email_manifest ? 'preview-reassigned@monalyz.test'
    from private.client_purge_operations operation
    join purge_test_state state using (challenge_id)
    where state.label = 'main'
  ),
  'begin freezes only the authoritative unambiguous support aliases'
);
select throws_ok(
  $$insert into public.notifications(recipient_id,title,message,notification_type)
    values('91000000-0000-4000-8000-000000000002','Late','Blocked','info')$$,
  '55000', 'PURGE_TARGET_FROZEN',
  'business writes are rejected after the owner is frozen'
);
select throws_ok(
  $$insert into public.staff_members(user_id,role,active)
    values('91000000-0000-4000-8000-000000000002','admin',true)$$,
  '55000', 'PURGE_TARGET_PROMOTION_FORBIDDEN',
  'a consumed target cannot be promoted to staff'
);
select throws_ok(
  $$delete from auth.users where id = '91000000-0000-4000-8000-000000000002'$$,
  '55000', 'GUARDED_AUTH_DELETE_NOT_READY',
  'Auth deletion is blocked before the delayed sweep is complete'
);
select throws_ok(
  $$delete from auth.users where id = '91000000-0000-4000-8000-000000000005'$$,
  '42501', 'UNGUARDED_AUTH_DELETE_FORBIDDEN',
  'unrelated Auth deletion cannot bypass the guarded protocol'
);
select throws_ok(
  $$update public.loan_events
    set loan_id = '95000000-0000-4000-8000-000000000003'
    where event_type = 'purge_reparent_seed'$$,
  '55000', 'PURGE_TARGET_FROZEN',
  'an indirect event cannot be reparented away from the frozen client'
);
select throws_ok(
  $$update public.loan_review_checks
    set loan_id = '95000000-0000-4000-8000-000000000003'
    where loan_id = '95000000-0000-4000-8000-000000000001'
      and check_kind = 'dual_review'$$,
  '55000', 'PURGE_TARGET_FROZEN',
  'a review check cannot be reparented away from the frozen client'
);
select throws_ok(
  $$update public.support_transcripts
    set user_id = '91000000-0000-4000-8000-000000000005'
    where tawk_event_id = 'purge-event'$$,
  '55000', 'PURGE_TARGET_FROZEN',
  'a transcript update validates both its old and new owner'
);
select throws_ok(
  $$update public.audit_events
    set entity_id = '97000000-0000-4000-8000-000000000004', metadata = '{}'
    where action = 'purge_reassignment_audit'$$,
  '55000', 'PURGE_TARGET_FROZEN',
  'an audit update validates the old manifested entity'
);
select throws_ok(
  $$insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata)
    values(
      '91000000-0000-4000-8000-000000000001', 'late_support_alias_audit',
      'integration', '97000000-0000-4000-8000-000000000005',
      '{"email":"old-purge-alias@monalyz.test"}'
    )$$,
  '55000', 'PURGE_TARGET_FROZEN',
  'an exact unambiguous historical support alias is frozen in audit metadata'
);

select pg_temp.drive_client_purge_to_delete(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', challenge_id
)
from purge_test_state where label = 'main';
insert into private.client_purge_storage_manifest (
  challenge_id, bucket, object_path, ownership_scope
)
select challenge_id, 'kyc-evidence',
  '91000000-0000-4000-8000-000000000002/bulk/' || lpad(series::text, 4, '0') || '.pdf',
  'target_prefix'
from purge_test_state cross join generate_series(1,1001) series
where label = 'main'
on conflict do nothing;
update purge_test_state state
set work = public.admin_claim_client_purge_storage_work(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', state.challenge_id, 1000
)
where label = 'main';
select is(jsonb_array_length((select work -> 'items' from purge_test_state where label = 'main')), 1000, 'a Storage claim is bounded to 1000 objects');
update private.client_purge_storage_manifest manifest
set claimed_at = statement_timestamp() - interval '6 minutes'
from purge_test_state state
where state.label = 'main'
  and manifest.challenge_id = state.challenge_id
  and manifest.claim_token = (state.work ->> 'claimToken')::uuid;
update purge_test_state state
set retry_work = public.admin_claim_client_purge_storage_work(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', state.challenge_id, 1000
)
where label = 'main';
select is(
  (select work -> 'items' from purge_test_state where label = 'main')::text,
  (select retry_work -> 'items' from purge_test_state where label = 'main')::text,
  'an expired unacknowledged claim replays exactly the same durable page'
);
select throws_ok(
  format(
    $$select public.admin_ack_client_purge_storage_work(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', '%s', '%s', 'delete',
      '{"removed":true,"extra":1}'::jsonb)$$,
    challenge_id, retry_work ->> 'claimToken'
  ),
  '22023', 'PURGE_STORAGE_ACK_INVALID',
  'ACK payloads reject additional keys'
)
from purge_test_state where label = 'main';
select lives_ok(
  format(
    $$select public.admin_ack_client_purge_storage_work(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', '%s', '%s', 'delete',
      '{"removed":true}'::jsonb)$$,
    challenge_id, retry_work ->> 'claimToken'
  ),
  'the retried external deletion is acknowledged idempotently'
)
from purge_test_state where label = 'main';
update purge_test_state state
set fingerprint = (
  select string_agg(manifest.object_path || ':' || manifest.deleted_at::text, ',' order by manifest.object_path)
  from private.client_purge_storage_manifest manifest
  where manifest.challenge_id = state.challenge_id
    and manifest.processing_status = 'deleted'
)
where label = 'main';
select is(
  (select count(*)::integer from private.client_purge_storage_manifest manifest
   join purge_test_state state using (challenge_id)
   where state.label = 'main' and manifest.processing_status = 'deleted'),
  1000,
  'the first page is durably acknowledged once'
);
update purge_test_state state
set work = public.admin_claim_client_purge_storage_work(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', state.challenge_id, 1000
)
where label = 'main';
select ok(
  jsonb_array_length((select work -> 'items' from purge_test_state where label = 'main')) between 1 and 1000,
  'the next claim advances to the remaining page without replay'
);
select public.admin_ack_client_purge_storage_work(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', challenge_id,
  (work ->> 'claimToken')::uuid, 'delete', '{"removed":true}'::jsonb
)
from purge_test_state where label = 'main';
select is(
  (
    select string_agg(manifest.object_path || ':' || manifest.deleted_at::text, ',' order by manifest.object_path)
    from private.client_purge_storage_manifest manifest
    join purge_test_state state using (challenge_id)
    where state.label = 'main' and manifest.processing_status = 'deleted'
      and manifest.object_path in (
        select item ->> 'objectPath'
        from purge_test_state original,
          lateral jsonb_array_elements(original.retry_work -> 'items') item
        where original.label = 'main'
      )
  ),
  (select fingerprint from purge_test_state where label = 'main'),
  'ACKed page-one timestamps are not replayed while page two advances'
);
select pg_temp.drive_client_purge_storage(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', challenge_id
)
from purge_test_state where label = 'main';
select is(
  (select ignored_unsafe_storage_references::integer from private.client_purge_operations operation
   join purge_test_state state using (challenge_id) where state.label = 'main'),
  1,
  'the cross-tenant legacy path is ignored and reported'
);
select is(
  (select count(*)::integer from private.client_purge_storage_manifest manifest
   join purge_test_state state using (challenge_id)
   where state.label = 'main'
     and manifest.object_path = '91000000-0000-4000-8000-000000000005/file.pdf'),
  0,
  'the foreign object never enters the deletion manifest'
);
select is(
  (select count(*)::integer from private.client_purge_storage_manifest manifest
   join purge_test_state state using (challenge_id)
   where state.label = 'main'
     and manifest.object_path = '91000000-0000-4000-8000-000000000001/legacy' || pg_catalog.chr(92) || 'preuve 🧾.pdf '),
  1,
  'a legitimate legacy external key is preserved byte-for-byte in the manifest'
);
select is(
  (select count(*)::integer from private.client_purge_storage_manifest manifest
   join purge_test_state state using (challenge_id)
   where state.label = 'main'
     and manifest.object_path =
       '91000000-0000-4000-8000-000000000001/preview-stale.pdf'),
  0,
  'execution never repopulates a preview path now owned by another client'
);

select public.admin_mark_client_purge_stage(
  '91000000-0000-4000-8000-000000000001', challenge_id, 'database', null
)
from purge_test_state where label = 'main';
select is(
  (
    public.admin_purge_client_relational_data(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', challenge_id
    ) ->> 'status'
  ),
  'waiting_sweep',
  'relational erasure enters the delayed sweep state'
)
from purge_test_state where label = 'main';
-- Each RPC runs in its own transaction in production. pgTAP keeps this whole
-- scenario in one transaction, so explicitly end the RPC-local bypass before
-- proving that ordinary writes are quarantined.
select set_config('monalyz.client_purge_maintenance', 'off', true);
select ok(
  (select sweep_not_before >= updated_at + interval '2 hours 5 minutes'
   from private.client_purge_operations operation
   join purge_test_state state using (challenge_id) where state.label = 'main'),
  'the signed-URL grace period includes an intentional five-minute margin'
);
select is((select count(*)::integer from public.kyc_applications where owner_id = '91000000-0000-4000-8000-000000000002'), 0, 'KYC applications are removed');
select is((select count(*)::integer from public.financial_ledger_entries where owner_id = '91000000-0000-4000-8000-000000000002'), 0, 'ledger entries are removed before positions');
select is((select count(*)::integer from public.financial_positions where owner_id = '91000000-0000-4000-8000-000000000002'), 0, 'financial positions are removed');
select is((select count(*)::integer from public.loan_applications where owner_id = '91000000-0000-4000-8000-000000000002'), 0, 'loan applications are removed');
select is((select count(*)::integer from public.notifications where recipient_id = '91000000-0000-4000-8000-000000000002'), 0, 'notifications are removed');
select is((select count(*)::integer from public.transactional_email_outbox where recipient_id = '91000000-0000-4000-8000-000000000002'), 0, 'transactional outbox rows are removed');
select is((select count(*)::integer from public.audit_events where action = 'purge_exact_audit'), 0, 'exact target audit metadata is removed');
select is((select count(*)::integer from public.audit_events where action = 'purge_support_alias_audit'), 0, 'an exact unambiguous support alias audit is removed');
select is((select count(*)::integer from public.audit_events where action = 'preserve_shared_alias_audit'), 1, 'an ambiguous shared support alias audit is preserved');
select is((select count(*)::integer from public.audit_events where action = 'preserve_preview_moved_entity_audit'), 1, 'an audit for an entity reparented before begin is preserved');
select is((select count(*)::integer from public.audit_events where action = 'preserve_preview_reassigned_alias_audit'), 1, 'an audit for an alias reassigned before begin is preserved');
select is((select count(*)::integer from public.audit_events where action = 'preserve_cross_type_collision_audit'), 1, 'an audit with a colliding UUID but a different entity type is preserved');
select is((select count(*)::integer from public.audit_events where action = 'preserve_direct_user_uuid_wrong_type_audit'), 1, 'a non-user audit whose entity UUID equals the target user is preserved');
select is((select count(*)::integer from public.audit_events where action = 'preserve_joann_audit'), 1, 'substring e-mail joann is preserved');
select is((select count(*)::integer from public.support_transcripts where tawk_event_id = 'purge-shared-event'), 1, 'an ambiguous unresolved transcript for a reused historical e-mail is preserved');
select is((select count(*)::integer from public.support_transcripts where tawk_event_id = 'purge-preview-move'), 1, 'a transcript reparented before begin is preserved');
select is((select count(*)::integer from public.support_transcripts where tawk_event_id = 'purge-preview-alias-event'), 1, 'an unresolved transcript for an alias reassigned before begin is preserved');
select is((select count(*)::integer from public.external_transfer_executions where external_reference = 'PURGE-PREVIEW-MOVED'), 1, 'external evidence reparented before begin is preserved');
select is((select count(*)::integer from auth.users where id = '91000000-0000-4000-8000-000000000002'), 1, 'Auth remains until the delayed Storage sweep');

select throws_ok(
  $$insert into public.external_loan_fundings (
      loan_id, external_reference, evidence_object_path, executed_by, executed_at
    ) values (
      '95000000-0000-4000-8000-000000000003', 'PURGE-REUSED-EVIDENCE',
      '91000000-0000-4000-8000-000000000001/quarantine-evidence.pdf',
      '91000000-0000-4000-8000-000000000001', statement_timestamp()
    )$$,
  '55000', 'PURGE_EVIDENCE_PATH_QUARANTINED',
  'a foreign row cannot reuse a consumed relational evidence path'
);
select is(
  (select count(*)::integer from public.external_loan_fundings
   where external_reference = 'PURGE-REUSED-EVIDENCE'),
  0,
  'the quarantined path never creates a foreign row'
);

select set_config('monalyz.client_purge_maintenance', 'on', true);
insert into public.external_loan_fundings (
  loan_id, external_reference, evidence_object_path, executed_by, executed_at
) values (
  '95000000-0000-4000-8000-000000000003', 'PURGE-BYPASS-REUSED-EVIDENCE',
  '91000000-0000-4000-8000-000000000001/quarantine-evidence.pdf',
  '91000000-0000-4000-8000-000000000001', statement_timestamp()
);
insert into public.support_user_identities (
  user_id, normalized_email, valid_from, valid_to
) values (
  '91000000-0000-4000-8000-000000000002', 'purge-client@monalyz.test',
  statement_timestamp(), null
);
insert into public.support_transcripts (
  tawk_event_id, tawk_property_id, tawk_chat_id, visitor_email_normalized,
  identity_status, event_at, payload, raw_body, raw_body_sha256, email_status
) values (
  'purge-delayed-tawk', 'purge-property', 'purge-delayed-chat',
  'purge-client@monalyz.test', 'not_found', statement_timestamp(), '{}', '{}',
  repeat('6',64), 'skipped'
);
select set_config('monalyz.client_purge_maintenance', 'off', true);

update private.client_purge_operations operation
set sweep_not_before = statement_timestamp() - interval '1 second',
    retry_after = statement_timestamp() - interval '1 second'
from purge_test_state state
where state.label = 'main' and operation.challenge_id = state.challenge_id;
select is(
  (select stage from public.admin_list_pending_client_purges(1)),
  'storage_sweep',
  'the scheduler leases the due delayed sweep'
);
select pg_temp.drive_client_purge_to_delete(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', challenge_id
)
from purge_test_state where label = 'main';
select throws_ok(
  format(
    $$select public.admin_claim_client_purge_storage_work(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', '%s', 1000)$$,
    challenge_id
  ),
  '55000', 'PURGE_EVIDENCE_PATH_OWNERSHIP_CONFLICT',
  'the delayed sweep refuses a relational path now referenced by a foreign parent'
)
from purge_test_state where label = 'main';
select is(
  (select count(*)::integer from public.external_loan_fundings
   where external_reference = 'PURGE-BYPASS-REUSED-EVIDENCE'),
  1,
  'the Storage conflict check preserves the foreign parent and its evidence reference'
);
delete from public.external_loan_fundings
where external_reference = 'PURGE-BYPASS-REUSED-EVIDENCE';
select pg_temp.drive_client_purge_storage(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', challenge_id
)
from purge_test_state where label = 'main';
select is(
  (
    select count(*)::integer
    from private.client_purge_storage_manifest manifest
    join purge_test_state state using (challenge_id)
    where state.label = 'main'
      and manifest.ownership_scope = 'relational'
      and manifest.object_path =
        '91000000-0000-4000-8000-000000000001/quarantine-evidence.pdf'
  ),
  1,
  'the consumed relational path remains quarantined after the delayed sweep'
);
select public.admin_mark_client_purge_stage(
  '91000000-0000-4000-8000-000000000001', challenge_id, 'auth', null
)
from purge_test_state where label = 'main';
select is(
  (
    public.admin_assert_client_purge_auth_ready(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', challenge_id
    ) ->> 'allowed'
  ),
  'true',
  'the locked RPC revalidates target, staff, profile, delay and Storage state'
)
from purge_test_state where label = 'main';
select lives_ok(
  $$delete from auth.users where id = '91000000-0000-4000-8000-000000000002'$$,
  'the strict Auth trigger arms only a ready guarded cascade'
);
select throws_ok(
  $$insert into auth.users(id, email, raw_user_meta_data)
    values(
      '91000000-0000-4000-8000-000000000008',
      'PURGE-CLIENT@MONALYZ.TEST', '{}'::jsonb
    )$$,
  '55000', 'PURGE_TARGET_EMAIL_RESERVED',
  'the deleted Auth e-mail remains reserved until final verification'
);
select throws_ok(
  $$update auth.users set email = 'purge-client@monalyz.test'
    where id = '91000000-0000-4000-8000-000000000006'$$,
  '55000', 'PURGE_TARGET_EMAIL_RESERVED',
  'an existing Auth identity cannot adopt the reserved e-mail'
);
select is(
  (
    select count(*)::integer
    from public.admin_list_client_purge_candidates(
      '91000000-0000-4000-8000-000000000001', 'purge-client@monalyz.test', 10, 0
    )
    where user_id = '91000000-0000-4000-8000-000000000002'
      and access_status = 'auth_deleted'
  ),
  1,
  'a post-Auth failed operation stays visible for safe resumption'
);
select public.admin_mark_client_purge_stage(
  '91000000-0000-4000-8000-000000000001', challenge_id, 'verify', null
)
from purge_test_state where label = 'main';
select pg_temp.drive_client_purge_storage(
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002', challenge_id
)
from purge_test_state where label = 'main';
select set_config('monalyz.client_purge_maintenance', 'on', true);
insert into public.external_loan_fundings (
  loan_id, external_reference, evidence_object_path, executed_by, executed_at
) values (
  '95000000-0000-4000-8000-000000000003', 'PURGE-BYPASS-REUSED-EVIDENCE',
  '91000000-0000-4000-8000-000000000001/quarantine-evidence.pdf',
  '91000000-0000-4000-8000-000000000001', statement_timestamp()
);
select set_config('monalyz.client_purge_maintenance', 'off', true);
select throws_ok(
  format(
    $$select public.admin_finalize_client_purge(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002', '%s')$$,
    challenge_id
  ),
  '55000', 'PURGE_VERIFICATION_FAILED:externalLoanFundings=1',
  'a privileged foreign path collision blocks finalization instead of being deleted'
)
from purge_test_state where label = 'main';
select is(
  (select count(*)::integer from public.external_loan_fundings
   where external_reference = 'PURGE-BYPASS-REUSED-EVIDENCE'),
  1,
  'failed verification preserves the foreign parent for explicit resolution'
);
delete from public.external_loan_fundings
where external_reference = 'PURGE-BYPASS-REUSED-EVIDENCE';
select ok(
  public.admin_finalize_client_purge(
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002', challenge_id
  ),
  'exhaustive final verification succeeds'
)
from purge_test_state where label = 'main';
select is((select count(*)::integer from public.support_transcripts where tawk_event_id = 'purge-delayed-tawk'), 0, 'terminal cleanup removes a delayed unresolved Tawk transcript');
select is((select count(*)::integer from public.support_user_identities where user_id = '91000000-0000-4000-8000-000000000002'), 0, 'terminal cleanup removes identities recreated during the wait');
select is((select count(*)::integer from public.external_transfer_executions where external_reference = 'PURGE-PREVIEW-MOVED'), 1, 'final verification never deletes foreign evidence by path alone');
select is((select count(*)::integer from private.client_purge_operations where target_user_id = '91000000-0000-4000-8000-000000000002'), 0, 'success leaves no private operation trace');
select is((select count(*)::integer from private.client_purge_storage_manifest manifest join purge_test_state state using (challenge_id) where state.label = 'main'), 0, 'success cascades the Storage manifest');
select is((select count(*)::integer from private.client_purge_storage_scan_queue queue join purge_test_state state using (challenge_id) where state.label = 'main'), 0, 'success cascades scan cursors');
select is((select count(*)::integer from private.client_purge_entity_manifest entity join purge_test_state state using (challenge_id) where state.label = 'main'), 0, 'success cascades the entity manifest');
select lives_ok(
  $$insert into auth.users(id, email, raw_user_meta_data)
    values(
      '91000000-0000-4000-8000-000000000008',
      'purge-client@monalyz.test',
      '{"base_currency":"EUR","preferred_language":"fr"}'::jsonb
    )$$,
  'the e-mail becomes reusable only after the trace-free finalization'
);

select throws_ok(
  $$select * from public.admin_list_client_purge_candidates(
    '91000000-0000-4000-8000-000000000001', '', null, 0)$$,
  '22023', 'INVALID_CLIENT_PAGE',
  'NULL list limits are rejected rather than becoming unbounded'
);
select throws_ok(
  $$select * from public.admin_list_pending_client_purges(null)$$,
  '22023', 'INVALID_SWEEP_LIMIT',
  'NULL scheduler limits are rejected'
);

select * from finish();
rollback;
