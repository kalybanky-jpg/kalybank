-- KALY DATABASE SCHEMA SNAPSHOT
-- GENERATED FILE: run `npx bun run db:snapshot`; do not edit manually.
-- remote-project-ref: qljqldhvbakornnpalua
-- migration-manifest-sha256: 316961291b19c7ab4e8c35b98b33797cdd68adc316b6bb1752afd9036f3ad4de
-- migrations: 20260728060744_kaly_secure_external_financial_workflows.sql, 20260728061308_add_missing_foreign_key_indexes.sql
-- schema-only: true
-- production-data-included: false
-- schemas: public, private



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "private"."ensure_active_user"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = caller_id and access_status = 'active'
  ) then
    raise exception 'ACCOUNT_ACCESS_RESTRICTED' using errcode = '42501';
  end if;

  return caller_id;
end;
$$;


ALTER FUNCTION "private"."ensure_active_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "private"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_active_staff"("required_roles" "text"[] DEFAULT NULL::"text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.staff_members
    where user_id = (select auth.uid())
      and active
      and (required_roles is null or role = any(required_roles))
  );
$$;


ALTER FUNCTION "private"."is_active_staff"("required_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'version' then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."financial_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "position_kind" "text" DEFAULT 'declared'::"text" NOT NULL,
    "currency" "text" NOT NULL,
    "amount_minor" bigint DEFAULT 0 NOT NULL,
    "reserved_minor" bigint DEFAULT 0 NOT NULL,
    "as_of" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_identifier_masked" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "financial_positions_amount_minor_check" CHECK ((("amount_minor" >= 0) AND ("amount_minor" <= '1000000000000000'::bigint))),
    CONSTRAINT "financial_positions_check" CHECK ((("reserved_minor" >= 0) AND ("reserved_minor" <= "amount_minor"))),
    CONSTRAINT "financial_positions_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "financial_positions_label_check" CHECK ((("char_length"("label") >= 1) AND ("char_length"("label") <= 120))),
    CONSTRAINT "financial_positions_position_kind_check" CHECK (("position_kind" = ANY (ARRAY['declared'::"text", 'internally_reconciled'::"text"]))),
    CONSTRAINT "financial_positions_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."financial_positions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_financial_position"("p_position_id" "uuid", "p_delta_minor" bigint, "p_as_of" timestamp with time zone, "p_reason" "text") RETURNS "public"."financial_positions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  position_row public.financial_positions;
begin
  if caller_id is null or not private.is_active_staff(array['supervisor', 'admin']) then
    raise exception 'SUPERVISOR_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if p_delta_minor = 0 or p_as_of is null then
    raise exception 'INVALID_ADJUSTMENT_VALUE' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'ADJUSTMENT_REASON_REQUIRED' using errcode = '22023';
  end if;

  select *
  into position_row
  from public.financial_positions
  where id = p_position_id
  for update;

  if not found then
    raise exception 'POSITION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if position_row.amount_minor + p_delta_minor < position_row.reserved_minor then
    raise exception 'ADJUSTMENT_CONFLICTS_WITH_RESERVATIONS' using errcode = '22003';
  end if;

  update public.financial_positions
  set
    amount_minor = amount_minor + p_delta_minor,
    position_kind = 'internally_reconciled',
    as_of = p_as_of
  where id = p_position_id
  returning * into position_row;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'adjust_financial_position',
    'financial_position',
    p_position_id,
    jsonb_build_object(
      'delta_minor', p_delta_minor,
      'as_of', p_as_of,
      'reason', p_reason
    )
  );

  return position_row;
end;
$$;


ALTER FUNCTION "public"."adjust_financial_position"("p_position_id" "uuid", "p_delta_minor" bigint, "p_as_of" timestamp with time zone, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_app_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (
      select case when active then role else 'user' end
      from public.staff_members
      where user_id = (select auth.uid())
    ),
    'user'
  );
$$;


ALTER FUNCTION "public"."current_app_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = (select auth.uid());
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_financial_position"("p_owner_id" "uuid", "p_label" "text", "p_currency" "text", "p_amount_minor" bigint, "p_as_of" timestamp with time zone, "p_external_identifier_masked" "text", "p_reason" "text") RETURNS "public"."financial_positions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  position_row public.financial_positions;
begin
  if caller_id is null or not private.is_active_staff(array['supervisor', 'admin']) then
    raise exception 'SUPERVISOR_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if p_amount_minor < 0 or p_as_of is null then
    raise exception 'INVALID_POSITION_VALUE' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'RECONCILIATION_REASON_REQUIRED' using errcode = '22023';
  end if;

  insert into public.financial_positions (
    owner_id,
    label,
    position_kind,
    currency,
    amount_minor,
    as_of,
    external_identifier_masked
  )
  values (
    p_owner_id,
    trim(p_label),
    'internally_reconciled',
    upper(p_currency),
    p_amount_minor,
    p_as_of,
    nullif(trim(coalesce(p_external_identifier_masked, '')), '')
  )
  returning * into position_row;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'record_financial_position',
    'financial_position',
    position_row.id,
    jsonb_build_object(
      'amount_minor', p_amount_minor,
      'currency', upper(p_currency),
      'as_of', p_as_of,
      'reason', p_reason
    )
  );

  return position_row;
end;
$$;


ALTER FUNCTION "public"."record_financial_position"("p_owner_id" "uuid", "p_label" "text", "p_currency" "text", "p_amount_minor" bigint, "p_as_of" timestamp with time zone, "p_external_identifier_masked" "text", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kyc_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "idempotency_key" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "place_of_birth" "text" NOT NULL,
    "nationality" "text" NOT NULL,
    "address" "jsonb" NOT NULL,
    "occupation" "text" NOT NULL,
    "income_range" "text" NOT NULL,
    "fatca" boolean NOT NULL,
    "pep" boolean NOT NULL,
    "document_object_paths" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "kyc_applications_address_check" CHECK (("jsonb_typeof"("address") = 'object'::"text")),
    CONSTRAINT "kyc_applications_date_of_birth_check" CHECK (("date_of_birth" <= (CURRENT_DATE - '18 years'::interval))),
    CONSTRAINT "kyc_applications_document_object_paths_check" CHECK (("jsonb_typeof"("document_object_paths") = 'object'::"text")),
    CONSTRAINT "kyc_applications_first_name_check" CHECK ((("char_length"("first_name") >= 1) AND ("char_length"("first_name") <= 100))),
    CONSTRAINT "kyc_applications_income_range_check" CHECK ((("char_length"("income_range") >= 1) AND ("char_length"("income_range") <= 100))),
    CONSTRAINT "kyc_applications_last_name_check" CHECK ((("char_length"("last_name") >= 1) AND ("char_length"("last_name") <= 100))),
    CONSTRAINT "kyc_applications_nationality_check" CHECK ((("char_length"("nationality") >= 1) AND ("char_length"("nationality") <= 100))),
    CONSTRAINT "kyc_applications_occupation_check" CHECK ((("char_length"("occupation") >= 1) AND ("char_length"("occupation") <= 100))),
    CONSTRAINT "kyc_applications_place_of_birth_check" CHECK ((("char_length"("place_of_birth") >= 1) AND ("char_length"("place_of_birth") <= 160))),
    CONSTRAINT "kyc_applications_review_note_check" CHECK ((("review_note" IS NULL) OR ("char_length"("review_note") <= 1000))),
    CONSTRAINT "kyc_applications_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text", 'needs_information'::"text"]))),
    CONSTRAINT "kyc_applications_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."kyc_applications" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_kyc_application"("p_kyc_id" "uuid", "p_status" "text", "p_note" "text") RETURNS "public"."kyc_applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  kyc_row public.kyc_applications;
  old_status text;
