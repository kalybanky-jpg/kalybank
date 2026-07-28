-- RLS remains the row-level boundary. Limit authenticated updates to the
-- user-editable preference fields; identity and access fields stay protected.
grant update (
  display_name,
  phone,
  preferred_currency,
  preferred_language
) on table public.profiles to authenticated;
