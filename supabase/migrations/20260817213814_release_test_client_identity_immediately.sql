-- Release a test client's Auth identity immediately after relational erasure.
-- The signed-upload grace period remains attached to the retired UUID and is
-- completed asynchronously without reserving the deleted e-mail address.

create or replace function private.arm_guarded_client_auth_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  immediate_release_ready boolean;
  legacy_release_ready boolean;
begin
  -- auth.users is already row-locked when a row trigger runs. Never wait on
  -- the owner lock here: fail fast instead of creating a row/advisory cycle.
  if not pg_catalog.pg_try_advisory_xact_lock(
    private.client_purge_lock_key(old.id)
  ) then
    raise exception 'PURGE_AUTH_DELETE_BUSY' using errcode = '55P03';
  end if;

  select * into operation
  from private.client_purge_operations
  where target_user_id = old.id
    and consumed_at is not null
  for update;
  if not found then
    raise exception 'UNGUARDED_AUTH_DELETE_FORBIDDEN' using errcode = '42501';
  end if;

  immediate_release_ready :=
    operation.stage = 'auth'
    and operation.storage_cycle_stage = 'storage'
    and operation.storage_phase = 'complete'
    and operation.sweep_not_before is not null;
  legacy_release_ready :=
    operation.stage = 'auth'
    and operation.storage_cycle_stage = 'storage_sweep'
    and operation.storage_phase = 'complete'
    and operation.sweep_not_before is not null
    and operation.sweep_not_before <= statement_timestamp();

  if exists (select 1 from public.staff_members where user_id = old.id)
     or not (immediate_release_ready or legacy_release_ready)
     or exists (
       select 1
       from public.profiles profile
       where profile.user_id = old.id
         and profile.access_status <> 'frozen'
     ) then
    raise exception 'GUARDED_AUTH_DELETE_NOT_READY' using errcode = '55000';
  end if;
  if old.email is null
     or lower(btrim(old.email)) is distinct from lower(btrim(operation.target_email)) then
    raise exception 'PURGE_TARGET_EMAIL_CHANGED' using errcode = '55000';
  end if;

  perform pg_catalog.set_config('monalyz.client_purge_maintenance', 'on', true);
  return old;
end;
$$;

create or replace function private.reject_reserved_purge_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_new_email text := lower(btrim(new.email));
begin
  -- The retired UUID remains the immutable key of the delayed Storage sweep.
  if tg_op = 'INSERT' and exists (
    select 1
    from private.client_purge_operations operation
    where operation.target_user_id = new.id
      and operation.consumed_at is not null
  ) then
    raise exception 'PURGE_TARGET_ID_RESERVED' using errcode = '55000';
  end if;

  -- The target may not change identity while its guarded erasure is active.
  if tg_op = 'UPDATE' and exists (
    select 1
    from private.client_purge_operations operation
    where operation.target_user_id = old.id
      and operation.consumed_at is not null
  ) then
    raise exception 'PURGE_TARGET_EMAIL_RESERVED' using errcode = '55000';
  end if;

  -- Reserve the address only while the retired Auth row still exists. Once
  -- that UUID has been deleted, the remaining Storage sweep is UUID-scoped
  -- and must not prevent a fresh test account from claiming the same address.
  if normalized_new_email is not null and exists (
    select 1
    from private.client_purge_operations operation
    where operation.consumed_at is not null
      and lower(btrim(operation.target_email)) = normalized_new_email
      and exists (
        select 1
        from auth.users target_user
        where target_user.id = operation.target_user_id
      )
  ) then
    raise exception 'PURGE_TARGET_EMAIL_RESERVED' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.admin_assert_client_purge_auth_ready(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  current_target_email text;
  immediate_release_ready boolean;
  legacy_release_ready boolean;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_target_user_id is null or p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into operation
  from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and target_user_id = p_target_user_id
    and consumed_at is not null
  for update;

  immediate_release_ready := found
    and operation.stage = 'auth'
    and operation.storage_cycle_stage = 'storage'
    and operation.storage_phase = 'complete'
    and operation.sweep_not_before is not null;
  legacy_release_ready := found
    and operation.stage = 'auth'
    and operation.storage_cycle_stage = 'storage_sweep'
    and operation.storage_phase = 'complete'
    and operation.sweep_not_before is not null
    and operation.sweep_not_before <= statement_timestamp();
  if not (immediate_release_ready or legacy_release_ready) then
    raise exception 'PURGE_AUTH_STAGE_INVALID' using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_target_user_id
      and profile.access_status <> 'frozen'
  ) then
    raise exception 'PURGE_TARGET_NOT_FROZEN' using errcode = '55000';
  end if;

  select lower(btrim(users.email)) into current_target_email
  from auth.users users
  where users.id = p_target_user_id
  for update;
  if found and current_target_email is distinct from lower(btrim(operation.target_email)) then
    raise exception 'PURGE_TARGET_EMAIL_CHANGED' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'targetEmail', operation.target_email,
    'authExists', exists (select 1 from auth.users where id = p_target_user_id),
    'sweepNotBefore', operation.sweep_not_before,
    'ignoredUnsafeStorageReferences', operation.ignored_unsafe_storage_references
  );
end;
$$;

