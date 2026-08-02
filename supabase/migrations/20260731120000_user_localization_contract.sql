-- Stable localization contracts for customer-facing content.

alter table public.notifications
  add column if not exists message_key text,
  add column if not exists message_params jsonb not null default '{}'::jsonb;

create or replace function private.normalize_notification_localization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  searchable text := lower(coalesce(new.title, '') || ' ' || coalesce(new.message, ''));
begin
  if new.message_key is null or new.message_key not in (
    'generic_info',
    'transfer_submitted', 'transfer_approved', 'transfer_completed', 'transfer_rejected', 'transfer_failed',
    'loan_submitted', 'loan_approved', 'loan_disbursed', 'loan_rejected', 'loan_failed',
    'kyc_submitted', 'kyc_information_requested', 'kyc_resubmitted', 'kyc_approved', 'kyc_rejected',
    'document_available'
  ) then
    new.message_key := case
      when new.notification_type = 'info' and searchable like '%document%' then 'document_available'
      when new.notification_type = 'transfer' and searchable ~ '(effectué|exécuté|completed|settlement confirmed|ausgeführt|realizado|ejecutad)' then 'transfer_completed'
      when new.notification_type = 'transfer' and searchable ~ '(refus|reject|abgelehnt|rechaz)' then 'transfer_rejected'
      when new.notification_type = 'transfer' and searchable ~ '(échec|échoué|failed|fehlgeschlagen|fallid|no se pudo)' then 'transfer_failed'
      when new.notification_type = 'transfer' and searchable ~ '(validé|approved|genehmigt|aprob)' then 'transfer_approved'
      when new.notification_type = 'transfer' then 'transfer_submitted'
      when new.notification_type = 'loan' and searchable ~ '(décaissé|versé|paid|disbursed|ausgezahlt|abonado|desembols)' then 'loan_disbursed'
      when new.notification_type = 'loan' and searchable ~ '(refus|reject|abgelehnt|rechaz)' then 'loan_rejected'
      when new.notification_type = 'loan' and searchable ~ '(échec|échoué|failed|fehlgeschlagen|fallid|no se pudo)' then 'loan_failed'
      when new.notification_type = 'loan' and searchable ~ '(validé|approved|genehmigt|aprob)' then 'loan_approved'
      when new.notification_type = 'loan' then 'loan_submitted'
      when new.notification_type = 'kyc' and searchable ~ '(complément|additional|zusätz|adicional|action requise|required)' then 'kyc_information_requested'
      when new.notification_type = 'kyc' and searchable ~ '(correction|resubmi|erneut|reenvi)' then 'kyc_resubmitted'
      when new.notification_type = 'kyc' and searchable ~ '(approuv|confirm|approved|bestätigt|aprob)' then 'kyc_approved'
      when new.notification_type = 'kyc' and searchable ~ '(rejet|reject|abgelehnt|rechaz)' then 'kyc_rejected'
      when new.notification_type = 'kyc' then 'kyc_submitted'
      else 'generic_info'
    end;
  end if;

  if new.message_params is null or jsonb_typeof(new.message_params) <> 'object' then
    new.message_params := '{}'::jsonb;
  end if;

  -- Known events keep canonical French audit copy. Unknown historical entries
  -- retain their original audit text and are localized generically by clients.
  if new.message_key <> 'generic_info' then
    new.title := case new.message_key
      when 'transfer_submitted' then 'Virement enregistré'
      when 'transfer_approved' then 'Virement approuvé'
      when 'transfer_completed' then 'Virement exécuté'
      when 'transfer_rejected' then 'Virement refusé'
      when 'transfer_failed' then 'Virement non exécuté'
      when 'loan_submitted' then 'Demande de prêt enregistrée'
      when 'loan_approved' then 'Prêt approuvé'
      when 'loan_disbursed' then 'Prêt versé'
      when 'loan_rejected' then 'Demande de prêt refusée'
      when 'loan_failed' then 'Versement du prêt interrompu'
      when 'kyc_submitted' then 'Dossier d’identité transmis'
      when 'kyc_information_requested' then 'Informations complémentaires requises'
      when 'kyc_resubmitted' then 'Corrections transmises'
      when 'kyc_approved' then 'Identité vérifiée'
      when 'kyc_rejected' then 'Vérification d’identité non aboutie'
      when 'document_available' then 'Nouveau document disponible'
    end;
    new.message := case new.message_key
      when 'transfer_submitted' then 'L’instruction de virement a été transmise pour vérification.'
      when 'transfer_approved' then 'Le virement a été approuvé pour exécution.'
      when 'transfer_completed' then 'Le virement a été exécuté avec succès.'
      when 'transfer_rejected' then 'L’instruction de virement n’a pas été acceptée.'
      when 'transfer_failed' then 'Le virement n’a pas pu être exécuté.'
      when 'loan_submitted' then 'La demande de prêt a été transmise pour analyse.'
      when 'loan_approved' then 'La demande de prêt a été approuvée.'
      when 'loan_disbursed' then 'Les fonds du prêt ont été crédités sur le compte.'
      when 'loan_rejected' then 'La demande de prêt n’a pas été acceptée.'
      when 'loan_failed' then 'Le versement du prêt n’a pas pu être finalisé.'
      when 'kyc_submitted' then 'Le dossier d’identité a été transmis pour vérification.'
      when 'kyc_information_requested' then 'Des éléments complémentaires sont nécessaires pour vérifier l’identité.'
      when 'kyc_resubmitted' then 'Les corrections ont été transmises pour vérification.'
      when 'kyc_approved' then 'La vérification de l’identité est terminée.'
      when 'kyc_rejected' then 'Le dossier d’identité n’a pas pu être validé.'
      when 'document_available' then 'Un nouveau document officiel est disponible dans l’espace client.'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_normalize_localization on public.notifications;