begin
  if caller_id is null or not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_status not in ('under_review', 'approved', 'rejected', 'needs_information') then
    raise exception 'INVALID_KYC_STATUS' using errcode = '22023';
  end if;

  select *
  into kyc_row
  from public.kyc_applications
  where id = p_kyc_id
  for update;

  if not found then
    raise exception 'KYC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if kyc_row.status in ('approved', 'rejected') then
    raise exception 'KYC_ALREADY_FINAL' using errcode = '55000';
  end if;

  if p_status in ('rejected', 'needs_information')
     and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'REVIEW_NOTE_REQUIRED' using errcode = '22023';
  end if;

  old_status := kyc_row.status;

  update public.kyc_applications
  set
    status = p_status,
    reviewed_by = caller_id,
    reviewed_at = case when p_status in ('approved', 'rejected') then now() else null end,
    review_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_kyc_id
  returning * into kyc_row;

  insert into public.kyc_events (
    kyc_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_kyc_id,
    caller_id,
    'reviewed',
    old_status,
    p_status,
    nullif(trim(coalesce(p_note, '')), '')
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'review_kyc',
    'kyc_application',
    p_kyc_id,
    jsonb_build_object('from_status', old_status, 'to_status', p_status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    kyc_row.owner_id,
    'Dossier d’identité mis à jour',
    case p_status
      when 'approved' then 'Votre identité a été approuvée dans KALY. Cette approbation ne crée ni compte bancaire ni IBAN.'
      when 'rejected' then 'Votre dossier d’identité a été rejeté. Consultez le motif pour le corriger.'
      when 'needs_information' then 'Des informations complémentaires sont nécessaires pour poursuivre le contrôle.'
      else 'Votre dossier est en cours de contrôle humain.'
    end,
    'kyc'
  );

  return kyc_row;
end;
$$;


ALTER FUNCTION "public"."review_kyc_application"("p_kyc_id" "uuid", "p_status" "text", "p_note" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loan_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "idempotency_key" "uuid" NOT NULL,
    "reference" "text" NOT NULL,
    "requested_amount_minor" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "duration_months" integer NOT NULL,
    "indicative_monthly_payment_minor" bigint,
    "indicative_annual_rate" numeric(8,5),
    "motive" "text" NOT NULL,
    "document_object_paths" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "loan_applications_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "loan_applications_document_object_paths_check" CHECK (("jsonb_typeof"("document_object_paths") = 'array'::"text")),
    CONSTRAINT "loan_applications_duration_months_check" CHECK ((("duration_months" >= 1) AND ("duration_months" <= 600))),
    CONSTRAINT "loan_applications_indicative_annual_rate_check" CHECK ((("indicative_annual_rate" IS NULL) OR ("indicative_annual_rate" >= (0)::numeric))),
    CONSTRAINT "loan_applications_indicative_monthly_payment_minor_check" CHECK ((("indicative_monthly_payment_minor" IS NULL) OR ("indicative_monthly_payment_minor" > 0))),
    CONSTRAINT "loan_applications_motive_check" CHECK ((("char_length"("motive") >= 1) AND ("char_length"("motive") <= 500))),
    CONSTRAINT "loan_applications_requested_amount_minor_check" CHECK ((("requested_amount_minor" > 0) AND ("requested_amount_minor" <= '1000000000000000'::bigint))),
    CONSTRAINT "loan_applications_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'approved_for_external_funding'::"text", 'external_funding_recorded'::"text", 'external_settlement_confirmed'::"text", 'rejected'::"text", 'cancelled'::"text", 'external_failed'::"text"]))),
    CONSTRAINT "loan_applications_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."loan_applications" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_loan_check"("p_loan_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."loan_applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  loan_row public.loan_applications;
  old_status text;
  next_status text;
begin
  if caller_id is null or not private.is_active_staff(array['reviewer', 'operator', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_check_kind not in ('dual_review', 'escalation', 'compliance', 'final_authorization')
     or p_status not in ('pending', 'in_progress', 'completed', 'failed') then
    raise exception 'INVALID_REVIEW_VALUE' using errcode = '22023';
  end if;

  select *
  into loan_row
  from public.loan_applications
  where id = p_loan_id
  for update;

  if not found then
    raise exception 'LOAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  if loan_row.status not in ('submitted', 'under_review') then
    raise exception 'LOAN_NOT_REVIEWABLE' using errcode = '55000';
  end if;

  old_status := loan_row.status;

  update public.loan_review_checks
  set
    status = p_status,
    reviewer_id = caller_id,
    note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_at = case when p_status in ('completed', 'failed') then now() else null end
  where loan_id = p_loan_id and check_kind = p_check_kind;

  if p_status = 'failed' then
    next_status := 'under_review';
  elsif not exists (
    select 1
    from public.loan_review_checks
    where loan_id = p_loan_id and status <> 'completed'
  ) then
    if (
      select count(distinct reviewer_id)
      from public.loan_review_checks
      where loan_id = p_loan_id and status = 'completed'
    ) < 2 then
      raise exception 'TWO_DISTINCT_REVIEWERS_REQUIRED' using errcode = '42501';
    end if;
    next_status := 'approved_for_external_funding';
  else
    next_status := 'under_review';
  end if;

  update public.loan_applications
  set status = next_status
  where id = p_loan_id
  returning * into loan_row;

  insert into public.loan_events (
    loan_id, actor_id, event_type, from_status, to_status, reason, metadata
  )
  values (
    p_loan_id,
    caller_id,
    'review_check_updated',
    old_status,
    next_status,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('check_kind', p_check_kind, 'check_status', p_status)
  );

  return loan_row;
end;
$$;


ALTER FUNCTION "public"."review_loan_check"("p_loan_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfer_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "source_position_id" "uuid" NOT NULL,
    "idempotency_key" "uuid" NOT NULL,
    "recipient_name" "text" NOT NULL,
    "recipient_account_masked" "text" NOT NULL,
    "beneficiary_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "transfer_type" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "currency" "text" NOT NULL,
    "target_amount_minor" bigint NOT NULL,
    "target_currency" "text" NOT NULL,
    "quote_rate" numeric(24,12) NOT NULL,
    "quote_as_of" timestamp with time zone NOT NULL,
    "motive" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "transfer_intents_amount_minor_check" CHECK ((("amount_minor" > 0) AND ("amount_minor" <= '1000000000000000'::bigint))),
    CONSTRAINT "transfer_intents_beneficiary_details_check" CHECK (("jsonb_typeof"("beneficiary_details") = 'object'::"text")),
    CONSTRAINT "transfer_intents_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "transfer_intents_motive_check" CHECK ((("motive" IS NULL) OR ("char_length"("motive") <= 500))),
    CONSTRAINT "transfer_intents_quote_rate_check" CHECK (("quote_rate" > (0)::numeric)),
    CONSTRAINT "transfer_intents_recipient_account_masked_check" CHECK ((("char_length"("recipient_account_masked") >= 1) AND ("char_length"("recipient_account_masked") <= 160))),
    CONSTRAINT "transfer_intents_recipient_name_check" CHECK ((("char_length"("recipient_name") >= 1) AND ("char_length"("recipient_name") <= 160))),
    CONSTRAINT "transfer_intents_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'approved_for_external_execution'::"text", 'external_execution_recorded'::"text", 'external_settlement_confirmed'::"text", 'rejected'::"text", 'cancelled'::"text", 'external_failed'::"text"]))),
    CONSTRAINT "transfer_intents_target_amount_minor_check" CHECK ((("target_amount_minor" > 0) AND ("target_amount_minor" <= '1000000000000000'::bigint))),
    CONSTRAINT "transfer_intents_target_currency_check" CHECK (("target_currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "transfer_intents_transfer_type_check" CHECK (("transfer_type" = ANY (ARRAY['canada'::"text", 'eurozone'::"text", 'usa'::"text", 'swiss'::"text", 'uk'::"text", 'latam'::"text", 'africa'::"text"]))),
    CONSTRAINT "transfer_intents_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."transfer_intents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_transfer_check"("p_transfer_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."transfer_intents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  transfer_row public.transfer_intents;
  old_status text;
  next_status text;
begin
  if caller_id is null or not private.is_active_staff(array['reviewer', 'operator', 'supervisor', 'admin']) then
    raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_check_kind not in ('dual_review', 'escalation', 'compliance', 'final_authorization')
     or p_status not in ('pending', 'in_progress', 'completed', 'failed') then
    raise exception 'INVALID_REVIEW_VALUE' using errcode = '22023';
  end if;

  select *
  into transfer_row
  from public.transfer_intents
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if transfer_row.status not in ('submitted', 'under_review') then
    raise exception 'TRANSFER_NOT_REVIEWABLE' using errcode = '55000';
  end if;

  old_status := transfer_row.status;

  update public.transfer_review_checks
  set
    status = p_status,
    reviewer_id = caller_id,
    note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_at = case when p_status in ('completed', 'failed') then now() else null end
  where transfer_id = p_transfer_id and check_kind = p_check_kind;

  if p_status = 'failed' then
    next_status := 'under_review';
  elsif not exists (
    select 1
    from public.transfer_review_checks
    where transfer_id = p_transfer_id and status <> 'completed'
  ) then
    if (
      select count(distinct reviewer_id)
      from public.transfer_review_checks
      where transfer_id = p_transfer_id and status = 'completed'
    ) < 2 then
      raise exception 'TWO_DISTINCT_REVIEWERS_REQUIRED' using errcode = '42501';
    end if;
    next_status := 'approved_for_external_execution';
  else
    next_status := 'under_review';
  end if;

  update public.transfer_intents
  set status = next_status
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason, metadata
  )
  values (
    p_transfer_id,
    caller_id,
    'review_check_updated',
    old_status,
    next_status,
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object('check_kind', p_check_kind, 'check_status', p_status)
  );

  return transfer_row;
end;
$$;


ALTER FUNCTION "public"."review_transfer_check"("p_transfer_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text",
    "preferred_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "access_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "access_status_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_access_status_check" CHECK (("access_status" = ANY (ARRAY['active'::"text", 'frozen'::"text"]))),
    CONSTRAINT "profiles_preferred_currency_check" CHECK (("preferred_currency" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_access_status"("p_user_id" "uuid", "p_status" "text", "p_reason" "text") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  profile_row public.profiles;
begin
  if caller_id is null or not private.is_active_staff(array['admin']) then
    raise exception 'ADMIN_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if p_status not in ('active', 'frozen') then
    raise exception 'INVALID_ACCESS_STATUS' using errcode = '22023';
  end if;
  if p_status = 'frozen' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'FREEZE_REASON_REQUIRED' using errcode = '22023';
  end if;

  update public.profiles
  set
    access_status = p_status,
    access_status_reason = case
      when p_status = 'frozen' then trim(p_reason)
      else null
    end
  where user_id = p_user_id
  returning * into profile_row;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    'set_access_status',
    'profile',
    p_user_id,
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  return profile_row;
end;
$$;


ALTER FUNCTION "public"."set_user_access_status"("p_user_id" "uuid", "p_status" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_kyc_application"("p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date", "p_place_of_birth" "text", "p_nationality" "text", "p_address" "jsonb", "p_occupation" "text", "p_income_range" "text", "p_fatca" boolean, "p_pep" boolean, "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") RETURNS "public"."kyc_applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := private.ensure_active_user();
  kyc_row public.kyc_applications;
begin
  insert into public.kyc_applications (
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
    document_object_paths
  )
  values (
    caller_id,
    p_idempotency_key,
    trim(p_first_name),
    trim(p_last_name),
    p_date_of_birth,
    trim(p_place_of_birth),
    trim(p_nationality),
    p_address,
    trim(p_occupation),
    trim(p_income_range),
    p_fatca,
    p_pep,
    p_document_object_paths
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning * into kyc_row;

  if kyc_row.id is null then
    select *
    into kyc_row
    from public.kyc_applications
    where owner_id = caller_id and idempotency_key = p_idempotency_key;
    return kyc_row;
  end if;

  insert into public.kyc_events (kyc_id, actor_id, event_type, to_status)
  values (kyc_row.id, caller_id, 'submitted', 'submitted');

  insert into public.notifications (recipient_id, title, message, notification_type)
  values (
    caller_id,
    'Dossier d’identité enregistré',
    'Votre dossier a été transmis pour contrôle humain. Son approbation ne crée ni compte bancaire ni IBAN.',
    'kyc'
  );

  return kyc_row;
end;
$$;


ALTER FUNCTION "public"."submit_kyc_application"("p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date", "p_place_of_birth" "text", "p_nationality" "text", "p_address" "jsonb", "p_occupation" "text", "p_income_range" "text", "p_fatca" boolean, "p_pep" boolean, "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_loan_application"("p_requested_amount_minor" bigint, "p_currency" "text", "p_duration_months" integer, "p_indicative_monthly_payment_minor" bigint, "p_indicative_annual_rate" numeric, "p_motive" "text", "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") RETURNS "public"."loan_applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := private.ensure_active_user();
  loan_row public.loan_applications;
  generated_reference text;
begin
  if p_document_object_paths is null
     or jsonb_typeof(p_document_object_paths) <> 'array'
     or jsonb_array_length(p_document_object_paths) = 0 then
    raise exception 'LOAN_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;

  generated_reference := 'KALY-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(p_idempotency_key::text, '-', ''), 1, 8));

  insert into public.loan_applications (
    owner_id,
    idempotency_key,
    reference,
    requested_amount_minor,
    currency,
    duration_months,
    indicative_monthly_payment_minor,
    indicative_annual_rate,
    motive,
    document_object_paths
  )
  values (
    caller_id,
    p_idempotency_key,
    generated_reference,
    p_requested_amount_minor,
    upper(p_currency),
    p_duration_months,
    p_indicative_monthly_payment_minor,
    p_indicative_annual_rate,
    trim(p_motive),
    p_document_object_paths
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning * into loan_row;

  if loan_row.id is null then
    select *
    into loan_row
    from public.loan_applications
    where owner_id = caller_id and idempotency_key = p_idempotency_key;
    return loan_row;
  end if;

  insert into public.loan_review_checks (loan_id, check_kind)
  select loan_row.id, check_kind
  from unnest(array['dual_review', 'escalation', 'compliance', 'final_authorization']) as check_kind;

  insert into public.loan_events (loan_id, actor_id, event_type, to_status)
  values (loan_row.id, caller_id, 'submitted', 'submitted');

  insert into public.notifications (recipient_id, title, message, notification_type)
  values (
    caller_id,
    'Demande enregistrée',
    'Votre demande a été enregistrée pour étude. La simulation n’est ni une offre de crédit ni une promesse de versement.',
    'loan'
  );

  return loan_row;
end;
$$;


ALTER FUNCTION "public"."submit_loan_application"("p_requested_amount_minor" bigint, "p_currency" "text", "p_duration_months" integer, "p_indicative_monthly_payment_minor" bigint, "p_indicative_annual_rate" numeric, "p_motive" "text", "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_transfer_intent"("p_source_position_id" "uuid", "p_recipient_name" "text", "p_recipient_account_masked" "text", "p_beneficiary_details" "jsonb", "p_transfer_type" "text", "p_amount_minor" bigint, "p_currency" "text", "p_target_amount_minor" bigint, "p_target_currency" "text", "p_quote_rate" numeric, "p_quote_as_of" timestamp with time zone, "p_motive" "text", "p_idempotency_key" "uuid") RETURNS "public"."transfer_intents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := private.ensure_active_user();
  position_row public.financial_positions;
  transfer_row public.transfer_intents;
begin
  if p_amount_minor <= 0 or p_target_amount_minor <= 0 or p_quote_rate <= 0 then
    raise exception 'INVALID_TRANSFER_AMOUNT' using errcode = '22023';
  end if;

  select *
  into position_row
  from public.financial_positions
  where id = p_source_position_id and owner_id = caller_id
  for update;

  if not found then
    raise exception 'SOURCE_POSITION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if position_row.currency <> upper(p_currency) then
    raise exception 'SOURCE_CURRENCY_MISMATCH' using errcode = '22023';
  end if;

  insert into public.transfer_intents (
    owner_id,
    source_position_id,
    idempotency_key,
    recipient_name,
    recipient_account_masked,
    beneficiary_details,
    transfer_type,
    amount_minor,
    currency,
    target_amount_minor,
    target_currency,
    quote_rate,
    quote_as_of,
    motive
  )
  values (
    caller_id,
    p_source_position_id,
    p_idempotency_key,
    trim(p_recipient_name),
    trim(p_recipient_account_masked),
    coalesce(p_beneficiary_details, '{}'::jsonb),
    p_transfer_type,
    p_amount_minor,
    upper(p_currency),
    p_target_amount_minor,
    upper(p_target_currency),
    p_quote_rate,
    p_quote_as_of,
    nullif(trim(coalesce(p_motive, '')), '')
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning * into transfer_row;

  if transfer_row.id is null then
    select *
    into transfer_row
    from public.transfer_intents
    where owner_id = caller_id and idempotency_key = p_idempotency_key;
    return transfer_row;
  end if;

  if position_row.amount_minor - position_row.reserved_minor < p_amount_minor then
    raise exception 'INSUFFICIENT_INTERNAL_AVAILABLE_AMOUNT' using errcode = '22003';
  end if;

  update public.financial_positions
  set reserved_minor = reserved_minor + p_amount_minor
  where id = p_source_position_id;

  insert into public.transfer_review_checks (transfer_id, check_kind)
  select transfer_row.id, check_kind
  from unnest(array['dual_review', 'escalation', 'compliance', 'final_authorization']) as check_kind;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, to_status, metadata
  )
  values (
    transfer_row.id,
    caller_id,
    'submitted',
    'submitted',
    jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    caller_id,
    'Instruction enregistrée',
    'Votre instruction a été enregistrée pour contrôle. Aucun transfert bancaire n’a encore été exécuté.',
    'transfer'
  );

  return transfer_row;
end;
$$;


ALTER FUNCTION "public"."submit_transfer_intent"("p_source_position_id" "uuid", "p_recipient_name" "text", "p_recipient_account_masked" "text", "p_beneficiary_details" "jsonb", "p_transfer_type" "text", "p_amount_minor" bigint, "p_currency" "text", "p_target_amount_minor" bigint, "p_target_currency" "text", "p_quote_rate" numeric, "p_quote_as_of" timestamp with time zone, "p_motive" "text", "p_idempotency_key" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_loan"("p_loan_id" "uuid", "p_action" "text", "p_reason" "text" DEFAULT NULL::"text", "p_external_reference" "text" DEFAULT NULL::"text", "p_evidence_object_path" "text" DEFAULT NULL::"text", "p_executed_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."loan_applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  loan_row public.loan_applications;
  old_status text;
  next_status text;
  executor_id uuid;
begin
  if caller_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select *
  into loan_row
  from public.loan_applications
  where id = p_loan_id
  for update;

  if not found then
    raise exception 'LOAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  old_status := loan_row.status;

  if p_action = 'cancel' then
    if caller_id <> loan_row.owner_id
       or old_status not in ('submitted', 'under_review', 'approved_for_external_funding') then
      raise exception 'LOAN_CANNOT_BE_CANCELLED' using errcode = '42501';
    end if;
    next_status := 'cancelled';

  elsif p_action = 'reject' then
    if not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
      raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status not in ('submitted', 'under_review', 'approved_for_external_funding') then
      raise exception 'LOAN_CANNOT_BE_REJECTED' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'REJECTION_REASON_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'rejected';

  elsif p_action = 'record_external_funding' then
    if not private.is_active_staff(array['operator', 'supervisor', 'admin']) then
      raise exception 'OPERATOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'approved_for_external_funding' then
      raise exception 'LOAN_NOT_APPROVED_FOR_EXTERNAL_FUNDING' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_external_reference, '')), '') is null
       or nullif(trim(coalesce(p_evidence_object_path, '')), '') is null
       or p_executed_at is null then
      raise exception 'EXTERNAL_FUNDING_EVIDENCE_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'external_funding_recorded';
    insert into public.external_loan_fundings (
      loan_id,
      external_reference,
      evidence_object_path,
      execution_note,
      executed_by,
      executed_at
    )
    values (
      p_loan_id,
      trim(p_external_reference),
      trim(p_evidence_object_path),
      nullif(trim(coalesce(p_reason, '')), ''),
      caller_id,
      p_executed_at
    );

  elsif p_action = 'confirm_external_settlement' then
    if not private.is_active_staff(array['supervisor', 'admin']) then
      raise exception 'SUPERVISOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'external_funding_recorded' then
      raise exception 'EXTERNAL_FUNDING_NOT_RECORDED' using errcode = '55000';
    end if;

    select executed_by
    into executor_id
    from public.external_loan_fundings
    where loan_id = p_loan_id
    for update;

    if executor_id = caller_id then
      raise exception 'SECOND_STAFF_MEMBER_REQUIRED' using errcode = '42501';
    end if;

    next_status := 'external_settlement_confirmed';
    update public.external_loan_fundings
    set
      confirmed_by = caller_id,
      confirmed_at = now(),
      confirmation_note = nullif(trim(coalesce(p_reason, '')), '')
    where loan_id = p_loan_id;

  elsif p_action = 'mark_external_failed' then
    if not private.is_active_staff(array['operator', 'supervisor', 'admin']) then
      raise exception 'OPERATOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'external_funding_recorded' then
      raise exception 'EXTERNAL_FUNDING_NOT_RECORDED' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'FAILURE_REASON_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'external_failed';

  else
    raise exception 'INVALID_LOAN_ACTION' using errcode = '22023';
  end if;

  update public.loan_applications
  set status = next_status
  where id = p_loan_id
  returning * into loan_row;

  insert into public.loan_events (
    loan_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_loan_id,
    caller_id,
    p_action,
    old_status,
    next_status,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    p_action,
    'loan_application',
    p_loan_id,
    jsonb_build_object('from_status', old_status, 'to_status', next_status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    loan_row.owner_id,
    'Demande mise à jour',
    case next_status
      when 'approved_for_external_funding' then 'Votre dossier est autorisé pour traitement externe. Aucun versement n’est encore confirmé.'
      when 'external_funding_recorded' then 'Un versement externe a été déclaré et reste en attente d’un second contrôle.'
      when 'external_settlement_confirmed' then 'Le versement externe a été confirmé manuellement sur justificatif.'
      when 'rejected' then 'Votre demande a été rejetée. Aucun versement n’a été effectué par KALY.'
      when 'cancelled' then 'Votre demande a été annulée avant confirmation externe.'
      else 'Le versement externe a été signalé en échec.'
    end,
    'loan'
  );

  return loan_row;
end;
$$;


ALTER FUNCTION "public"."transition_loan"("p_loan_id" "uuid", "p_action" "text", "p_reason" "text", "p_external_reference" "text", "p_evidence_object_path" "text", "p_executed_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_transfer"("p_transfer_id" "uuid", "p_action" "text", "p_reason" "text" DEFAULT NULL::"text", "p_external_reference" "text" DEFAULT NULL::"text", "p_evidence_object_path" "text" DEFAULT NULL::"text", "p_executed_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."transfer_intents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  transfer_row public.transfer_intents;
  old_status text;
  next_status text;
  executor_id uuid;
begin
  if caller_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select *
  into transfer_row
  from public.transfer_intents
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;

  old_status := transfer_row.status;

  if p_action = 'cancel' then
    if caller_id <> transfer_row.owner_id
       or old_status not in ('submitted', 'under_review', 'approved_for_external_execution') then
      raise exception 'TRANSFER_CANNOT_BE_CANCELLED' using errcode = '42501';
    end if;
    next_status := 'cancelled';
    update public.financial_positions
    set reserved_minor = reserved_minor - transfer_row.amount_minor
    where id = transfer_row.source_position_id;

  elsif p_action = 'reject' then
    if not private.is_active_staff(array['reviewer', 'supervisor', 'admin']) then
      raise exception 'STAFF_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status not in ('submitted', 'under_review', 'approved_for_external_execution') then
      raise exception 'TRANSFER_CANNOT_BE_REJECTED' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'REJECTION_REASON_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'rejected';
    update public.financial_positions
    set reserved_minor = reserved_minor - transfer_row.amount_minor
    where id = transfer_row.source_position_id;

  elsif p_action = 'record_external_execution' then
    if not private.is_active_staff(array['operator', 'supervisor', 'admin']) then
      raise exception 'OPERATOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'approved_for_external_execution' then
      raise exception 'TRANSFER_NOT_APPROVED_FOR_EXTERNAL_EXECUTION' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_external_reference, '')), '') is null
       or nullif(trim(coalesce(p_evidence_object_path, '')), '') is null
       or p_executed_at is null then
      raise exception 'EXTERNAL_EXECUTION_EVIDENCE_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'external_execution_recorded';
    insert into public.external_transfer_executions (
      transfer_id,
      external_reference,
      evidence_object_path,
      execution_note,
      executed_by,
      executed_at
    )
    values (
      p_transfer_id,
      trim(p_external_reference),
      trim(p_evidence_object_path),
      nullif(trim(coalesce(p_reason, '')), ''),
      caller_id,
      p_executed_at
    );

  elsif p_action = 'confirm_external_settlement' then
    if not private.is_active_staff(array['supervisor', 'admin']) then
      raise exception 'SUPERVISOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'external_execution_recorded' then
      raise exception 'EXTERNAL_EXECUTION_NOT_RECORDED' using errcode = '55000';
    end if;

    select executed_by
    into executor_id
    from public.external_transfer_executions
    where transfer_id = p_transfer_id
    for update;

    if executor_id = caller_id then
      raise exception 'SECOND_STAFF_MEMBER_REQUIRED' using errcode = '42501';
    end if;

    next_status := 'external_settlement_confirmed';

    update public.external_transfer_executions
    set
      confirmed_by = caller_id,
      confirmed_at = now(),
      confirmation_note = nullif(trim(coalesce(p_reason, '')), '')
    where transfer_id = p_transfer_id;

    update public.financial_positions
    set
      amount_minor = amount_minor - transfer_row.amount_minor,
      reserved_minor = reserved_minor - transfer_row.amount_minor,
      position_kind = 'internally_reconciled',
      as_of = now()
    where id = transfer_row.source_position_id;

  elsif p_action = 'mark_external_failed' then
    if not private.is_active_staff(array['operator', 'supervisor', 'admin']) then
      raise exception 'OPERATOR_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if old_status <> 'external_execution_recorded' then
      raise exception 'EXTERNAL_EXECUTION_NOT_RECORDED' using errcode = '55000';
    end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'FAILURE_REASON_REQUIRED' using errcode = '22023';
    end if;
    next_status := 'external_failed';
    update public.financial_positions
    set reserved_minor = reserved_minor - transfer_row.amount_minor
    where id = transfer_row.source_position_id;

  else
    raise exception 'INVALID_TRANSFER_ACTION' using errcode = '22023';
  end if;

  update public.transfer_intents
  set status = next_status
  where id = p_transfer_id
  returning * into transfer_row;

  insert into public.transfer_events (
    transfer_id, actor_id, event_type, from_status, to_status, reason
  )
  values (
    p_transfer_id,
    caller_id,
    p_action,
    old_status,
    next_status,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    caller_id,
    p_action,
    'transfer_intent',
    p_transfer_id,
    jsonb_build_object('from_status', old_status, 'to_status', next_status)
  );

  insert into public.notifications (
    recipient_id, title, message, notification_type
  )
  values (
    transfer_row.owner_id,
    'Instruction mise à jour',
    case next_status
      when 'approved_for_external_execution' then 'Votre instruction est autorisée pour traitement hors application. Aucun mouvement bancaire n’est encore confirmé.'
      when 'external_execution_recorded' then 'Une exécution externe a été déclarée et reste en attente d’un second contrôle.'
      when 'external_settlement_confirmed' then 'Le règlement externe a été confirmé manuellement sur justificatif.'
      when 'rejected' then 'Votre instruction a été rejetée. Aucun mouvement bancaire n’a été effectué par KALY.'
      when 'cancelled' then 'Votre instruction a été annulée avant confirmation externe.'
      else 'L’exécution externe a été signalée en échec.'
    end,
    'transfer'
  );

  return transfer_row;
end;
$$;


ALTER FUNCTION "public"."transition_transfer"("p_transfer_id" "uuid", "p_action" "text", "p_reason" "text", "p_external_reference" "text", "p_evidence_object_path" "text", "p_executed_at" timestamp with time zone) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_events" (
    "id" bigint NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_events_metadata_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text"))
);


ALTER TABLE "public"."audit_events" OWNER TO "postgres";


ALTER TABLE "public"."audit_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."external_loan_fundings" (
    "loan_id" "uuid" NOT NULL,
    "external_reference" "text" NOT NULL,
    "evidence_object_path" "text" NOT NULL,
    "execution_note" "text",
    "executed_by" "uuid" NOT NULL,
    "executed_at" timestamp with time zone NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "confirmation_note" "text",
    CONSTRAINT "external_loan_fundings_check" CHECK ((("confirmed_by" IS NULL) OR ("confirmed_by" <> "executed_by"))),
    CONSTRAINT "external_loan_fundings_check1" CHECK (((("confirmed_by" IS NULL) AND ("confirmed_at" IS NULL)) OR (("confirmed_by" IS NOT NULL) AND ("confirmed_at" IS NOT NULL)))),
    CONSTRAINT "external_loan_fundings_confirmation_note_check" CHECK ((("confirmation_note" IS NULL) OR ("char_length"("confirmation_note") <= 1000))),
    CONSTRAINT "external_loan_fundings_evidence_object_path_check" CHECK ((("char_length"("evidence_object_path") >= 3) AND ("char_length"("evidence_object_path") <= 500))),
    CONSTRAINT "external_loan_fundings_execution_note_check" CHECK ((("execution_note" IS NULL) OR ("char_length"("execution_note") <= 1000))),
    CONSTRAINT "external_loan_fundings_external_reference_check" CHECK ((("char_length"("external_reference") >= 3) AND ("char_length"("external_reference") <= 160)))
);


ALTER TABLE "public"."external_loan_fundings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_transfer_executions" (
    "transfer_id" "uuid" NOT NULL,
    "external_reference" "text" NOT NULL,
    "evidence_object_path" "text" NOT NULL,
    "execution_note" "text",
    "executed_by" "uuid" NOT NULL,
    "executed_at" timestamp with time zone NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "confirmation_note" "text",
    CONSTRAINT "external_transfer_executions_check" CHECK ((("confirmed_by" IS NULL) OR ("confirmed_by" <> "executed_by"))),
    CONSTRAINT "external_transfer_executions_check1" CHECK (((("confirmed_by" IS NULL) AND ("confirmed_at" IS NULL)) OR (("confirmed_by" IS NOT NULL) AND ("confirmed_at" IS NOT NULL)))),
    CONSTRAINT "external_transfer_executions_confirmation_note_check" CHECK ((("confirmation_note" IS NULL) OR ("char_length"("confirmation_note") <= 1000))),
    CONSTRAINT "external_transfer_executions_evidence_object_path_check" CHECK ((("char_length"("evidence_object_path") >= 3) AND ("char_length"("evidence_object_path") <= 500))),
    CONSTRAINT "external_transfer_executions_execution_note_check" CHECK ((("execution_note" IS NULL) OR ("char_length"("execution_note") <= 1000))),
    CONSTRAINT "external_transfer_executions_external_reference_check" CHECK ((("char_length"("external_reference") >= 3) AND ("char_length"("external_reference") <= 160)))
);


ALTER TABLE "public"."external_transfer_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kyc_events" (
    "id" bigint NOT NULL,
    "kyc_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kyc_events_reason_check" CHECK ((("reason" IS NULL) OR ("char_length"("reason") <= 1000)))
);


ALTER TABLE "public"."kyc_events" OWNER TO "postgres";


ALTER TABLE "public"."kyc_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."kyc_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."loan_events" (
    "id" bigint NOT NULL,
    "loan_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loan_events_metadata_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "loan_events_reason_check" CHECK ((("reason" IS NULL) OR ("char_length"("reason") <= 1000)))
);


ALTER TABLE "public"."loan_events" OWNER TO "postgres";


ALTER TABLE "public"."loan_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."loan_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."loan_review_checks" (
    "id" bigint NOT NULL,
    "loan_id" "uuid" NOT NULL,
    "check_kind" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_id" "uuid",
    "note" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loan_review_checks_check_kind_check" CHECK (("check_kind" = ANY (ARRAY['dual_review'::"text", 'escalation'::"text", 'compliance'::"text", 'final_authorization'::"text"]))),
    CONSTRAINT "loan_review_checks_note_check" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 1000))),
    CONSTRAINT "loan_review_checks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."loan_review_checks" OWNER TO "postgres";


ALTER TABLE "public"."loan_review_checks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."loan_review_checks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_message_check" CHECK ((("char_length"("message") >= 1) AND ("char_length"("message") <= 1000))),
    CONSTRAINT "notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['info'::"text", 'success'::"text", 'alert'::"text", 'transfer'::"text", 'loan'::"text", 'kyc'::"text"]))),
    CONSTRAINT "notifications_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 160)))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_members" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_members_role_check" CHECK (("role" = ANY (ARRAY['reviewer'::"text", 'operator'::"text", 'supervisor'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."staff_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfer_events" (
    "id" bigint NOT NULL,
    "transfer_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transfer_events_metadata_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "transfer_events_reason_check" CHECK ((("reason" IS NULL) OR ("char_length"("reason") <= 1000)))
);


ALTER TABLE "public"."transfer_events" OWNER TO "postgres";


ALTER TABLE "public"."transfer_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."transfer_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."transfer_review_checks" (
    "id" bigint NOT NULL,
    "transfer_id" "uuid" NOT NULL,
    "check_kind" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_id" "uuid",
    "note" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transfer_review_checks_check_kind_check" CHECK (("check_kind" = ANY (ARRAY['dual_review'::"text", 'escalation'::"text", 'compliance'::"text", 'final_authorization'::"text"]))),
    CONSTRAINT "transfer_review_checks_note_check" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 1000))),
    CONSTRAINT "transfer_review_checks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."transfer_review_checks" OWNER TO "postgres";


ALTER TABLE "public"."transfer_review_checks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."transfer_review_checks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_loan_fundings"
    ADD CONSTRAINT "external_loan_fundings_pkey" PRIMARY KEY ("loan_id");



ALTER TABLE ONLY "public"."external_transfer_executions"
    ADD CONSTRAINT "external_transfer_executions_pkey" PRIMARY KEY ("transfer_id");



ALTER TABLE ONLY "public"."financial_positions"
    ADD CONSTRAINT "financial_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyc_applications"
    ADD CONSTRAINT "kyc_applications_owner_id_idempotency_key_key" UNIQUE ("owner_id", "idempotency_key");



ALTER TABLE ONLY "public"."kyc_applications"
    ADD CONSTRAINT "kyc_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyc_events"
    ADD CONSTRAINT "kyc_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loan_applications"
    ADD CONSTRAINT "loan_applications_owner_id_idempotency_key_key" UNIQUE ("owner_id", "idempotency_key");



ALTER TABLE ONLY "public"."loan_applications"
    ADD CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loan_applications"
    ADD CONSTRAINT "loan_applications_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."loan_events"
    ADD CONSTRAINT "loan_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loan_review_checks"
    ADD CONSTRAINT "loan_review_checks_loan_id_check_kind_key" UNIQUE ("loan_id", "check_kind");



ALTER TABLE ONLY "public"."loan_review_checks"
    ADD CONSTRAINT "loan_review_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."transfer_events"
    ADD CONSTRAINT "transfer_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_intents"
    ADD CONSTRAINT "transfer_intents_owner_id_idempotency_key_key" UNIQUE ("owner_id", "idempotency_key");



ALTER TABLE ONLY "public"."transfer_intents"
    ADD CONSTRAINT "transfer_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_review_checks"
    ADD CONSTRAINT "transfer_review_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_review_checks"
    ADD CONSTRAINT "transfer_review_checks_transfer_id_check_kind_key" UNIQUE ("transfer_id", "check_kind");



CREATE INDEX "audit_events_actor_id_idx" ON "public"."audit_events" USING "btree" ("actor_id");



CREATE INDEX "audit_events_entity_created_idx" ON "public"."audit_events" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE UNIQUE INDEX "external_loan_funding_reference_idx" ON "public"."external_loan_fundings" USING "btree" ("external_reference");



CREATE INDEX "external_loan_fundings_confirmed_by_idx" ON "public"."external_loan_fundings" USING "btree" ("confirmed_by");



CREATE INDEX "external_loan_fundings_executed_by_idx" ON "public"."external_loan_fundings" USING "btree" ("executed_by");



CREATE INDEX "external_transfer_executions_confirmed_by_idx" ON "public"."external_transfer_executions" USING "btree" ("confirmed_by");



CREATE INDEX "external_transfer_executions_executed_by_idx" ON "public"."external_transfer_executions" USING "btree" ("executed_by");



CREATE UNIQUE INDEX "external_transfer_reference_idx" ON "public"."external_transfer_executions" USING "btree" ("external_reference");



CREATE INDEX "financial_positions_owner_idx" ON "public"."financial_positions" USING "btree" ("owner_id");



CREATE INDEX "kyc_applications_owner_created_idx" ON "public"."kyc_applications" USING "btree" ("owner_id", "submitted_at" DESC);



CREATE INDEX "kyc_applications_review_queue_idx" ON "public"."kyc_applications" USING "btree" ("submitted_at") WHERE ("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'needs_information'::"text"]));



CREATE INDEX "kyc_applications_reviewed_by_idx" ON "public"."kyc_applications" USING "btree" ("reviewed_by");



CREATE INDEX "kyc_events_actor_id_idx" ON "public"."kyc_events" USING "btree" ("actor_id");



CREATE INDEX "kyc_events_kyc_created_idx" ON "public"."kyc_events" USING "btree" ("kyc_id", "created_at");



CREATE INDEX "loan_applications_active_review_idx" ON "public"."loan_applications" USING "btree" ("submitted_at") WHERE ("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'approved_for_external_funding'::"text", 'external_funding_recorded'::"text"]));



CREATE INDEX "loan_applications_owner_created_idx" ON "public"."loan_applications" USING "btree" ("owner_id", "submitted_at" DESC);



CREATE INDEX "loan_events_actor_id_idx" ON "public"."loan_events" USING "btree" ("actor_id");



CREATE INDEX "loan_events_loan_created_idx" ON "public"."loan_events" USING "btree" ("loan_id", "created_at");



CREATE INDEX "loan_review_checks_loan_idx" ON "public"."loan_review_checks" USING "btree" ("loan_id");



CREATE INDEX "loan_review_checks_reviewer_id_idx" ON "public"."loan_review_checks" USING "btree" ("reviewer_id");



CREATE INDEX "notifications_recipient_unread_idx" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC) WHERE ("read_at" IS NULL);



CREATE UNIQUE INDEX "profiles_email_lower_idx" ON "public"."profiles" USING "btree" ("lower"("email"));



CREATE INDEX "transfer_events_actor_id_idx" ON "public"."transfer_events" USING "btree" ("actor_id");



CREATE INDEX "transfer_events_transfer_created_idx" ON "public"."transfer_events" USING "btree" ("transfer_id", "created_at");



CREATE INDEX "transfer_intents_active_review_idx" ON "public"."transfer_intents" USING "btree" ("submitted_at") WHERE ("status" = ANY (ARRAY['submitted'::"text", 'under_review'::"text", 'approved_for_external_execution'::"text", 'external_execution_recorded'::"text"]));



CREATE INDEX "transfer_intents_owner_created_idx" ON "public"."transfer_intents" USING "btree" ("owner_id", "submitted_at" DESC);



CREATE INDEX "transfer_intents_source_position_id_idx" ON "public"."transfer_intents" USING "btree" ("source_position_id");



CREATE INDEX "transfer_review_checks_reviewer_id_idx" ON "public"."transfer_review_checks" USING "btree" ("reviewer_id");



CREATE INDEX "transfer_review_checks_transfer_idx" ON "public"."transfer_review_checks" USING "btree" ("transfer_id");



CREATE OR REPLACE TRIGGER "financial_positions_set_updated_at" BEFORE UPDATE ON "public"."financial_positions" FOR EACH ROW EXECUTE FUNCTION "private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "kyc_applications_set_updated_at" BEFORE UPDATE ON "public"."kyc_applications" FOR EACH ROW EXECUTE FUNCTION "private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "loan_applications_set_updated_at" BEFORE UPDATE ON "public"."loan_applications" FOR EACH ROW EXECUTE FUNCTION "private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "loan_review_checks_set_updated_at" BEFORE UPDATE ON "public"."loan_review_checks" FOR EACH ROW EXECUTE FUNCTION "private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "staff_members_set_updated_at" BEFORE UPDATE ON "public"."staff_members" FOR EACH ROW EXECUTE FUNCTION "private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "transfer_intents_set_updated_at" BEFORE UPDATE ON "public"."transfer_intents" FOR EACH ROW EXECUTE FUNCTION "private"."set_updated_at"();



CREATE OR REPLACE TRIGGER "transfer_review_checks_set_updated_at" BEFORE UPDATE ON "public"."transfer_review_checks" FOR EACH ROW EXECUTE FUNCTION "private"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."external_loan_fundings"
    ADD CONSTRAINT "external_loan_fundings_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."staff_members"("user_id");



ALTER TABLE ONLY "public"."external_loan_fundings"
    ADD CONSTRAINT "external_loan_fundings_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "public"."staff_members"("user_id");



ALTER TABLE ONLY "public"."external_loan_fundings"
    ADD CONSTRAINT "external_loan_fundings_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."external_transfer_executions"
    ADD CONSTRAINT "external_transfer_executions_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."staff_members"("user_id");



ALTER TABLE ONLY "public"."external_transfer_executions"
    ADD CONSTRAINT "external_transfer_executions_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "public"."staff_members"("user_id");



ALTER TABLE ONLY "public"."external_transfer_executions"
    ADD CONSTRAINT "external_transfer_executions_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_positions"
    ADD CONSTRAINT "financial_positions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_applications"
    ADD CONSTRAINT "kyc_applications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_applications"
    ADD CONSTRAINT "kyc_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_members"("user_id");



ALTER TABLE ONLY "public"."kyc_events"
    ADD CONSTRAINT "kyc_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."kyc_events"
    ADD CONSTRAINT "kyc_events_kyc_id_fkey" FOREIGN KEY ("kyc_id") REFERENCES "public"."kyc_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loan_applications"
    ADD CONSTRAINT "loan_applications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loan_events"
    ADD CONSTRAINT "loan_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."loan_events"
    ADD CONSTRAINT "loan_events_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loan_review_checks"
    ADD CONSTRAINT "loan_review_checks_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loan_review_checks"
    ADD CONSTRAINT "loan_review_checks_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."staff_members"("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_members"
    ADD CONSTRAINT "staff_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfer_events"
    ADD CONSTRAINT "transfer_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transfer_events"
    ADD CONSTRAINT "transfer_events_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer_intents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfer_intents"
    ADD CONSTRAINT "transfer_intents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfer_intents"
    ADD CONSTRAINT "transfer_intents_source_position_id_fkey" FOREIGN KEY ("source_position_id") REFERENCES "public"."financial_positions"("id");



ALTER TABLE ONLY "public"."transfer_review_checks"
    ADD CONSTRAINT "transfer_review_checks_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."staff_members"("user_id");



ALTER TABLE ONLY "public"."transfer_review_checks"
    ADD CONSTRAINT "transfer_review_checks_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer_intents"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_events_staff_select" ON "public"."audit_events" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_active_staff"(ARRAY['supervisor'::"text", 'admin'::"text"]) AS "is_active_staff"));



ALTER TABLE "public"."external_loan_fundings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "external_loan_fundings_select_related" ON "public"."external_loan_fundings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."loan_applications" "l"
  WHERE (("l"."id" = "external_loan_fundings"."loan_id") AND (("l"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff"))))));



ALTER TABLE "public"."external_transfer_executions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "external_transfer_executions_select_related" ON "public"."external_transfer_executions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."transfer_intents" "t"
  WHERE (("t"."id" = "external_transfer_executions"."transfer_id") AND (("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff"))))));



ALTER TABLE "public"."financial_positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_positions_select_own_or_staff" ON "public"."financial_positions" FOR SELECT TO "authenticated" USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff")));



ALTER TABLE "public"."kyc_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kyc_applications_select_own_or_staff" ON "public"."kyc_applications" FOR SELECT TO "authenticated" USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff")));



ALTER TABLE "public"."kyc_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kyc_events_select_related" ON "public"."kyc_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."kyc_applications" "k"
  WHERE (("k"."id" = "kyc_events"."kyc_id") AND (("k"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff"))))));



ALTER TABLE "public"."loan_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loan_applications_select_own_or_staff" ON "public"."loan_applications" FOR SELECT TO "authenticated" USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff")));



ALTER TABLE "public"."loan_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loan_events_select_related" ON "public"."loan_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."loan_applications" "l"
  WHERE (("l"."id" = "loan_events"."loan_id") AND (("l"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff"))))));



ALTER TABLE "public"."loan_review_checks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loan_review_checks_select_related" ON "public"."loan_review_checks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."loan_applications" "l"
  WHERE (("l"."id" = "loan_review_checks"."loan_id") AND (("l"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff"))))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("recipient_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("recipient_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("recipient_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own_or_staff" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff")));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."staff_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_members_select_self" ON "public"."staff_members" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."transfer_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transfer_events_select_related" ON "public"."transfer_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."transfer_intents" "t"
  WHERE (("t"."id" = "transfer_events"."transfer_id") AND (("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff"))))));



ALTER TABLE "public"."transfer_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transfer_intents_select_own_or_staff" ON "public"."transfer_intents" FOR SELECT TO "authenticated" USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff")));



ALTER TABLE "public"."transfer_review_checks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transfer_review_checks_select_related" ON "public"."transfer_review_checks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."transfer_intents" "t"
  WHERE (("t"."id" = "transfer_review_checks"."transfer_id") AND (("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "private"."is_active_staff"(NULL::"text"[]) AS "is_active_staff"))))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."ensure_active_user"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."is_active_staff"("required_roles" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_active_staff"("required_roles" "text"[]) TO "authenticated";



GRANT ALL ON TABLE "public"."financial_positions" TO "service_role";
GRANT SELECT ON TABLE "public"."financial_positions" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."adjust_financial_position"("p_position_id" "uuid", "p_delta_minor" bigint, "p_as_of" timestamp with time zone, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adjust_financial_position"("p_position_id" "uuid", "p_delta_minor" bigint, "p_as_of" timestamp with time zone, "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."adjust_financial_position"("p_position_id" "uuid", "p_delta_minor" bigint, "p_as_of" timestamp with time zone, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_app_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."record_financial_position"("p_owner_id" "uuid", "p_label" "text", "p_currency" "text", "p_amount_minor" bigint, "p_as_of" timestamp with time zone, "p_external_identifier_masked" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_financial_position"("p_owner_id" "uuid", "p_label" "text", "p_currency" "text", "p_amount_minor" bigint, "p_as_of" timestamp with time zone, "p_external_identifier_masked" "text", "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."record_financial_position"("p_owner_id" "uuid", "p_label" "text", "p_currency" "text", "p_amount_minor" bigint, "p_as_of" timestamp with time zone, "p_external_identifier_masked" "text", "p_reason" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."kyc_applications" TO "service_role";
GRANT SELECT ON TABLE "public"."kyc_applications" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."review_kyc_application"("p_kyc_id" "uuid", "p_status" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_kyc_application"("p_kyc_id" "uuid", "p_status" "text", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."review_kyc_application"("p_kyc_id" "uuid", "p_status" "text", "p_note" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."loan_applications" TO "service_role";
GRANT SELECT ON TABLE "public"."loan_applications" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."review_loan_check"("p_loan_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_loan_check"("p_loan_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."review_loan_check"("p_loan_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."transfer_intents" TO "service_role";
GRANT SELECT ON TABLE "public"."transfer_intents" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."review_transfer_check"("p_transfer_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_transfer_check"("p_transfer_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."review_transfer_check"("p_transfer_id" "uuid", "p_check_kind" "text", "p_status" "text", "p_note" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("display_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("phone") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("preferred_currency") ON TABLE "public"."profiles" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_user_access_status"("p_user_id" "uuid", "p_status" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_access_status"("p_user_id" "uuid", "p_status" "text", "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_user_access_status"("p_user_id" "uuid", "p_status" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."submit_kyc_application"("p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date", "p_place_of_birth" "text", "p_nationality" "text", "p_address" "jsonb", "p_occupation" "text", "p_income_range" "text", "p_fatca" boolean, "p_pep" boolean, "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_kyc_application"("p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date", "p_place_of_birth" "text", "p_nationality" "text", "p_address" "jsonb", "p_occupation" "text", "p_income_range" "text", "p_fatca" boolean, "p_pep" boolean, "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_kyc_application"("p_first_name" "text", "p_last_name" "text", "p_date_of_birth" "date", "p_place_of_birth" "text", "p_nationality" "text", "p_address" "jsonb", "p_occupation" "text", "p_income_range" "text", "p_fatca" boolean, "p_pep" boolean, "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."submit_loan_application"("p_requested_amount_minor" bigint, "p_currency" "text", "p_duration_months" integer, "p_indicative_monthly_payment_minor" bigint, "p_indicative_annual_rate" numeric, "p_motive" "text", "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_loan_application"("p_requested_amount_minor" bigint, "p_currency" "text", "p_duration_months" integer, "p_indicative_monthly_payment_minor" bigint, "p_indicative_annual_rate" numeric, "p_motive" "text", "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_loan_application"("p_requested_amount_minor" bigint, "p_currency" "text", "p_duration_months" integer, "p_indicative_monthly_payment_minor" bigint, "p_indicative_annual_rate" numeric, "p_motive" "text", "p_document_object_paths" "jsonb", "p_idempotency_key" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."submit_transfer_intent"("p_source_position_id" "uuid", "p_recipient_name" "text", "p_recipient_account_masked" "text", "p_beneficiary_details" "jsonb", "p_transfer_type" "text", "p_amount_minor" bigint, "p_currency" "text", "p_target_amount_minor" bigint, "p_target_currency" "text", "p_quote_rate" numeric, "p_quote_as_of" timestamp with time zone, "p_motive" "text", "p_idempotency_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_transfer_intent"("p_source_position_id" "uuid", "p_recipient_name" "text", "p_recipient_account_masked" "text", "p_beneficiary_details" "jsonb", "p_transfer_type" "text", "p_amount_minor" bigint, "p_currency" "text", "p_target_amount_minor" bigint, "p_target_currency" "text", "p_quote_rate" numeric, "p_quote_as_of" timestamp with time zone, "p_motive" "text", "p_idempotency_key" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_transfer_intent"("p_source_position_id" "uuid", "p_recipient_name" "text", "p_recipient_account_masked" "text", "p_beneficiary_details" "jsonb", "p_transfer_type" "text", "p_amount_minor" bigint, "p_currency" "text", "p_target_amount_minor" bigint, "p_target_currency" "text", "p_quote_rate" numeric, "p_quote_as_of" timestamp with time zone, "p_motive" "text", "p_idempotency_key" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."transition_loan"("p_loan_id" "uuid", "p_action" "text", "p_reason" "text", "p_external_reference" "text", "p_evidence_object_path" "text", "p_executed_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_loan"("p_loan_id" "uuid", "p_action" "text", "p_reason" "text", "p_external_reference" "text", "p_evidence_object_path" "text", "p_executed_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."transition_loan"("p_loan_id" "uuid", "p_action" "text", "p_reason" "text", "p_external_reference" "text", "p_evidence_object_path" "text", "p_executed_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."transition_transfer"("p_transfer_id" "uuid", "p_action" "text", "p_reason" "text", "p_external_reference" "text", "p_evidence_object_path" "text", "p_executed_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_transfer"("p_transfer_id" "uuid", "p_action" "text", "p_reason" "text", "p_external_reference" "text", "p_evidence_object_path" "text", "p_executed_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."transition_transfer"("p_transfer_id" "uuid", "p_action" "text", "p_reason" "text", "p_external_reference" "text", "p_evidence_object_path" "text", "p_executed_at" timestamp with time zone) TO "authenticated";



GRANT ALL ON TABLE "public"."audit_events" TO "service_role";
GRANT SELECT ON TABLE "public"."audit_events" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."audit_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."external_loan_fundings" TO "service_role";
GRANT SELECT ON TABLE "public"."external_loan_fundings" TO "authenticated";



GRANT ALL ON TABLE "public"."external_transfer_executions" TO "service_role";
GRANT SELECT ON TABLE "public"."external_transfer_executions" TO "authenticated";



GRANT ALL ON TABLE "public"."kyc_events" TO "service_role";
GRANT SELECT ON TABLE "public"."kyc_events" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."kyc_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."loan_events" TO "service_role";
GRANT SELECT ON TABLE "public"."loan_events" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."loan_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."loan_review_checks" TO "service_role";
GRANT SELECT ON TABLE "public"."loan_review_checks" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."loan_review_checks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT ON TABLE "public"."notifications" TO "authenticated";



GRANT UPDATE("read_at") ON TABLE "public"."notifications" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_members" TO "service_role";
GRANT SELECT ON TABLE "public"."staff_members" TO "authenticated";



GRANT ALL ON TABLE "public"."transfer_events" TO "service_role";
GRANT SELECT ON TABLE "public"."transfer_events" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."transfer_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transfer_review_checks" TO "service_role";
GRANT SELECT ON TABLE "public"."transfer_review_checks" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."transfer_review_checks_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