create or replace function public.admin_mark_client_purge_stage(
  p_actor_id uuid,
  p_challenge_id uuid,
  p_stage text,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  target_auth_exists boolean;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_stage is null
     or p_stage not in (
       'storage', 'database', 'auth', 'waiting_sweep', 'storage_sweep', 'verify'
     )
     or (p_error_code is not null and char_length(p_error_code) > 100)
     or (p_stage = 'waiting_sweep' and p_error_code is not null) then
    raise exception 'INVALID_PURGE_STAGE' using errcode = '22023';
  end if;

  select * into operation
  from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and consumed_at is not null
  for update;
  if not found then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  target_auth_exists := exists (
    select 1 from auth.users users where users.id = operation.target_user_id
  );
  if p_stage <> operation.stage and not (
    (
      operation.stage = 'storage'
      and p_stage = 'database'
      and operation.storage_cycle_stage = 'storage'
      and operation.storage_phase = 'complete'
    )
    or (
      operation.stage = 'auth'
      and p_stage = 'waiting_sweep'
      and operation.storage_cycle_stage = 'storage'
      and operation.storage_phase = 'complete'
      and operation.sweep_not_before is not null
      and not target_auth_exists
    )
    or (
      operation.stage = 'storage_sweep'
      and p_stage = 'verify'
      and operation.storage_cycle_stage = 'storage_sweep'
      and operation.storage_phase = 'complete'
      and not target_auth_exists
    )
    -- Compatibility for an operation begun before this migration: its Auth
    -- deletion still occurs after the delayed sweep.
    or (
      operation.stage = 'storage_sweep'
      and p_stage = 'auth'
      and operation.storage_cycle_stage = 'storage_sweep'
      and operation.storage_phase = 'complete'
      and operation.sweep_not_before is not null
      and operation.sweep_not_before <= statement_timestamp()
      and target_auth_exists
    )
    or (
      operation.stage = 'auth'
      and p_stage = 'verify'
      and operation.storage_cycle_stage = 'storage_sweep'
      and operation.storage_phase = 'complete'
      and not target_auth_exists
    )
  ) then
    raise exception 'INVALID_PURGE_STAGE_TRANSITION' using errcode = '55000';
  end if;

  if p_stage = 'waiting_sweep' then
    if target_auth_exists
       or operation.sweep_not_before is null
       or operation.storage_cycle_stage <> 'storage'
       or operation.storage_phase <> 'complete' then
      raise exception 'PURGE_AUTH_DELETE_INCOMPLETE' using errcode = '55000';
    end if;
    update private.client_purge_operations
    set stage = 'waiting_sweep',
        status = 'waiting_sweep',
        last_error_code = null,
        retry_after = operation.sweep_not_before,
        updated_at = statement_timestamp()
    where challenge_id = p_challenge_id;
    return;
  end if;

  update private.client_purge_operations
  set stage = p_stage,
      status = case when p_error_code is null then 'running' else 'failed' end,
      last_error_code = p_error_code,
      retry_after = statement_timestamp() + case
        when p_error_code is null then interval '0 seconds'
        else interval '15 minutes'
      end,
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id;
end;
$$;

create or replace function public.admin_purge_client_relational_data(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation private.client_purge_operations;
  target_email text;
  support_emails jsonb;
  purge_completed_at timestamptz;
  sweep_time timestamptz;
begin
  perform private.require_active_purge_admin(p_actor_id);
  if p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into operation
  from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and target_user_id = p_target_user_id
    and consumed_at is not null
  for update;
  if not found
     or operation.stage <> 'database'
     or operation.storage_cycle_stage <> 'storage'
     or operation.storage_phase <> 'complete' then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1 from public.profiles where user_id = p_target_user_id for update;
  if exists (
    select 1 from public.profiles
    where user_id = p_target_user_id and access_status <> 'frozen'
  ) then
    raise exception 'PURGE_TARGET_NOT_FROZEN' using errcode = '55000';
  end if;
  select lower(btrim(users.email)) into target_email
  from auth.users users where users.id = p_target_user_id;
  target_email := coalesce(target_email, lower(btrim(operation.target_email)));
  perform private.refresh_client_purge_entity_manifest(
    p_challenge_id, p_target_user_id
  );

  select coalesce(jsonb_agg(email order by email), '[]'::jsonb)
  into support_emails
  from (
    select candidate.email
    from (
      select identity.normalized_email as email
      from public.support_user_identities identity
      where identity.user_id = p_target_user_id
      union
      select target_email where target_email is not null
    ) candidate
    where not exists (
      select 1
      from public.support_user_identities active_identity
      where active_identity.normalized_email = candidate.email
        and active_identity.user_id <> p_target_user_id
    )
  ) unambiguous_emails;

  -- Audit/transcript matching below must read the authoritative aliases from
  -- this locked execution snapshot, never the stale preview snapshot.
  update private.client_purge_operations
  set support_email_manifest = support_emails,
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id;

  operation.support_email_manifest := support_emails;

  perform pg_catalog.set_config('monalyz.allow_ledger_maintenance', 'on', true);
  perform pg_catalog.set_config('monalyz.allow_official_document_maintenance', 'on', true);
  perform pg_catalog.set_config('monalyz.client_purge_maintenance', 'on', true);

  delete from public.support_transcripts transcript
  where transcript.user_id = p_target_user_id
     or (
       transcript.user_id is null
       and (
         transcript.visitor_email_normalized in (
           select jsonb_array_elements_text(support_emails)
         )
         or transcript.notification_email in (
           select jsonb_array_elements_text(support_emails)
         )
       )
       and not exists (
         select 1 from public.support_user_identities active_identity
         where active_identity.user_id <> p_target_user_id
           and active_identity.normalized_email in (
             transcript.visitor_email_normalized,
             transcript.notification_email
           )
       )
     );
  delete from public.support_user_identities where user_id = p_target_user_id;
  delete from public.transactional_email_outbox where recipient_id = p_target_user_id;
  update public.transactional_email_outbox set claimed_by = null where claimed_by = p_target_user_id;
  delete from public.notifications where recipient_id = p_target_user_id;
  delete from public.push_subscriptions where user_id = p_target_user_id;

  delete from public.audit_events
  where private.audit_event_matches_client(
    actor_id, entity_type, entity_id, metadata, p_target_user_id, p_challenge_id
  );
  delete from public.kyc_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'kyc_event'
      and entity.entity_id = event.id::text
  );
  delete from public.loan_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'loan_event'
      and entity.entity_id = event.id::text
  );
  delete from public.transfer_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'transfer_event'
      and entity.entity_id = event.id::text
  );
  delete from public.loan_review_checks review
  where exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'loan_review_check'
      and entity.entity_id = review.id::text
  );
  delete from public.transfer_review_checks review
  where exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'transfer_review_check'
      and entity.entity_id = review.id::text
  );

  delete from public.official_documents where owner_id = p_target_user_id;
  delete from public.financial_ledger_entries where owner_id = p_target_user_id;
  delete from public.external_transfer_executions
  where transfer_id in (
    select transfer.id from public.transfer_intents transfer
    where transfer.owner_id = p_target_user_id
  );
  delete from public.external_loan_fundings
  where loan_id in (
    select loan.id from public.loan_applications loan
    where loan.owner_id = p_target_user_id
  );
  delete from public.transfer_intents where owner_id = p_target_user_id;
  delete from public.loan_applications where owner_id = p_target_user_id;
  delete from public.financial_positions where owner_id = p_target_user_id;
  delete from public.kyc_drafts where owner_id = p_target_user_id;
  delete from public.kyc_applications where owner_id = p_target_user_id;

  purge_completed_at := pg_catalog.clock_timestamp();
  -- Signed upload URLs remain valid for at most two hours. Keep the existing
  -- five-minute margin, but release Auth now and sweep only the retired UUID
  -- after the grace period.
  sweep_time := purge_completed_at + interval '2 hours 5 minutes';
  update private.client_purge_operations
  set stage = 'auth',
      status = 'running',
      sweep_not_before = sweep_time,
      retry_after = statement_timestamp(),
      last_error_code = null,
      updated_at = purge_completed_at
  where challenge_id = p_challenge_id;

  return jsonb_build_object(
    'status', 'running',
    'stage', 'auth',
    'sweepNotBefore', sweep_time,
    'ignoredUnsafeStorageReferences', operation.ignored_unsafe_storage_references
  );