create trigger notifications_normalize_localization
before insert or update of title, message, notification_type, message_key, message_params
on public.notifications
for each row execute function private.normalize_notification_localization();

update public.notifications
set message_key = null,
    message_params = coalesce(message_params, '{}'::jsonb);

alter table public.notifications
  alter column message_key set not null,
  add constraint notifications_message_key_check check (message_key in (
    'generic_info',
    'transfer_submitted', 'transfer_approved', 'transfer_completed', 'transfer_rejected', 'transfer_failed',
    'loan_submitted', 'loan_approved', 'loan_disbursed', 'loan_rejected', 'loan_failed',
    'kyc_submitted', 'kyc_information_requested', 'kyc_resubmitted', 'kyc_approved', 'kyc_rejected',
    'document_available'
  )),
  add constraint notifications_message_params_check check (jsonb_typeof(message_params) = 'object');

alter table public.loan_applications
  add column if not exists motive_code text;

update public.loan_applications
set motive_code = case lower(trim(motive))
  when 'prêt personnel' then 'personal'
  when 'projet personnel' then 'personal'
  when 'projet immobilier' then 'real_estate'
  when 'immobilier' then 'real_estate'
  when 'achat véhicule' then 'vehicle'
  when 'achat véhicule / auto' then 'vehicle'
  when 'auto' then 'vehicle'
  when 'travaux' then 'renovation'
  when 'travaux / rénovation' then 'renovation'
  when 'trésorerie entreprise' then 'business_cashflow'
  else 'other'
end
where motive_code is null;

alter table public.loan_applications
  alter column motive_code set not null,
  add constraint loan_applications_motive_code_check check (
    motive_code in ('personal', 'real_estate', 'vehicle', 'renovation', 'business_cashflow', 'other')
  );

drop function if exists public.submit_loan_application(
  bigint, text, integer, bigint, numeric, text, jsonb, uuid
);

create function public.submit_loan_application(
  p_requested_amount_minor bigint,
  p_currency text,
  p_duration_months integer,
  p_indicative_monthly_payment_minor bigint,
  p_indicative_annual_rate numeric,
  p_motive_code text,
  p_document_object_paths jsonb,
  p_idempotency_key uuid
) returns public.loan_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  loan_row public.loan_applications;
  new_loan_id uuid := gen_random_uuid();
  generated_reference text;
  canonical_motive text;
