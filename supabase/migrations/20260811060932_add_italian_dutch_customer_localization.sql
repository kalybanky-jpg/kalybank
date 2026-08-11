-- Extend every persisted customer-language contract to Italian and Dutch.
-- Administrative interfaces and audit copy remain French by design.

alter table public.profiles
drop constraint if exists profiles_preferred_language_allowed;

alter table public.profiles
add constraint profiles_preferred_language_allowed
check (preferred_language in ('fr', 'en', 'de', 'es', 'it', 'nl'))
not valid;

alter table public.profiles
validate constraint profiles_preferred_language_allowed;

alter table public.kyc_drafts
drop constraint if exists kyc_drafts_preferred_language_check;

alter table public.kyc_drafts
add constraint kyc_drafts_preferred_language_check
check (preferred_language in ('fr', 'en', 'de', 'es', 'it', 'nl'))
not valid;

alter table public.kyc_drafts
validate constraint kyc_drafts_preferred_language_check;

alter table public.official_documents
drop constraint if exists official_documents_language_check;

alter table public.official_documents
add constraint official_documents_language_check
check (language in ('fr', 'en', 'de', 'es', 'it', 'nl'))
not valid;

alter table public.official_documents
validate constraint official_documents_language_check;

-- raw_user_meta_data is user-controlled. It is used only after strict
-- normalization against the non-authorizing language/currency allowlists.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_currency text;
begin
  signup_currency := upper(trim(coalesce(
    new.raw_user_meta_data ->> 'base_currency',
    new.raw_user_meta_data ->> 'preferred_currency',
    ''
  )));

  if signup_currency = '' then
    raise exception 'SIGNUP_CURRENCY_REQUIRED' using errcode = '22023';
  end if;

  if signup_currency not in ('EUR', 'USD', 'CAD', 'CHF', 'GBP') then
    raise exception 'SIGNUP_CURRENCY_UNSUPPORTED' using errcode = '22023';
  end if;

  insert into public.profiles (
    user_id,
    email,
    display_name,
    base_currency,
    preferred_currency,
    preferred_language
  )
  values (
    new.id,
    coalesce(new.email, ''),
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')),
    signup_currency,
    signup_currency,
    case
      when new.raw_user_meta_data ->> 'preferred_language'
        in ('fr', 'en', 'de', 'es', 'it', 'nl')
      then new.raw_user_meta_data ->> 'preferred_language'
      else 'fr'
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user()
from public, anon, authenticated;
grant execute on function private.handle_new_user()
to service_role;

create or replace function public.save_kyc_draft(
  p_current_step integer,
  p_payload jsonb,
  p_document_object_paths jsonb,
  p_preferred_language text
)
returns public.kyc_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_active_user();
  draft_row public.kyc_drafts;
begin
  if p_current_step not between 0 and 8
     or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_document_object_paths, '{}'::jsonb)) <> 'object'
     or p_preferred_language not in ('fr', 'en', 'de', 'es', 'it', 'nl') then
    raise exception 'INVALID_KYC_DRAFT' using errcode = '22023';
  end if;

  insert into public.kyc_drafts (
    owner_id,
    current_step,
    payload,
    document_object_paths,
    preferred_language
  )
  values (
    caller_id,
    p_current_step,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_document_object_paths, '{}'::jsonb),
    p_preferred_language
  )
  on conflict (owner_id) do update
  set
    current_step = excluded.current_step,
    payload = excluded.payload,
    document_object_paths = excluded.document_object_paths,
    preferred_language = excluded.preferred_language
  returning * into draft_row;

  return draft_row;
end;
$$;

revoke all on function public.save_kyc_draft(integer, jsonb, jsonb, text)
from public, anon, authenticated;
grant execute on function public.save_kyc_draft(integer, jsonb, jsonb, text)
to authenticated, service_role;

