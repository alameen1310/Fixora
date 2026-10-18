-- Fixora's first Auth and profile foundation. No private contact data is public.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone_number text,
  phone_verified_at timestamptz,
  account_type text check (account_type in ('customer', 'provider')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (full_name is null or char_length(trim(full_name)) between 1 and 120),
  constraint profiles_phone_e164 check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{6,14}$'),
  constraint profiles_phone_verification_not_without_phone check (phone_verified_at is null or phone_number is not null)
);

create table public.provider_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  provider_type text not null check (provider_type in ('individual', 'business')),
  service_description text not null default '' check (char_length(service_description) <= 1000),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.provider_service_categories (
  provider_id uuid not null references public.provider_profiles (profile_id) on delete cascade,
  category_id uuid not null references public.service_categories (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (provider_id, category_id)
);

create table public.provider_service_areas (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (profile_id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  region text not null check (char_length(trim(region)) between 1 and 120),
  city text not null check (char_length(trim(city)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (provider_id, country_code, region, city)
);

create index provider_profiles_published_idx on public.provider_profiles (is_published) where is_published;
create index provider_service_categories_category_idx on public.provider_service_categories (category_id, provider_id);
create index provider_service_areas_lookup_idx on public.provider_service_areas (country_code, region, city);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger provider_profiles_set_updated_at
before update on public.provider_profiles
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  submitted_phone text := metadata ->> 'phone_number';
begin
  insert into public.profiles (id, full_name, phone_number)
  values (
    new.id,
    coalesce(nullif(trim(metadata ->> 'full_name'), ''), nullif(trim(metadata ->> 'name'), '')),
    case when submitted_phone ~ '^\+[1-9][0-9]{6,14}$' then submitted_phone else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_fixora_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill any existing Auth accounts without overwriting a profile row.
insert into public.profiles (id, full_name, phone_number)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), '')),
  case
    when u.raw_user_meta_data ->> 'phone_number' ~ '^\+[1-9][0-9]{6,14}$'
      then u.raw_user_meta_data ->> 'phone_number'
    else null
  end
from auth.users u
on conflict (id) do nothing;

create function public.choose_account_type(requested_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if requested_type not in ('customer', 'provider') then
    raise exception 'Choose a valid account type.' using errcode = '22023';
  end if;

  update public.profiles
  set account_type = requested_type
  where id = auth.uid() and account_type is null
  returning account_type into existing_type;

  if existing_type is not null then
    return existing_type;
  end if;

  select account_type into existing_type
  from public.profiles where id = auth.uid();
  if existing_type is null then
    raise exception 'Profile is not ready yet.' using errcode = 'P0002';
  end if;
  if existing_type <> requested_type then
    raise exception 'Account type has already been selected.' using errcode = '42501';
  end if;
  return existing_type;
end;
$$;

create function public.complete_onboarding()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_type text;
  completion_time timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select account_type into current_type
  from public.profiles
  where id = current_user_id
    and full_name is not null
    and phone_number ~ '^\+[1-9][0-9]{6,14}$';

  if current_type is null then
    raise exception 'Add your name and a valid phone number before continuing.' using errcode = '22023';
  end if;

  if current_type = 'provider' and not exists (
    select 1 from public.provider_profiles pp
    where pp.profile_id = current_user_id
      and exists (select 1 from public.provider_service_categories psc where psc.provider_id = current_user_id)
      and exists (select 1 from public.provider_service_areas psa where psa.provider_id = current_user_id)
  ) then
    raise exception 'Complete your professional profile, services, and service areas before continuing.' using errcode = '22023';
  end if;

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = current_user_id
  returning onboarding_completed_at into completion_time;

  if current_type = 'provider' then
    update public.provider_profiles
    set is_published = true
    where profile_id = current_user_id;
  end if;

  return completion_time;
end;
$$;

create function public.replace_provider_service_categories(requested_category_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  unique_count integer;
  matching_count integer;
begin
  if current_user_id is null or not exists (
    select 1 from public.profiles p where p.id = current_user_id and p.account_type = 'provider'
  ) then
    raise exception 'A provider account is required.' using errcode = '42501';
  end if;
  if requested_category_ids is null or cardinality(requested_category_ids) = 0 then
    raise exception 'Choose at least one service category.' using errcode = '22023';
  end if;

  select count(*), count(distinct category_id)
  into unique_count, matching_count
  from unnest(requested_category_ids) as ids(category_id);
  if unique_count <> cardinality(requested_category_ids)
    or matching_count <> (select count(*) from public.service_categories c where c.id = any(requested_category_ids)) then
    raise exception 'One or more service categories are invalid.' using errcode = '22023';
  end if;

  delete from public.provider_service_categories where provider_id = current_user_id;
  insert into public.provider_service_categories (provider_id, category_id)
  select current_user_id, category_id from unnest(requested_category_ids) as ids(category_id);
end;
$$;

create function public.replace_provider_service_areas(requested_areas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not exists (
    select 1 from public.profiles p where p.id = current_user_id and p.account_type = 'provider'
  ) then
    raise exception 'A provider account is required.' using errcode = '42501';
  end if;
  if requested_areas is null or jsonb_typeof(requested_areas) is distinct from 'array' then
    raise exception 'Add at least one service area.' using errcode = '22023';
  end if;
  if jsonb_array_length(requested_areas) = 0 then
    raise exception 'Add at least one service area.' using errcode = '22023';
  end if;

  delete from public.provider_service_areas where provider_id = current_user_id;
  insert into public.provider_service_areas (provider_id, country_code, region, city)
  select
    current_user_id,
    upper(trim(area ->> 'country_code')),
    trim(area ->> 'region'),
    trim(area ->> 'city')
  from jsonb_array_elements(requested_areas) as areas(area);
end;
$$;

alter table public.profiles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.service_categories enable row level security;
alter table public.provider_service_categories enable row level security;
alter table public.provider_service_areas enable row level security;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile details"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Anyone can read published provider profiles"
on public.provider_profiles for select to anon, authenticated
using (is_published or (select auth.uid()) = profile_id);

create policy "Providers can create their own professional profile"
on public.provider_profiles for insert to authenticated
with check (
  (select auth.uid()) = profile_id
  and exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.account_type = 'provider'
  )
);

create policy "Providers can update their own professional profile"
on public.provider_profiles for update to authenticated
using ((select auth.uid()) = profile_id)
with check (
  (select auth.uid()) = profile_id
  and exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.account_type = 'provider'
  )
);

create policy "Service categories are readable"
on public.service_categories for select to anon, authenticated
using (true);

create policy "Published provider categories are readable"
on public.provider_service_categories for select to anon, authenticated
using (
  (select auth.uid()) = provider_id
  or exists (
    select 1 from public.provider_profiles pp
    where pp.profile_id = provider_id and pp.is_published
  )
);

create policy "Providers can manage their own service categories"
on public.provider_service_categories for insert to authenticated
with check (
  (select auth.uid()) = provider_id
  and exists (
    select 1 from public.profiles p
    where p.id = provider_id and p.account_type = 'provider'
  )
);

create policy "Providers can remove their own service categories"
on public.provider_service_categories for delete to authenticated
using ((select auth.uid()) = provider_id);

create policy "Published provider service areas are readable"
on public.provider_service_areas for select to anon, authenticated
using (
  (select auth.uid()) = provider_id
  or exists (
    select 1 from public.provider_profiles pp
    where pp.profile_id = provider_id and pp.is_published
  )
);

create policy "Providers can create their own service areas"
on public.provider_service_areas for insert to authenticated
with check (
  (select auth.uid()) = provider_id
  and exists (
    select 1 from public.profiles p
    where p.id = provider_id and p.account_type = 'provider'
  )
);

create policy "Providers can update their own service areas"
on public.provider_service_areas for update to authenticated
using ((select auth.uid()) = provider_id)
with check ((select auth.uid()) = provider_id);

create policy "Providers can remove their own service areas"
on public.provider_service_areas for delete to authenticated
using ((select auth.uid()) = provider_id);

revoke all on table public.profiles, public.provider_profiles, public.service_categories,
  public.provider_service_categories, public.provider_service_areas from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone_number) on public.profiles to authenticated;
grant select on public.provider_profiles to anon, authenticated;
grant insert (profile_id, display_name, provider_type, service_description) on public.provider_profiles to authenticated;
grant update (display_name, provider_type, service_description) on public.provider_profiles to authenticated;
grant select on public.service_categories to anon, authenticated;
grant select, insert, delete on public.provider_service_categories to authenticated;
grant select, insert, update, delete on public.provider_service_areas to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.choose_account_type(text) from public, anon, authenticated;
revoke all on function public.complete_onboarding() from public, anon, authenticated;
revoke all on function public.replace_provider_service_categories(uuid[]) from public, anon, authenticated;
revoke all on function public.replace_provider_service_areas(jsonb) from public, anon, authenticated;
grant execute on function public.choose_account_type(text) to authenticated;
grant execute on function public.complete_onboarding() to authenticated;
grant execute on function public.replace_provider_service_categories(uuid[]) to authenticated;
grant execute on function public.replace_provider_service_areas(jsonb) to authenticated;

insert into public.service_categories (slug, name) values
  ('repairs', 'Repairs'),
  ('plumbing', 'Plumbing'),
  ('installations', 'Installations'),
  ('electrical', 'Electrical'),
  ('maintenance', 'Maintenance'),
  ('renovation', 'Renovation')
on conflict (slug) do update set name = excluded.name;
