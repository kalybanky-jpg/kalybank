-- Cover every foreign key used by referential checks and staff/audit lookups.
-- The database contains no production rows yet, so these indexes are created
-- before traffic without a concurrent-build exception.

create index if not exists audit_events_actor_id_idx
  on public.audit_events (actor_id);

create index if not exists external_loan_fundings_confirmed_by_idx
  on public.external_loan_fundings (confirmed_by);

create index if not exists external_loan_fundings_executed_by_idx
  on public.external_loan_fundings (executed_by);

create index if not exists external_transfer_executions_confirmed_by_idx
  on public.external_transfer_executions (confirmed_by);

create index if not exists external_transfer_executions_executed_by_idx
  on public.external_transfer_executions (executed_by);

create index if not exists kyc_applications_reviewed_by_idx
  on public.kyc_applications (reviewed_by);

create index if not exists kyc_events_actor_id_idx
  on public.kyc_events (actor_id);

create index if not exists loan_events_actor_id_idx
  on public.loan_events (actor_id);

create index if not exists loan_review_checks_reviewer_id_idx
  on public.loan_review_checks (reviewer_id);

create index if not exists transfer_events_actor_id_idx
  on public.transfer_events (actor_id);

create index if not exists transfer_intents_source_position_id_idx
  on public.transfer_intents (source_position_id);

create index if not exists transfer_review_checks_reviewer_id_idx
  on public.transfer_review_checks (reviewer_id);
