drop index if exists public.transactional_email_outbox_retry_idx;
create index transactional_email_outbox_retry_idx
  on public.transactional_email_outbox (status, claimed_at, created_at)
  where status in ('pending', 'sending') and attempts < 5;

create or replace function private.claim_transactional_emails_internal(
  p_limit integer,
  p_recipient_id uuid
)
returns setof public.transactional_email_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_role text := coalesce((select auth.jwt() ->> 'role'), '');
begin
  if worker_role <> 'service_role' then
    raise exception 'EMAIL_WORKER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 20 then
    raise exception 'INVALID_EMAIL_BATCH_SIZE' using errcode = '22023';
  end if;

  update public.transactional_email_outbox
  set
    status = 'failed',
    claim_token = null,
    last_error =
      'Nombre maximal de tentatives atteint après expiration de la réclamation.'
  where status = 'sending'
    and attempts >= 5
    and claimed_at < now() - interval '10 minutes'
    and (p_recipient_id is null or recipient_id = p_recipient_id);

  return query
  with claimable as (
    select email.id
    from public.transactional_email_outbox as email
    where email.attempts < 5
      and (p_recipient_id is null or email.recipient_id = p_recipient_id)
      and (
        (
          email.status = 'pending'
          and (
            email.attempts = 0
            or email.claimed_at <= now() - (
              least(
                30,
                power(2, greatest(email.attempts - 1, 0))::integer
              ) * interval '1 minute'
            )
          )
        )
        or (
          email.status = 'sending'
          and email.claimed_at < now() - interval '10 minutes'
        )
      )
    order by email.created_at
    limit p_limit
    for update skip locked
  )
  update public.transactional_email_outbox as email
  set
    status = 'sending',
    attempts = email.attempts + 1,
    claimed_by = null,
    claim_token = gen_random_uuid(),
    claimed_at = now(),
    last_error = null
  from claimable
  where email.id = claimable.id
  returning email.*;
end;
$$;

create or replace function public.claim_transactional_emails(
  p_limit integer default 10
)
returns setof public.transactional_email_outbox
language sql
security definer
set search_path = ''
as $$
  select *
  from private.claim_transactional_emails_internal(p_limit, null);
$$;

create or replace function public.claim_transactional_emails_for_recipient(
  p_recipient_id uuid,
  p_limit integer default 10
)
returns setof public.transactional_email_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient_id is null then
    raise exception 'EMAIL_RECIPIENT_REQUIRED' using errcode = '22023';
  end if;

  return query
  select *
  from private.claim_transactional_emails_internal(p_limit, p_recipient_id);
end;
$$;

revoke all on function private.claim_transactional_emails_internal(integer, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.claim_transactional_emails(integer)
  from public, anon, authenticated;
grant execute on function public.claim_transactional_emails(integer)
  to service_role;

revoke all on function public.claim_transactional_emails_for_recipient(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_transactional_emails_for_recipient(uuid, integer)
  to service_role;

comment on function public.claim_transactional_emails_for_recipient(uuid, integer)
is 'Atomically claims due transactional emails for one authenticated workflow owner.';