end;
$$;

-- Normalize any purge that crossed the relational boundary under the former
-- ordering. The new application always executes auth -> waiting_sweep and
-- storage_sweep -> verify, so no pre-migration operation may remain dependent
-- on the old storage_sweep -> auth -> verify sequence.
do $$
declare
  operation record;
begin
  for operation in
    select purge.challenge_id
    from private.client_purge_operations purge
    where purge.consumed_at is not null
      and purge.sweep_not_before is not null
      and (
        purge.stage = 'auth'
        or (
          purge.stage in ('waiting_sweep', 'storage_sweep', 'verify')
          and exists (
            select 1 from auth.users users where users.id = purge.target_user_id
          )
        )
      )
    order by purge.challenge_id
    for update
  loop
    -- In-flight Storage acknowledgements become harmless retries. The exact
    -- manifest remains quarantined and the delayed cycle will rebuild all work.
    delete from private.client_purge_storage_scan_queue queue
    where queue.challenge_id = operation.challenge_id;

    update private.client_purge_storage_manifest manifest
    set processing_status = 'pending',
        claim_token = null,
        claimed_at = null,
        deleted_at = null,
        verified_at = null
    where manifest.challenge_id = operation.challenge_id;

    update private.client_purge_operations purge
    set stage = 'auth',
        status = 'running',
        storage_cycle_stage = 'storage',
        storage_phase = 'complete',
        reference_after_bucket = null,
        reference_after_object_path = null,
        reference_claim_token = null,
        reference_claimed_at = null,
        verify_prefix_index = 0,
        prefix_claim_token = null,
        prefix_claimed_at = null,
        retry_after = statement_timestamp(),
        last_error_code = null,
        updated_at = statement_timestamp()
    where purge.challenge_id = operation.challenge_id;
  end loop;
end;
$$;

