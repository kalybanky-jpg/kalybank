insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'upload-staging',
  'upload-staging',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Final evidence buckets are write-only through the privileged finalization
-- route. Browser sessions receive a signed capability for upload-staging, then
-- the server validates and moves the object inside Storage. Keeping the legacy
-- INSERT/UPDATE policies would let a client bypass that validation entirely.
drop policy if exists kyc_evidence_insert_own on storage.objects;
drop policy if exists loan_evidence_insert_own on storage.objects;
drop policy if exists external_execution_evidence_staff_insert on storage.objects;
drop policy if exists kyc_evidence_update_current_requested on storage.objects;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC unless the owner
-- changes its default privileges. Start from a closed set for both existing
-- and future application functions, then expose only the supported RPCs.
revoke execute on all functions in schema public
  from public, anon, authenticated;
revoke execute on all functions in schema private
  from public, anon, authenticated;
-- Server-side workers remain trusted and must not lose access when new RPCs
-- are introduced.
grant execute on all functions in schema public, private to service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
alter default privileges for role postgres in schema private
  grant execute on functions to service_role;

-- RLS policies call this helper while evaluating authenticated requests.
grant execute on function private.is_active_staff(text[]) to authenticated;

grant execute on function
  public.begin_kyc_review(uuid),
  public.branch_manager_adjust_balance(uuid, bigint, timestamp with time zone, text, uuid),
  public.branch_manager_approve_loan(uuid, text),
  public.branch_manager_declare_account(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    bigint,
    timestamp with time zone,
    boolean,
    text,
    uuid
  ),
  public.branch_manager_disburse_loan(uuid, uuid, text),
  public.branch_manager_issue_official_document(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    date,
    uuid
  ),
  public.branch_manager_reject_loan(uuid, text),
  public.branch_manager_reject_transfer(uuid, text),
  public.branch_manager_review_transfer_check(uuid, text, text),
  public.branch_manager_revoke_official_document(uuid, text),
  public.current_app_role(),
  public.decide_kyc_application(uuid, text, text, text),
  public.get_account_number_configuration(),
  public.mark_notification_read(uuid),
  public.publish_brand_settings(
    bigint,
    text,
    text,
    integer,
    integer,
    text,
    integer,
    integer,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text
  ),
  public.request_kyc_information(uuid, text[], text, text, timestamp with time zone),
  public.resubmit_kyc_application(uuid, jsonb, jsonb),
  public.save_kyc_draft(integer, jsonb, jsonb, text),
  public.set_account_number_prefix(text),
  public.set_user_access_status(uuid, text, text),
  public.submit_kyc_application(
    text,
    text,
    date,
    text,
    text,
    jsonb,
    text,
    text,
    boolean,
    boolean,
    text,
    text,
    text,
    date,
    jsonb,
    uuid
  ),
  public.submit_loan_application(bigint, text, integer, text, jsonb, uuid),
  public.submit_transfer_intent(
    uuid,
    text,
    text,
    jsonb,
    text,
    bigint,
    text,
    bigint,
    text,
    numeric,
    timestamp with time zone,
    text,
    uuid
  ),
  public.update_kyc_review_checklist(uuid, text, text, text, text, text, text, text),
  public.update_loan_product_settings(
    text,
    bigint,
    bigint,
    integer,
    integer,
    integer,
    numeric,
    text,
    boolean
  )
to authenticated;