-- Preserve the large audited official-document issuer byte-for-byte and
-- replace only its customer-language allowlist. The migration fails closed if
-- an earlier migration has changed the expected definition.
do $migration$
declare
  previous_definition text;
  updated_definition text;
  legacy_allowlist constant text := $old$('fr', 'en', 'de', 'es')$old$;
  expanded_allowlist constant text := $new$('fr', 'en', 'de', 'es', 'it', 'nl')$new$;
  legacy_occurrences integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.branch_manager_issue_official_document(uuid,uuid,uuid,uuid,text,text,text,date,date,uuid)'::regprocedure
  )
  into previous_definition;

  if previous_definition is null then
    raise exception 'OFFICIAL_DOCUMENT_ISSUER_MISSING'
      using errcode = '55000';
  end if;

  legacy_occurrences := (
    pg_catalog.char_length(previous_definition)
    - pg_catalog.char_length(
      pg_catalog.replace(previous_definition, legacy_allowlist, '')
    )
  ) / pg_catalog.char_length(legacy_allowlist);

  if legacy_occurrences <> 1 then
    raise exception 'OFFICIAL_DOCUMENT_LANGUAGE_ALLOWLIST_REWRITE_FAILED'
      using errcode = '55000';
  end if;

  updated_definition := pg_catalog.replace(
    previous_definition,
    legacy_allowlist,
    expanded_allowlist
  );

  if updated_definition = previous_definition
     or pg_catalog.strpos(updated_definition, expanded_allowlist) = 0
     or pg_catalog.strpos(updated_definition, legacy_allowlist) > 0 then
    raise exception 'OFFICIAL_DOCUMENT_LANGUAGE_ALLOWLIST_REWRITE_FAILED'
      using errcode = '55000';
  end if;

  execute updated_definition;
end;
$migration$;

revoke all on function public.branch_manager_issue_official_document(
  uuid, uuid, uuid, uuid, text, text, text, date, date, uuid
)
from public, anon, authenticated;
grant execute on function public.branch_manager_issue_official_document(
  uuid, uuid, uuid, uuid, text, text, text, date, date, uuid
)
to authenticated, service_role;

-- KYC notifications now carry a deterministic localization contract at the
-- source. Their persisted title/message remain canonical French audit text;
-- clients and delivery workers localize message_key at render time.
create or replace function private.enqueue_kyc_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_address text;
  title_text text;
  message_text text;
  message_key_text text;
  action_text text;
  message_parameters jsonb;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  message_key_text := case new.status
    when 'submitted' then 'kyc_submitted'
    when 'needs_information' then 'kyc_information_requested'
    when 'resubmitted' then 'kyc_resubmitted'
    when 'approved' then 'kyc_approved'
    when 'rejected' then 'kyc_rejected'
    else null
  end;
  if message_key_text is null then
    return new;
  end if;

  select email
  into email_address
  from public.profiles
  where user_id = new.owner_id;

  action_text := '/myaccount?tab=kyc&kyc=' || new.id::text;
  message_parameters := jsonb_strip_nulls(jsonb_build_object(
    'kycId', new.id,
    'status', new.status,
    'version', new.version,
    'reasonCode', new.correction_reason_code,
    'dueAt', new.correction_due_at
  ));

  title_text := case message_key_text
    when 'kyc_submitted' then 'Dossier d’identité transmis'
    when 'kyc_information_requested' then 'Informations complémentaires requises'
    when 'kyc_resubmitted' then 'Corrections transmises'
    when 'kyc_approved' then 'Identité vérifiée'
    else 'Vérification d’identité non aboutie'
  end;

  message_text := case message_key_text
    when 'kyc_submitted' then 'Le dossier d’identité a été transmis pour vérification.'
    when 'kyc_information_requested' then 'Des éléments complémentaires sont nécessaires pour vérifier l’identité.'
    when 'kyc_resubmitted' then 'Les corrections ont été transmises pour vérification.'
    when 'kyc_approved' then 'La vérification de l’identité est terminée.'
    else 'Le dossier d’identité n’a pas pu être validé.'
  end;

  insert into public.notifications (
    recipient_id,
    title,
    message,
    notification_type,
    message_key,
    message_params,
    action_path
  )
  values (
    new.owner_id,
    title_text,
    message_text,
    'kyc',
    message_key_text,
    message_parameters,
    action_text
  );

  if email_address is not null then
    insert into public.transactional_email_outbox (
      event_key,
      recipient_id,
      recipient_email,
      template_key,
      entity_type,
      entity_id,
      payload
    )
    values (
      'kyc:' || new.id::text || ':' || new.status || ':' || new.version::text,
      new.owner_id,
      email_address,
      message_key_text,
      'kyc',
      new.id,
      jsonb_build_object(
        'actionPath', action_text,
        'reason', new.review_note,
        'reasonCode', new.correction_reason_code,
        'dueAt', new.correction_due_at
      )
    )
    on conflict (event_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_kyc_message()
from public, anon, authenticated;
grant execute on function private.enqueue_kyc_message()
to service_role;