begin
  if p_motive_code not in ('personal', 'real_estate', 'vehicle', 'renovation', 'business_cashflow', 'other') then
    raise exception 'INVALID_LOAN_MOTIVE_CODE' using errcode = '22023';
  end if;
  if p_document_object_paths is null or jsonb_typeof(p_document_object_paths) <> 'array' then
    raise exception 'INVALID_LOAN_DOCUMENTS' using errcode = '22023';
  end if;

  canonical_motive := case p_motive_code
    when 'personal' then 'Projet personnel'
    when 'real_estate' then 'Projet immobilier'
    when 'vehicle' then 'Achat d’un véhicule'
    when 'renovation' then 'Travaux et rénovation'
    when 'business_cashflow' then 'Trésorerie professionnelle'
    else 'Autre'
  end;
  generated_reference := 'Monalyz-' || to_char(now(), 'YYYYMMDD') || '-' || upper(replace(new_loan_id::text, '-', ''));

  insert into public.loan_applications (
    id, owner_id, idempotency_key, reference, requested_amount_minor, currency,
    duration_months, indicative_monthly_payment_minor, indicative_annual_rate,
    motive, motive_code, document_object_paths
  ) values (
    new_loan_id, caller_id, p_idempotency_key, generated_reference,
    p_requested_amount_minor, upper(p_currency), p_duration_months,
    p_indicative_monthly_payment_minor, p_indicative_annual_rate,
    canonical_motive, p_motive_code, p_document_object_paths
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning * into loan_row;

  if loan_row.id is null then
    select * into loan_row from public.loan_applications
    where owner_id = caller_id and idempotency_key = p_idempotency_key;
    return loan_row;
  end if;

  insert into public.loan_review_checks (loan_id, check_kind)
  select loan_row.id, check_kind
  from unnest(array['dual_review', 'escalation', 'compliance', 'final_authorization']) as check_kind;

  insert into public.loan_events (loan_id, actor_id, event_type, to_status)
  values (loan_row.id, caller_id, 'submitted', 'submitted');

  insert into public.notifications (
    recipient_id, title, message, notification_type, message_key, message_params
  ) values (
    caller_id,
    'Demande de prêt enregistrée',
    'La demande de prêt a été transmise pour analyse.',
    'loan',
    'loan_submitted',
    jsonb_build_object('reference', loan_row.reference)
  );
  return loan_row;
end;
$$;

revoke all on function public.submit_loan_application(bigint, text, integer, bigint, numeric, text, jsonb, uuid) from public;
grant execute on function public.submit_loan_application(bigint, text, integer, bigint, numeric, text, jsonb, uuid) to authenticated;

update public.kyc_applications
set correction_reason_code = 'other'
where status in ('needs_information', 'rejected')
  and correction_reason_code is null;

alter table public.official_documents
  add column if not exists localization_revision integer,
  add column if not exists supersedes_document_id uuid;

update public.official_documents
set localization_revision = 1
where localization_revision is null;

alter table public.official_documents
  alter column localization_revision set default 2,
  alter column localization_revision set not null,
  add constraint official_documents_localization_revision_check check (localization_revision > 0),
  add constraint official_documents_supersedes_document_id_key unique (supersedes_document_id),
  add constraint official_documents_supersedes_document_id_fkey
    foreign key (supersedes_document_id) references public.official_documents(id) on delete restrict;

create or replace function private.protect_official_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_catalog.current_setting('monalyz.allow_official_document_maintenance', true) is distinct from 'on' then
      raise exception 'OFFICIAL_DOCUMENT_RETENTION_REQUIRED' using errcode = '55000';
    end if;
    return old;
  end if;

  if new.owner_id <> old.owner_id
     or new.account_id is distinct from old.account_id
     or new.transfer_id is distinct from old.transfer_id
     or new.loan_id is distinct from old.loan_id
     or new.document_number <> old.document_number
     or new.document_type <> old.document_type
     or new.title <> old.title
     or new.language <> old.language
     or new.period_start is distinct from old.period_start
     or new.period_end is distinct from old.period_end
     or new.version <> old.version
     or new.snapshot <> old.snapshot
     or new.snapshot_hash <> old.snapshot_hash
     or new.issued_by <> old.issued_by
     or new.requested_at <> old.requested_at
     or new.is_demo <> old.is_demo
     or new.idempotency_key <> old.idempotency_key
     or new.localization_revision <> old.localization_revision
     or new.supersedes_document_id is distinct from old.supersedes_document_id
     or new.created_at <> old.created_at then
    raise exception 'OFFICIAL_DOCUMENT_SNAPSHOT_IS_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.create_official_document_localized_reissue(
  p_source_document_id uuid,
  p_idempotency_key uuid
) returns public.official_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_role text := coalesce((select auth.jwt() ->> 'role'), '');
  source_row public.official_documents;
  replacement_row public.official_documents;
  replacement_id uuid := gen_random_uuid();
  replacement_title text;
  replacement_snapshot jsonb;
  replacement_version integer;
