create table public.brand_settings (
  singleton boolean primary key default true,
  bank_name text not null,
  primary_logo_path text not null,
  primary_logo_width integer not null,
  primary_logo_height integer not null,
  reversed_logo_path text not null,
  reversed_logo_width integer not null,
  reversed_logo_height integer not null,
  email_logo_path text not null,
  pdf_logo_path text not null,
  favicon_ico_path text not null,
  favicon_16_path text not null,
  favicon_32_path text not null,
  favicon_48_path text not null,
  apple_touch_icon_path text not null,
  app_icon_192_path text not null,
  app_icon_512_path text not null,
  maskable_icon_path text not null,
  social_card_path text not null,
  revision bigint not null default 1,
  updated_by uuid references public.staff_members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_settings_singleton_check check (singleton),
  constraint brand_settings_bank_name_check check (
    char_length(bank_name) between 2 and 80
    and bank_name = btrim(bank_name)
    and bank_name !~ '[\x00-\x1F\x7F]'
  ),
  constraint brand_settings_primary_dimensions_check check (
    primary_logo_width between 1 and 4096
    and primary_logo_height between 1 and 4096
    and primary_logo_width::bigint * primary_logo_height::bigint <= 20000000
  ),
  constraint brand_settings_reversed_dimensions_check check (
    reversed_logo_width between 1 and 4096
    and reversed_logo_height between 1 and 4096
    and reversed_logo_width::bigint * reversed_logo_height::bigint <= 20000000
  ),
  constraint brand_settings_revision_check check (revision > 0),
  constraint brand_settings_asset_paths_check check (
    char_length(primary_logo_path) between 3 and 500
    and char_length(reversed_logo_path) between 3 and 500
    and char_length(email_logo_path) between 3 and 500
    and char_length(pdf_logo_path) between 3 and 500
    and char_length(favicon_ico_path) between 3 and 500
    and char_length(favicon_16_path) between 3 and 500
    and char_length(favicon_32_path) between 3 and 500
    and char_length(favicon_48_path) between 3 and 500
    and char_length(apple_touch_icon_path) between 3 and 500
    and char_length(app_icon_192_path) between 3 and 500
    and char_length(app_icon_512_path) between 3 and 500
    and char_length(maskable_icon_path) between 3 and 500
    and char_length(social_card_path) between 3 and 500
  )
);

comment on table public.brand_settings is
  'Singleton containing the currently published, public bank identity.';
comment on column public.brand_settings.revision is
  'Monotonic optimistic-lock revision incremented by each atomic publication.';

create trigger brand_settings_set_updated_at
before update on public.brand_settings
for each row execute function private.set_updated_at();

alter table public.brand_settings enable row level security;

create policy brand_settings_public_select
on public.brand_settings
for select
to anon, authenticated
using (true);

revoke all on table public.brand_settings
from public, anon, authenticated, service_role;
grant select on table public.brand_settings to anon, authenticated;
grant select, insert, update, delete on table public.brand_settings to service_role;

insert into public.brand_settings (
  singleton,
  bank_name,
  primary_logo_path,
  primary_logo_width,
  primary_logo_height,
  reversed_logo_path,
  reversed_logo_width,
  reversed_logo_height,
  email_logo_path,
  pdf_logo_path,
  favicon_ico_path,
  favicon_16_path,
  favicon_32_path,
  favicon_48_path,
  apple_touch_icon_path,
  app_icon_192_path,
  app_icon_512_path,
  maskable_icon_path,
  social_card_path,
  revision
) values (
  true,
  'Monalyz',
  '/brand/monalyz/monalyz-wordmark-primary.png',
  1120,
  320,
  '/brand/monalyz/monalyz-wordmark-reversed-white.png',
  1120,
  320,
  '/brand/monalyz/monalyz-wordmark-email-360.png',
  '/brand/monalyz/monalyz-wordmark-reversed-white.png',
  '/brand/monalyz/monalyz-favicon.ico',
  '/brand/monalyz/monalyz-favicon-16.png',
  '/brand/monalyz/monalyz-favicon-32.png',
  '/brand/monalyz/monalyz-favicon-48.png',
  '/brand/monalyz/monalyz-apple-touch-icon-180.png',
  '/brand/monalyz/monalyz-app-icon-192.png',
  '/brand/monalyz/monalyz-app-icon-512.png',
  '/brand/monalyz/monalyz-maskable-icon-512.png',
  '/brand/monalyz/monalyz-opengraph-1200x630.png',
  1
);

alter table public.official_documents
  add column brand_name_snapshot text not null default 'Monalyz',
  add column brand_revision_snapshot bigint not null default 1,
  add column brand_logo_path_snapshot text not null
    default '/brand/monalyz/monalyz-wordmark-reversed-white.png';

comment on column public.official_documents.brand_name_snapshot is
  'Published bank name captured when the immutable document version is created.';
comment on column public.official_documents.brand_revision_snapshot is
  'Published brand revision captured when the immutable document version is created.';
comment on column public.official_documents.brand_logo_path_snapshot is
  'Versioned PDF logo path captured when the immutable document version is created.';