-- Historical ownership of an e-mail by another UUID is permanent ambiguity:
-- final cleanup and mutation guards must preserve that other account's data
-- even after its support identity has been retired by a later e-mail change.
CREATE OR REPLACE FUNCTION "private"."audit_event_matches_client"("p_actor_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid", "p_metadata" "jsonb", "p_target_user_id" "uuid", "p_challenge_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p_actor_id = p_target_user_id
    or (
      p_entity_type in ('user', 'profile', 'auth_user')
      and p_entity_id = p_target_user_id
    )
    or exists (
      select 1 from private.client_purge_entity_manifest entity
      where entity.challenge_id = p_challenge_id
        and entity.entity_type = p_entity_type
        and entity.entity_id = p_entity_id::text
    )
    or private.uuid_or_null(p_metadata ->> 'user_id') = p_target_user_id
    or private.uuid_or_null(p_metadata ->> 'owner_id') = p_target_user_id
    or private.uuid_or_null(p_metadata ->> 'recipient_id') = p_target_user_id
    or private.uuid_or_null(p_metadata ->> 'target_user_id') = p_target_user_id
    or exists (
      select 1
      from private.client_purge_operations operation
      cross join lateral jsonb_array_elements_text(
        operation.support_email_manifest
      ) as support_email(value)
      where operation.challenge_id = p_challenge_id
        and support_email.value in (
          lower(btrim(p_metadata ->> 'email')),
          lower(btrim(p_metadata ->> 'recipient_email')),
          lower(btrim(p_metadata ->> 'user_email')),
          lower(btrim(p_metadata ->> 'target_email'))
        )
        and not exists (
          select 1
          from public.support_user_identities active_identity
          where active_identity.normalized_email = support_email.value
            and active_identity.user_id <> p_target_user_id
        )
    );
$$;

CREATE OR REPLACE FUNCTION "private"."client_purge_residuals"("p_challenge_id" "uuid", "p_target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  operation private.client_purge_operations;
  support_emails text[];
begin
  select * into operation from private.client_purge_operations
  where challenge_id = p_challenge_id and target_user_id = p_target_user_id;
  if not found then
    raise exception 'PURGE_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(value), array[]::text[]) into support_emails
  from jsonb_array_elements_text(operation.support_email_manifest) value;

  return jsonb_build_object(
    'authUsers', (select count(*) from auth.users where id = p_target_user_id),
    'staffMemberships', (select count(*) from public.staff_members where user_id = p_target_user_id),
    'profiles', (select count(*) from public.profiles where user_id = p_target_user_id),
    'kycApplications', (select count(*) from public.kyc_applications where owner_id = p_target_user_id),
    'kycDrafts', (select count(*) from public.kyc_drafts where owner_id = p_target_user_id),
    'positions', (select count(*) from public.financial_positions where owner_id = p_target_user_id),
    'ledgerEntries', (select count(*) from public.financial_ledger_entries where owner_id = p_target_user_id),
    'loans', (select count(*) from public.loan_applications where owner_id = p_target_user_id),
    'transfers', (select count(*) from public.transfer_intents where owner_id = p_target_user_id),
    'documents', (select count(*) from public.official_documents where owner_id = p_target_user_id),
    'notifications', (select count(*) from public.notifications where recipient_id = p_target_user_id),
    'emailOutbox', (select count(*) from public.transactional_email_outbox
      where recipient_id = p_target_user_id or claimed_by = p_target_user_id),
    'pushSubscriptions', (select count(*) from public.push_subscriptions where user_id = p_target_user_id),
    'supportIdentities', (select count(*) from public.support_user_identities where user_id = p_target_user_id),
    'supportTranscripts', (
      select count(*) from public.support_transcripts transcript
      where transcript.user_id = p_target_user_id
        or (
          transcript.user_id is null
          and (
            transcript.visitor_email_normalized = any(support_emails)
            or transcript.notification_email = any(support_emails)
          )
          and not exists (
            select 1 from public.support_user_identities active_identity
            where active_identity.user_id <> p_target_user_id
              and active_identity.normalized_email in (
                transcript.visitor_email_normalized, transcript.notification_email
              )
          )
        )
    ),
    'supportPushDeliveries', (select count(*)
      from public.support_push_deliveries delivery
      where exists (select 1 from private.client_purge_entity_manifest entity
        where entity.challenge_id = p_challenge_id
          and entity.entity_type = 'support_push_delivery'
          and entity.entity_id = delivery.id::text)),
    'kycReviewChecklists', (select count(*)
      from public.kyc_review_checklists checklist
      where exists (select 1 from private.client_purge_entity_manifest entity
        where entity.challenge_id = p_challenge_id
          and (
            (entity.entity_type = 'kyc_review_checklist'
              and entity.entity_id = checklist.kyc_id::text)
            or (entity.entity_type = 'kyc_application'
              and entity.entity_id = checklist.kyc_id::text)
          ))),
    'loanReviewChecks', (select count(*)
      from public.loan_review_checks review
      where exists (select 1 from private.client_purge_entity_manifest entity
        where entity.challenge_id = p_challenge_id
          and (
            (entity.entity_type = 'loan_review_check'
              and entity.entity_id = review.id::text)
            or (entity.entity_type = 'loan_application'
              and entity.entity_id = review.loan_id::text)
          ))),
    'transferReviewChecks', (select count(*)
      from public.transfer_review_checks review
      where exists (select 1 from private.client_purge_entity_manifest entity
        where entity.challenge_id = p_challenge_id
          and (
            (entity.entity_type = 'transfer_review_check'
              and entity.entity_id = review.id::text)
            or (entity.entity_type = 'transfer_intent'
              and entity.entity_id = review.transfer_id::text)
          ))),
    'externalLoanFundings', (select count(*)
      from public.external_loan_fundings funding
      where exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and entity.entity_type = 'loan_application'
            and entity.entity_id = funding.loan_id::text)
        or exists (select 1 from private.client_purge_storage_manifest manifest
          where manifest.challenge_id = p_challenge_id
            and manifest.bucket = 'external-execution-evidence'
            and manifest.ownership_scope = 'relational'
            and manifest.object_path = funding.evidence_object_path)),
    'externalTransferExecutions', (select count(*)
      from public.external_transfer_executions execution
      where exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and entity.entity_type = 'transfer_intent'
            and entity.entity_id = execution.transfer_id::text)
        or exists (select 1 from private.client_purge_storage_manifest manifest
          where manifest.challenge_id = p_challenge_id
            and manifest.bucket = 'external-execution-evidence'
            and manifest.ownership_scope = 'relational'
            and manifest.object_path = execution.evidence_object_path)),
    'kycEvents', (select count(*) from public.kyc_events event
      where event.actor_id = p_target_user_id
        or exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and (
              (entity.entity_type = 'kyc_event' and entity.entity_id = event.id::text)
              or (entity.entity_type = 'kyc_application'
                and entity.entity_id = event.kyc_id::text)
            ))),
    'loanEvents', (select count(*) from public.loan_events event
      where event.actor_id = p_target_user_id
        or exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and (
              (entity.entity_type = 'loan_event' and entity.entity_id = event.id::text)
              or (entity.entity_type = 'loan_application'
                and entity.entity_id = event.loan_id::text)
            ))),
    'transferEvents', (select count(*) from public.transfer_events event
      where event.actor_id = p_target_user_id
        or exists (select 1 from private.client_purge_entity_manifest entity
          where entity.challenge_id = p_challenge_id
            and (
              (entity.entity_type = 'transfer_event' and entity.entity_id = event.id::text)
              or (entity.entity_type = 'transfer_intent'
                and entity.entity_id = event.transfer_id::text)
            ))),
    'auditEvents', (select count(*) from public.audit_events event
      where private.audit_event_matches_client(
        event.actor_id, event.entity_type, event.entity_id, event.metadata,
        p_target_user_id, p_challenge_id
      )),
    'storageEntriesUnverified', (select count(*)
      from private.client_purge_storage_manifest manifest
      where manifest.challenge_id = p_challenge_id
        and manifest.processing_status <> 'verified'),
    'storageScansUnfinished', (select count(*)
      from private.client_purge_storage_scan_queue queue
      where queue.challenge_id = p_challenge_id and queue.status <> 'done')
  );
end;
$$;