begin
  if worker_role <> 'service_role' then
    raise exception 'OFFICIAL_DOCUMENT_WORKER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  select * into replacement_row from public.official_documents
  where supersedes_document_id = p_source_document_id;
  if found then return replacement_row; end if;

  select * into source_row from public.official_documents
  where id = p_source_document_id for update;
  if not found then raise exception 'OFFICIAL_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if source_row.status <> 'issued' or source_row.localization_revision >= 2 then
    raise exception 'OFFICIAL_DOCUMENT_NOT_REISSUABLE' using errcode = '55000';
  end if;

  replacement_title := case source_row.language
    when 'en' then case source_row.document_type when 'bank_details' then 'Bank account details' when 'account_statement' then 'Account statement' when 'balance_certificate' then 'Balance certificate' when 'transfer_confirmation' then 'Transfer confirmation' when 'loan_disbursement_confirmation' then 'Loan disbursement confirmation' else 'Loan decision' end
    when 'de' then case source_row.document_type when 'bank_details' then 'Bankverbindung' when 'account_statement' then 'Kontoauszug' when 'balance_certificate' then 'Saldenbestätigung' when 'transfer_confirmation' then 'Überweisungsbestätigung' when 'loan_disbursement_confirmation' then 'Bestätigung der Kreditauszahlung' else 'Kreditentscheidung' end
    when 'es' then case source_row.document_type when 'bank_details' then 'Datos bancarios' when 'account_statement' then 'Estado de cuenta' when 'balance_certificate' then 'Certificado de saldo' when 'transfer_confirmation' then 'Confirmación de transferencia' when 'loan_disbursement_confirmation' then 'Confirmación de desembolso del préstamo' else 'Decisión de préstamo' end
    else case source_row.document_type when 'bank_details' then 'Relevé d’identité bancaire' when 'account_statement' then 'Relevé de compte' when 'balance_certificate' then 'Attestation de solde' when 'transfer_confirmation' then 'Confirmation de virement' when 'loan_disbursement_confirmation' then 'Confirmation de versement du prêt' else 'Décision de prêt' end
  end;
  replacement_snapshot := source_row.snapshot || jsonb_build_object(
    'schemaVersion', 2, 'title', replacement_title, 'language', source_row.language
  );
  select coalesce(max(version), 0) + 1 into replacement_version
  from public.official_documents
  where owner_id = source_row.owner_id
    and document_type = source_row.document_type
    and account_id is not distinct from source_row.account_id
    and transfer_id is not distinct from source_row.transfer_id
    and loan_id is not distinct from source_row.loan_id;

  insert into public.official_documents (
    id, owner_id, account_id, transfer_id, loan_id, document_number,
    document_type, title, language, period_start, period_end, version, status,
    snapshot, snapshot_hash, issued_by, is_demo, idempotency_key,
    localization_revision, supersedes_document_id
  ) values (
    replacement_id, source_row.owner_id, source_row.account_id, source_row.transfer_id,
    source_row.loan_id, 'MON-' || to_char(now(), 'YYYY') || '-' || upper(replace(replacement_id::text, '-', '')),
    source_row.document_type, replacement_title, source_row.language,
    source_row.period_start, source_row.period_end, replacement_version, 'pending',
    replacement_snapshot,
    encode(extensions.digest(convert_to(replacement_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
    source_row.issued_by, source_row.is_demo, p_idempotency_key, 2, source_row.id
  ) returning * into replacement_row;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    source_row.issued_by, 'official_document_localization_reissue_created', 'official_document', replacement_row.id,
    jsonb_build_object('supersedes_document_id', source_row.id, 'localization_revision', 2)
  );
  return replacement_row;
end;
$$;

create or replace function public.finalize_official_document_localized_reissue(
  p_replacement_document_id uuid
) returns public.official_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_role text := coalesce((select auth.jwt() ->> 'role'), '');
  replacement_row public.official_documents;
  source_row public.official_documents;
begin
  if worker_role <> 'service_role' then
    raise exception 'OFFICIAL_DOCUMENT_WORKER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  select * into replacement_row from public.official_documents
  where id = p_replacement_document_id for update;
  if not found or replacement_row.supersedes_document_id is null or replacement_row.status <> 'issued' then
    raise exception 'OFFICIAL_DOCUMENT_REISSUE_NOT_FINALIZABLE' using errcode = '55000';
  end if;
  select * into source_row from public.official_documents
  where id = replacement_row.supersedes_document_id for update;
  if source_row.status = 'revoked' then return source_row; end if;
  if source_row.status <> 'issued' then
    raise exception 'OFFICIAL_DOCUMENT_SOURCE_NOT_ISSUED' using errcode = '55000';
  end if;
  update public.official_documents set
    status = 'revoked', revoked_by = source_row.issued_by, revoked_at = now(),
    revocation_reason = 'Remplacé par une version localisée vérifiée.'
  where id = source_row.id returning * into source_row;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    source_row.issued_by, 'official_document_localization_reissue_finalized', 'official_document', source_row.id,
    jsonb_build_object('replacement_document_id', replacement_row.id, 'replacement_content_hash', replacement_row.content_hash)
  );
  return source_row;
end;
$$;

revoke all on function public.create_official_document_localized_reissue(uuid, uuid) from public;
grant execute on function public.create_official_document_localized_reissue(uuid, uuid) to service_role;
revoke all on function public.finalize_official_document_localized_reissue(uuid) from public;
grant execute on function public.finalize_official_document_localized_reissue(uuid) to service_role;

revoke all on function private.normalize_notification_localization() from public;