create function private.snapshot_official_document_brand()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select bank_name, revision, pdf_logo_path
  into
    new.brand_name_snapshot,
    new.brand_revision_snapshot,
    new.brand_logo_path_snapshot
  from public.brand_settings
  where singleton = true;

  if new.brand_name_snapshot is null then
    raise exception 'BRAND_SETTINGS_NOT_FOUND' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create trigger official_documents_brand_snapshot
before insert on public.official_documents
for each row execute function private.snapshot_official_document_brand();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'brand-assets',
  'brand-assets',
  true,
  5242880,
  array['image/png', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function public.publish_brand_settings(
  p_expected_revision bigint,
  p_bank_name text,
  p_primary_logo_path text,
  p_primary_logo_width integer,
  p_primary_logo_height integer,
  p_reversed_logo_path text,
  p_reversed_logo_width integer,
  p_reversed_logo_height integer,
  p_email_logo_path text,
  p_pdf_logo_path text,
  p_favicon_ico_path text,
  p_favicon_16_path text,
  p_favicon_32_path text,
  p_favicon_48_path text,
  p_apple_touch_icon_path text,
  p_app_icon_192_path text,
  p_app_icon_512_path text,
  p_maskable_icon_path text,
  p_social_card_path text
) returns public.brand_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.ensure_branch_manager();
  normalized_name text := btrim(coalesce(p_bank_name, ''));
  previous_settings public.brand_settings;
  published_settings public.brand_settings;
begin
  select *
  into previous_settings
  from public.brand_settings
  where singleton = true
  for update;

  if previous_settings.singleton is null then
    raise exception 'BRAND_SETTINGS_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_revision is null
     or previous_settings.revision <> p_expected_revision then
    raise exception 'BRAND_REVISION_CONFLICT' using errcode = '40001';
  end if;
  if char_length(normalized_name) not between 2 and 80
     or normalized_name ~ '[\x00-\x1F\x7F]' then
    raise exception 'INVALID_BRAND_NAME' using errcode = '22023';
  end if;
  if p_primary_logo_width is null
     or p_primary_logo_height is null
     or p_primary_logo_width not between 1 and 4096
     or p_primary_logo_height not between 1 and 4096
     or p_primary_logo_width::bigint * p_primary_logo_height::bigint > 20000000
     or p_reversed_logo_width is null
     or p_reversed_logo_height is null
     or p_reversed_logo_width not between 1 and 4096
     or p_reversed_logo_height not between 1 and 4096
     or p_reversed_logo_width::bigint * p_reversed_logo_height::bigint > 20000000 then
    raise exception 'INVALID_BRAND_LOGO_DIMENSIONS' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(array[
      p_primary_logo_path, p_reversed_logo_path, p_email_logo_path,
      p_pdf_logo_path, p_favicon_ico_path, p_favicon_16_path,
      p_favicon_32_path, p_favicon_48_path, p_apple_touch_icon_path,
      p_app_icon_192_path, p_app_icon_512_path, p_maskable_icon_path,
      p_social_card_path
    ]) path
    where path is null or char_length(path) not between 3 and 500
  ) then
    raise exception 'INVALID_BRAND_ASSET_PATH' using errcode = '22023';
  end if;

  update public.brand_settings
  set
    bank_name = normalized_name,
    primary_logo_path = p_primary_logo_path,
    primary_logo_width = p_primary_logo_width,
    primary_logo_height = p_primary_logo_height,
    reversed_logo_path = p_reversed_logo_path,
    reversed_logo_width = p_reversed_logo_width,
    reversed_logo_height = p_reversed_logo_height,
    email_logo_path = p_email_logo_path,
    pdf_logo_path = p_pdf_logo_path,
    favicon_ico_path = p_favicon_ico_path,
    favicon_16_path = p_favicon_16_path,
    favicon_32_path = p_favicon_32_path,
    favicon_48_path = p_favicon_48_path,
    apple_touch_icon_path = p_apple_touch_icon_path,
    app_icon_192_path = p_app_icon_192_path,
    app_icon_512_path = p_app_icon_512_path,
    maskable_icon_path = p_maskable_icon_path,
    social_card_path = p_social_card_path,
    revision = revision + 1,
    updated_by = caller_id
  where singleton = true
  returning * into published_settings;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    caller_id,
    'branch_manager_publish_brand_settings',
    'brand_settings',
    null,
    jsonb_build_object(
      'before', jsonb_build_object(
        'bankName', previous_settings.bank_name,
        'revision', previous_settings.revision,
        'primaryLogoPath', previous_settings.primary_logo_path,
        'reversedLogoPath', previous_settings.reversed_logo_path,
        'faviconPath', previous_settings.favicon_32_path
      ),
      'after', jsonb_build_object(
        'bankName', published_settings.bank_name,
        'revision', published_settings.revision,
        'primaryLogoPath', published_settings.primary_logo_path,
        'reversedLogoPath', published_settings.reversed_logo_path,
        'faviconPath', published_settings.favicon_32_path
      )
    )
  );

  return published_settings;
end;
$$;

revoke all on function public.publish_brand_settings(
  bigint, text, text, integer, integer, text, integer, integer,
  text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.publish_brand_settings(
  bigint, text, text, integer, integer, text, integer, integer,
  text, text, text, text, text, text, text, text, text, text, text
) to authenticated, service_role;
