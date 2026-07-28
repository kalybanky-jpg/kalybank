-- Cover the optional auth.users foreign key used for worker claim diagnostics.
create index if not exists transactional_email_outbox_claimed_by_idx
  on public.transactional_email_outbox (claimed_by)
  where claimed_by is not null;
