-- Persist the user's display and transactional-email language.
-- This value is a preference only and must never be used for authorization.
alter table public.profiles
add column preferred_language text not null default 'fr'
  constraint profiles_preferred_language_allowed
  check (preferred_language in ('fr', 'en', 'de', 'es'));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    user_id,
    email,
    display_name,
    preferred_language
  )
  values (
    new.id,
    coalesce(new.email, ''),
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')),
    case
      when new.raw_user_meta_data ->> 'preferred_language'
        in ('fr', 'en', 'de', 'es')
      then new.raw_user_meta_data ->> 'preferred_language'
      else 'fr'
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