CREATE OR REPLACE FUNCTION "private"."guard_client_audit_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  old_data jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  new_data jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  candidate uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  foreach candidate in array array[
    private.uuid_or_null(old_data ->> 'actor_id'),
    case when old_data ->> 'entity_type' in ('user', 'profile', 'auth_user')
      then private.uuid_or_null(old_data ->> 'entity_id') else null end,
    private.uuid_or_null(old_data #>> '{metadata,user_id}'),
    private.uuid_or_null(old_data #>> '{metadata,owner_id}'),
    private.uuid_or_null(old_data #>> '{metadata,recipient_id}'),
    private.uuid_or_null(old_data #>> '{metadata,target_user_id}'),
    private.uuid_or_null(new_data ->> 'actor_id'),
    case when new_data ->> 'entity_type' in ('user', 'profile', 'auth_user')
      then private.uuid_or_null(new_data ->> 'entity_id') else null end,
    private.uuid_or_null(new_data #>> '{metadata,user_id}'),
    private.uuid_or_null(new_data #>> '{metadata,owner_id}'),
    private.uuid_or_null(new_data #>> '{metadata,recipient_id}'),
    private.uuid_or_null(new_data #>> '{metadata,target_user_id}')
  ] loop
    perform private.try_guard_client_mutation(candidate);
  end loop;
  if current_setting('monalyz.client_purge_maintenance', true) is distinct from 'on'
     and exists (
       select 1
       from private.client_purge_entity_manifest entity
       join private.client_purge_operations operation
         on operation.challenge_id = entity.challenge_id
       where operation.consumed_at is not null
         and (
           (
             entity.entity_type = old_data ->> 'entity_type'
             and entity.entity_id = private.uuid_or_null(
               old_data ->> 'entity_id'
             )::text
           )
           or (
             entity.entity_type = new_data ->> 'entity_type'
             and entity.entity_id = private.uuid_or_null(
               new_data ->> 'entity_id'
             )::text
           )
         )
     ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if current_setting('monalyz.client_purge_maintenance', true) is distinct from 'on'
     and exists (
       select 1 from private.client_purge_operations operation
       where operation.consumed_at is not null
         and exists (
           select 1
           from jsonb_array_elements_text(operation.support_email_manifest)
             as support_email(value)
           where support_email.value in (
             lower(btrim(old_data #>> '{metadata,email}')),
             lower(btrim(old_data #>> '{metadata,recipient_email}')),
             lower(btrim(old_data #>> '{metadata,user_email}')),
             lower(btrim(old_data #>> '{metadata,target_email}')),
             lower(btrim(new_data #>> '{metadata,email}')),
             lower(btrim(new_data #>> '{metadata,recipient_email}')),
             lower(btrim(new_data #>> '{metadata,user_email}')),
             lower(btrim(new_data #>> '{metadata,target_email}'))
           )
             and not exists (
               select 1
               from public.support_user_identities active_identity
               where active_identity.normalized_email = support_email.value
                 and active_identity.user_id <> operation.target_user_id
             )
         )
     ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "private"."guard_support_transcript_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  old_data jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  new_data jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  old_owner_id uuid := private.uuid_or_null(old_data ->> 'user_id');
  new_owner_id uuid := private.uuid_or_null(new_data ->> 'user_id');
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if old_owner_id is not null
     and (new_owner_id is null or old_owner_id::text <= new_owner_id::text) then
    perform private.try_guard_client_mutation(old_owner_id);
  end if;
  if new_owner_id is not null and new_owner_id is distinct from old_owner_id then
    perform private.try_guard_client_mutation(new_owner_id);
  end if;
  if old_owner_id is not null and new_owner_id is not null
     and old_owner_id::text > new_owner_id::text then
    perform private.try_guard_client_mutation(old_owner_id);
  end if;
  if current_setting('monalyz.client_purge_maintenance', true) is distinct from 'on'
     and exists (
       select 1
       from private.client_purge_operations operation
       where operation.consumed_at is not null
         and (
           exists (
             select 1
             from jsonb_array_elements_text(operation.support_email_manifest)
               as support_email(value)
             where support_email.value in (
               lower(btrim(old_data ->> 'visitor_email_normalized')),
               lower(btrim(old_data ->> 'notification_email')),
               lower(btrim(new_data ->> 'visitor_email_normalized')),
               lower(btrim(new_data ->> 'notification_email'))
             )
               and not exists (
                 select 1
                 from public.support_user_identities active_identity
                 where active_identity.normalized_email = support_email.value
                   and active_identity.user_id <> operation.target_user_id
               )
           )
         )
     ) then
    raise exception 'PURGE_TARGET_FROZEN' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."admin_begin_client_purge"("p_actor_id" "uuid", "p_target_user_id" "uuid", "p_challenge_id" "uuid", "p_challenge_digest" "text", "p_target_email_digest" "text", "p_idempotency_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  operation private.client_purge_operations;
  frozen_profile_count integer;
  current_target_email text;
  support_emails text[];
  current_scope_digest text;
  evidence_path text;
begin
  perform private.require_active_purge_admin(p_actor_id);

  if p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;

  select * into operation
  from private.client_purge_operations
  where challenge_id = p_challenge_id
  for update;

  if not found
     or operation.actor_id is distinct from p_actor_id
     or operation.target_user_id is distinct from p_target_user_id
     or operation.challenge_digest is distinct from p_challenge_digest
     or operation.target_email_digest is distinct from p_target_email_digest
     or operation.idempotency_key is distinct from p_idempotency_key then
    raise exception 'PURGE_CHALLENGE_INVALID' using errcode = '42501';
  end if;
  if operation.status <> 'preview'
     and operation.stage in ('storage', 'database', 'waiting_sweep', 'storage_sweep')
     and exists (
       select 1 from public.profiles
       where user_id = p_target_user_id and access_status <> 'frozen'
     ) then
    raise exception 'PURGE_TARGET_NOT_FROZEN' using errcode = '55000';
  end if;

  if operation.status = 'preview' then
    if operation.expires_at <= statement_timestamp() then
      raise exception 'PURGE_CHALLENGE_EXPIRED' using errcode = '22023';
    end if;
    if operation.storage_cycle_stage is distinct from 'preview'
       or operation.storage_phase is distinct from 'complete' then
      raise exception 'PURGE_PREVIEW_INCOMPLETE' using errcode = '55000';
    end if;
    select users.email into current_target_email
    from auth.users users where users.id = p_target_user_id for update;
    if not found then
      raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0002';
    end if;
    if current_target_email is null
       or current_target_email is distinct from operation.target_email then
      raise exception 'PURGE_TARGET_EMAIL_CHANGED' using errcode = '55000';
    end if;

    for evidence_path in
      select target_path.object_path
      from (
        select execution.evidence_object_path as object_path
        from public.external_transfer_executions execution
        join public.transfer_intents transfer on transfer.id = execution.transfer_id
        where transfer.owner_id = p_target_user_id
        union
        select funding.evidence_object_path
        from public.external_loan_fundings funding
        join public.loan_applications loan on loan.id = funding.loan_id
        where loan.owner_id = p_target_user_id
      ) target_path
      order by target_path.object_path
    loop
      perform pg_catalog.pg_advisory_xact_lock(
        private.client_purge_storage_lock_key(
          'external-execution-evidence', evidence_path
        )
      );
    end loop;

    if exists (
      with target_path as (
        select execution.evidence_object_path as object_path
        from public.external_transfer_executions execution
        join public.transfer_intents transfer on transfer.id = execution.transfer_id
        where transfer.owner_id = p_target_user_id
        union
        select funding.evidence_object_path
        from public.external_loan_fundings funding
        join public.loan_applications loan on loan.id = funding.loan_id
        where loan.owner_id = p_target_user_id
      )
      select 1
      from target_path
      where exists (
        select 1
        from public.external_transfer_executions execution
        join public.transfer_intents transfer on transfer.id = execution.transfer_id
        where transfer.owner_id <> p_target_user_id
          and execution.evidence_object_path = target_path.object_path
      ) or exists (
        select 1
        from public.external_loan_fundings funding
        join public.loan_applications loan on loan.id = funding.loan_id
        where loan.owner_id <> p_target_user_id
          and funding.evidence_object_path = target_path.object_path
      )
    ) then
      raise exception 'PURGE_PREVIEW_STALE' using errcode = '55000';
    end if;

    select coalesce(array_agg(email order by email), array[]::text[])
    into support_emails
    from (
      select candidate.email
      from (
        select identity.normalized_email as email
        from public.support_user_identities identity
        where identity.user_id = p_target_user_id
        union
        select lower(btrim(current_target_email))
      ) candidate
      where not exists (
        select 1
        from public.support_user_identities active_identity
        where active_identity.normalized_email = candidate.email
          and active_identity.user_id <> p_target_user_id
      )
    ) unambiguous_emails;
    perform private.refresh_client_purge_entity_manifest(
      p_challenge_id, p_target_user_id
    );
    current_scope_digest := private.client_purge_scope_digest(
      p_challenge_id, p_target_user_id, to_jsonb(support_emails)
    );
    if operation.scope_digest is null
       or operation.scope_digest is distinct from current_scope_digest then
      raise exception 'PURGE_PREVIEW_STALE' using errcode = '55000';
    end if;
    update public.profiles
    set access_status = 'frozen',
        access_status_reason = 'Suppression administrative sécurisée en cours.'
    where user_id = p_target_user_id;
    get diagnostics frozen_profile_count = row_count;
    if frozen_profile_count > 1 then
      raise exception 'PURGE_PROFILE_CARDINALITY_INVALID' using errcode = '21000';
    end if;
    update private.client_purge_operations
    set status = 'running', stage = 'storage', consumed_at = statement_timestamp(),
        support_email_manifest = to_jsonb(support_emails),
        scope_digest = current_scope_digest,
        retry_after = statement_timestamp() + interval '5 minutes',
        last_error_code = null, updated_at = statement_timestamp()
    where challenge_id = p_challenge_id;

    -- Discard every preview-era relational path while the target's exclusive
    -- owner lock is held. The bounded Storage phase will repopulate only
    -- current references after the account has been frozen.
    perform private.initialize_client_purge_storage_cycle(
      p_challenge_id, 'storage', p_target_user_id
    );

    return jsonb_build_object(
      'status', 'running',
      'stage', 'storage',
      'sweepNotBefore', null
    );
  end if;

  if operation.status = 'waiting_sweep' then
    if operation.sweep_not_before > statement_timestamp() then
      return jsonb_build_object(
        'status', 'waiting_sweep',
        'stage', 'waiting_sweep',
        'sweepNotBefore', operation.sweep_not_before
      );
    end if;
    update private.client_purge_operations
    set status = 'running', stage = 'storage_sweep',
        retry_after = statement_timestamp() + interval '5 minutes',
        last_error_code = null, updated_at = statement_timestamp()
    where challenge_id = p_challenge_id;
    return jsonb_build_object(
      'status', 'running',
      'stage', 'storage_sweep',
      'sweepNotBefore', operation.sweep_not_before
    );
  end if;

  -- The challenge is one-use, but the exact idempotent operation can resume.
  if operation.status = 'running'
     and operation.retry_after is not null
     and operation.retry_after > statement_timestamp() then
    raise exception 'PURGE_OPERATION_IN_PROGRESS' using errcode = '55000';
  end if;
  update private.client_purge_operations
  set status = 'running',
      retry_after = statement_timestamp() + interval '5 minutes',
      last_error_code = null,
      updated_at = statement_timestamp()
  where challenge_id = p_challenge_id;
  return jsonb_build_object(
    'status', 'running',
    'stage', operation.stage,
    'sweepNotBefore', operation.sweep_not_before
  );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."admin_finalize_client_purge"("p_actor_id" "uuid", "p_target_user_id" "uuid", "p_challenge_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  operation private.client_purge_operations;
  residual record;
  residuals jsonb;
begin
  perform private.require_active_purge_admin(p_actor_id);
  perform pg_catalog.pg_advisory_xact_lock(
    private.client_purge_lock_key(p_target_user_id)
  );
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  select * into operation
  from private.client_purge_operations
    where challenge_id = p_challenge_id
      and actor_id = p_actor_id
      and target_user_id = p_target_user_id
      and stage = 'verify'
      and consumed_at is not null
  for update;
  if not found then
    raise exception 'PURGE_FINALIZE_STAGE_INVALID' using errcode = '55000';
  end if;
  if operation.storage_cycle_stage <> 'verify'
     or operation.storage_phase <> 'complete' then
    raise exception 'PURGE_STORAGE_VERIFICATION_INCOMPLETE' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('monalyz.client_purge_maintenance', 'on', true);

  -- Auth deletion retires (but intentionally does not erase) support identity
  -- history. Remove any identity recreated during the signed-URL grace period,
  -- and every transcript linked to the current or historical e-mail manifest.
  with candidate_emails as (
    select jsonb_array_elements_text(operation.support_email_manifest) as email
    union
    select identity.normalized_email
    from public.support_user_identities identity
    where identity.user_id = p_target_user_id
  ), support_emails as (
    select candidate.email
    from candidate_emails candidate
    where not exists (
      select 1
      from public.support_user_identities active_identity
      where active_identity.normalized_email = candidate.email
        and active_identity.user_id <> p_target_user_id
    )
  )
  delete from public.support_transcripts transcript
  where transcript.user_id = p_target_user_id
     or (
       transcript.user_id is null
       and (
         transcript.visitor_email_normalized in (select email from support_emails)
         or transcript.notification_email in (select email from support_emails)
       )
       and not exists (
         select 1 from public.support_user_identities active_identity
         where active_identity.user_id <> p_target_user_id
           and active_identity.normalized_email in (
             transcript.visitor_email_normalized,
             transcript.notification_email
           )
       )
     );
  delete from public.support_user_identities where user_id = p_target_user_id;
  -- Foreign parents are never deleted merely because they reused a quarantined
  -- path. Such a row is reported by residual verification and must be resolved
  -- explicitly before the purge can complete.

  delete from public.audit_events event
  where private.audit_event_matches_client(
    event.actor_id, event.entity_type, event.entity_id, event.metadata,
    p_target_user_id, p_challenge_id
  );
  delete from public.kyc_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'kyc_event'
      and entity.entity_id = event.id::text
  );
  delete from public.loan_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'loan_event'
      and entity.entity_id = event.id::text
  );
  delete from public.transfer_events event
  where event.actor_id = p_target_user_id or exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'transfer_event'
      and entity.entity_id = event.id::text
  );
  delete from public.loan_review_checks review
  where exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'loan_review_check'
      and entity.entity_id = review.id::text
  );
  delete from public.transfer_review_checks review
  where exists (
    select 1 from private.client_purge_entity_manifest entity
    where entity.challenge_id = p_challenge_id
      and entity.entity_type = 'transfer_review_check'
      and entity.entity_id = review.id::text
  );

  residuals := private.client_purge_residuals(p_challenge_id, p_target_user_id);
  for residual in select key, value from jsonb_each_text(residuals)
  loop
    if residual.value::bigint <> 0 then
      raise exception 'PURGE_VERIFICATION_FAILED:%=%', residual.key, residual.value
        using errcode = '55000', detail = residuals::text;
    end if;
  end loop;

  delete from private.client_purge_operations
  where challenge_id = p_challenge_id
    and actor_id = p_actor_id
    and target_user_id = p_target_user_id
    and consumed_at is not null;
  return found;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."admin_prepare_client_purge"("p_actor_id" "uuid", "p_target_user_id" "uuid", "p_challenge_digest" "text", "p_target_email_digest" "text", "p_target_email" "text", "p_idempotency_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_challenge_id uuid := gen_random_uuid();
  expiration timestamptz := statement_timestamp() + interval '5 minutes';
  existing_preview private.client_purge_operations;
  impact jsonb;
  storage_references bigint;
  unsafe_storage_references bigint;
  canonical_target_email text;
  support_emails text[];
  current_scope_digest text;
  previous_scope_digest text;
begin
  perform private.require_active_purge_admin(p_actor_id);

  if p_target_user_id is null or p_target_user_id = p_actor_id then
    raise exception 'SELF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff_members where user_id = p_target_user_id) then
    raise exception 'STAFF_PURGE_FORBIDDEN' using errcode = '42501';
  end if;
  select users.email into canonical_target_email
  from auth.users users where users.id = p_target_user_id;
  if not found or canonical_target_email is null then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_challenge_digest is null
     or p_target_email_digest is null
     or p_target_email is null
     or p_challenge_digest !~ '^[0-9a-f]{64}$'
     or p_target_email_digest !~ '^[0-9a-f]{64}$'
     or p_target_email is distinct from canonical_target_email
     or encode(
       extensions.digest(convert_to(p_target_email, 'UTF8'), 'sha256'), 'hex'
     ) is distinct from p_target_email_digest
     or p_idempotency_key is null then
    raise exception 'INVALID_PURGE_CHALLENGE' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_target_user_id::text, 847231)
  );

  select * into existing_preview
  from private.client_purge_operations
  where target_user_id = p_target_user_id
  for update;

  if found and existing_preview.consumed_at is not null then
    raise exception 'PURGE_ALREADY_STARTED' using errcode = '55000';
  end if;

  if found and existing_preview.status = 'preview'
     and existing_preview.expires_at > statement_timestamp() then
    if existing_preview.actor_id = p_actor_id
       and existing_preview.idempotency_key = p_idempotency_key
       and existing_preview.challenge_digest = p_challenge_digest
       and existing_preview.target_email_digest = p_target_email_digest
       and existing_preview.target_email = p_target_email then
      -- Exact retries and lost responses retain the same durable scan cursor.
      v_challenge_id := existing_preview.challenge_id;
      expiration := existing_preview.expires_at;
    else
      raise exception 'PURGE_PREVIEW_EXISTS' using errcode = '55000';
    end if;
  else
    -- Only an expired unconsumed preview may be atomically rotated.
    delete from private.client_purge_operations
    where target_user_id = p_target_user_id
      and status = 'preview'
      and expires_at <= statement_timestamp();

    insert into private.client_purge_operations (
      challenge_id,
      actor_id,
      target_user_id,
      challenge_digest,
      target_email_digest,
      target_email,
      idempotency_key,
      expires_at,
      storage_cycle_stage,
      storage_phase
    ) values (
      v_challenge_id,
      p_actor_id,
      p_target_user_id,
      p_challenge_digest,
      p_target_email_digest,
      p_target_email,
      p_idempotency_key,
      expiration,
      'preview',
      'references'
    );
  end if;

  perform private.refresh_client_purge_entity_manifest(
    v_challenge_id, p_target_user_id
  );

  select
    count(*) filter (where reference.ownership_valid is true),
    count(*) filter (where reference.ownership_valid is not true)
  into storage_references, unsafe_storage_references
  from private.client_purge_storage_references(p_target_user_id) reference;

  canonical_target_email := lower(btrim(canonical_target_email));
  select coalesce(array_agg(email order by email), array[]::text[])
  into support_emails
  from (
    select candidate.email
    from (
      select identity.normalized_email as email
      from public.support_user_identities identity
      where identity.user_id = p_target_user_id
      union
      select canonical_target_email where canonical_target_email is not null
    ) candidate
    where not exists (
      select 1
      from public.support_user_identities active_identity
      where active_identity.normalized_email = candidate.email
        and active_identity.user_id <> p_target_user_id
    )
  ) unambiguous_emails;

  current_scope_digest := private.client_purge_scope_digest(
    v_challenge_id, p_target_user_id, to_jsonb(support_emails)
  );
  select operation.scope_digest into previous_scope_digest
  from private.client_purge_operations operation
  where operation.challenge_id = v_challenge_id;

  if previous_scope_digest is not null
     and previous_scope_digest is distinct from current_scope_digest then
    -- A recovered preview must restart its bounded Storage inventory when the
    -- confirmed relational scope changed. This makes a fresh preview the only
    -- way to consume the challenge after PURGE_PREVIEW_STALE.
    delete from private.client_purge_storage_scan_queue queue
    where queue.challenge_id = v_challenge_id;
    delete from private.client_purge_storage_manifest manifest
    where manifest.challenge_id = v_challenge_id;
    update private.client_purge_operations operation
    set storage_cycle_stage = null,
        storage_phase = 'idle',
        reference_after_bucket = null,
        reference_after_object_path = null,
        reference_claim_token = null,
        reference_claimed_at = null,
        verify_prefix_index = 0,
        prefix_claim_token = null,
        prefix_claimed_at = null,
        ignored_unsafe_storage_references = 0
    where operation.challenge_id = v_challenge_id;
  end if;

  update private.client_purge_operations operation
  set support_email_manifest = to_jsonb(support_emails),
      scope_digest = current_scope_digest,
      updated_at = statement_timestamp()
  where operation.idempotency_key = p_idempotency_key
    and operation.actor_id = p_actor_id
    and operation.target_user_id = p_target_user_id
    and operation.consumed_at is null;

  impact := jsonb_build_object(
    'preservedAdmins', (
      select count(*)
      from public.staff_members staff
      join auth.users users on users.id = staff.user_id
      where staff.role = 'admin'
    ),
    'kycApplications', (select count(*) from public.kyc_applications where owner_id = p_target_user_id),
    'kycDrafts', (select count(*) from public.kyc_drafts where owner_id = p_target_user_id),
    'accounts', (select count(*) from public.financial_positions where owner_id = p_target_user_id),
    'ledgerEntries', (select count(*) from public.financial_ledger_entries where owner_id = p_target_user_id),
    'loans', (select count(*) from public.loan_applications where owner_id = p_target_user_id),
    'transfers', (select count(*) from public.transfer_intents where owner_id = p_target_user_id),
    'documents', (select count(*) from public.official_documents where owner_id = p_target_user_id),
    'notifications', (select count(*) from public.notifications where recipient_id = p_target_user_id),
    'emailOutbox', (
      select count(*) from public.transactional_email_outbox
      where recipient_id = p_target_user_id or claimed_by = p_target_user_id
    ),
    'pushSubscriptions', (select count(*) from public.push_subscriptions where user_id = p_target_user_id),
    'supportIdentities', (select count(*) from public.support_user_identities where user_id = p_target_user_id),
    'supportTranscripts', (
      select count(*) from public.support_transcripts transcript
      where transcript.user_id = p_target_user_id
         or (
           transcript.user_id is null
           and (
             transcript.visitor_email_normalized = any(support_emails)
             or transcript.notification_email = any(support_emails)
           )
           and not exists (
             select 1 from public.support_user_identities active_identity
             where active_identity.user_id <> p_target_user_id
               and active_identity.normalized_email in (
                 transcript.visitor_email_normalized,
                 transcript.notification_email
               )
           )
         )
    ),
    'auditEvents', (
      select count(*) from public.audit_events event
      where private.audit_event_matches_client(
        event.actor_id, event.entity_type, event.entity_id, event.metadata,
        p_target_user_id, v_challenge_id
      )
    ),
    'workflowEvents', (
      (select count(*) from public.kyc_events event
        where event.actor_id = p_target_user_id
          or event.kyc_id in (
            select id from public.kyc_applications where owner_id = p_target_user_id
          ))
      + (select count(*) from public.loan_events event
        where event.actor_id = p_target_user_id
          or event.loan_id in (
            select id from public.loan_applications where owner_id = p_target_user_id
          ))
      + (select count(*) from public.transfer_events event
        where event.actor_id = p_target_user_id
          or event.transfer_id in (
            select id from public.transfer_intents where owner_id = p_target_user_id
          ))
    ),
    'externalExecutions', (
      (select count(*) from public.external_transfer_executions execution
        join public.transfer_intents transfer on transfer.id = execution.transfer_id
        where transfer.owner_id = p_target_user_id)
      + (select count(*) from public.external_loan_fundings funding
        join public.loan_applications loan on loan.id = funding.loan_id
        where loan.owner_id = p_target_user_id)
    ),
    'profileRecords', (select count(*) from public.profiles where user_id = p_target_user_id),
    'authRecords', 1,
    'storageReferences', storage_references,
    'unsafeStorageReferences', unsafe_storage_references,
    'storageObjects', (
      select count(*) from private.client_purge_storage_manifest manifest
      where manifest.challenge_id = v_challenge_id
    )
  );

  return jsonb_build_object(
    'challengeId', v_challenge_id,
    'expiresAt', expiration,
    'inventoryComplete', (
      select operation.storage_phase = 'complete'
      from private.client_purge_operations operation
      where operation.challenge_id = v_challenge_id
    ),
    'impact', impact
  );
end;
$_$;
