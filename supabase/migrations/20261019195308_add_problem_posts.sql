-- Fixora problem-post foundation. Prepared for review; not applied.
-- Phone numbers are intentionally absent from every table and function here.

create type public.problem_post_status as enum ('open', 'closed', 'removed');
create type public.problem_budget_type as enum ('fixed', 'range', 'open_to_quotes');
create type public.problem_timing as enum ('urgent', 'this_week', 'flexible', 'specific_date');
create type public.problem_job_type as enum ('repair', 'installation', 'maintenance', 'new_project');

create table public.problem_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null check (char_length(trim(description)) between 1 and 2500),
  budget_type public.problem_budget_type not null,
  budget_min_naira bigint,
  budget_max_naira bigint,
  negotiable boolean not null default false,
  country_code text not null default 'NG' check (country_code ~ '^[A-Z]{2}$'),
  region text not null check (char_length(trim(region)) between 1 and 120),
  city text not null check (char_length(trim(city)) between 1 and 120),
  timing public.problem_timing not null default 'flexible',
  target_date date,
  job_type public.problem_job_type not null,
  status public.problem_post_status not null default 'open',
  published_at timestamptz,
  closed_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint problem_posts_budget_valid check (
    (budget_min_naira is null or budget_min_naira <= 100000000000)
    and (budget_max_naira is null or budget_max_naira <= 100000000000)
    and ((budget_type = 'fixed' and budget_min_naira is not null
        and budget_min_naira > 0 and budget_max_naira is null)
      or (budget_type = 'range' and budget_min_naira is not null
        and budget_max_naira is not null and budget_min_naira > 0
        and budget_max_naira >= budget_min_naira)
      or (budget_type = 'open_to_quotes'
        and budget_min_naira is null and budget_max_naira is null))
  ),
  constraint problem_posts_timing_date_valid check (
    (timing = 'specific_date' and target_date is not null)
    or (timing <> 'specific_date' and target_date is null)
  ),
  constraint problem_posts_status_timestamps check (
    (status <> 'closed' or closed_at is not null)
    and (status <> 'removed' or removed_at is not null)
  )
);

create index problem_posts_open_feed_idx
  on public.problem_posts (status, created_at desc, id desc)
  where status = 'open' and published_at is not null;
create index problem_posts_author_feed_idx
  on public.problem_posts (author_id, created_at desc, id desc);
create index problem_posts_category_feed_idx
  on public.problem_posts (category_id, created_at desc, id desc)
  where status = 'open' and published_at is not null;

create table public.problem_post_images (
  post_id uuid not null references public.problem_posts(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  primary key (post_id, sort_order)
);

alter table public.problem_posts enable row level security;
alter table public.problem_post_images enable row level security;

create policy "Signed-in users read open posts and owners read theirs"
  on public.problem_posts for select to authenticated
  using (author_id = (select auth.uid()) or
    (status = 'open' and published_at is not null));
create policy "Customers create their own staged posts"
  on public.problem_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'open'
    and published_at is null and closed_at is null and removed_at is null and exists (
      select 1 from public.profiles p where p.id = (select auth.uid())
        and p.account_type = 'customer'));
create policy "Customers update their own non-removed posts"
  on public.problem_posts for update to authenticated
  using (author_id = (select auth.uid()) and status <> 'removed' and exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
      and p.account_type = 'customer'))
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
      and p.account_type = 'customer'));
create policy "Users read images for visible posts"
  on public.problem_post_images for select to authenticated
  using (exists (select 1 from public.problem_posts p where p.id = post_id
    and (p.author_id = (select auth.uid()) or
      (p.status = 'open' and p.published_at is not null))));
create policy "Customers add images to their posts"
  on public.problem_post_images for insert to authenticated
  with check (exists (select 1 from public.problem_posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = post_id and p.author_id = (select auth.uid())
      and p.status = 'open' and pr.account_type = 'customer')
    and storage_path = (select auth.uid())::text || '/' || post_id::text
      || '/' || sort_order::text || '.jpg');
create policy "Customers remove images from their posts"
  on public.problem_post_images for delete to authenticated
  using (exists (select 1 from public.problem_posts p where p.id = post_id
    and p.author_id = (select auth.uid())));

revoke all on public.problem_posts, public.problem_post_images
  from public, anon, authenticated;
grant select on public.problem_posts to authenticated;
grant insert (author_id, category_id, title, description, budget_type,
  budget_min_naira, budget_max_naira, negotiable, country_code, region, city,
  timing, target_date, job_type) on public.problem_posts to authenticated;
grant update (category_id, title, description, budget_type, budget_min_naira,
  budget_max_naira, negotiable, country_code, region, city, timing,
  target_date, job_type, status)
  on public.problem_posts to authenticated;
grant select, insert, delete on public.problem_post_images to authenticated;

create function public.set_problem_post_timestamps()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  if tg_op = 'UPDATE' then
    if old.status = 'removed' and new is distinct from old then
      raise exception 'Removed posts cannot be changed.' using errcode = '22023';
    end if;
    if new.status is distinct from old.status then
      if new.status = 'closed' then
        new.closed_at := pg_catalog.now();
      elsif new.status = 'open' then
        new.closed_at := null;
      elsif new.status = 'removed' then
        new.removed_at := pg_catalog.now();
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.set_problem_post_timestamps()
  from public, anon, authenticated;
create trigger problem_posts_timestamps
before insert or update on public.problem_posts
for each row execute function public.set_problem_post_timestamps();

create function public.enforce_problem_post_staging_limit()
returns trigger language plpgsql set search_path = '' as $$
declare staged_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.author_id::text, 0));
  select count(*) into staged_count from public.problem_posts p
  where p.author_id = new.author_id and p.published_at is null
    and p.status <> 'removed'
    and p.created_at >= pg_catalog.now() - interval '24 hours';
  if staged_count >= 3 then
    raise exception 'Unpublished post limit reached. Try again later.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_problem_post_staging_limit()
  from public, anon, authenticated;
create trigger problem_posts_staging_limit
before insert on public.problem_posts
for each row execute function public.enforce_problem_post_staging_limit();

create function public.enforce_problem_post_image_limit()
returns trigger language plpgsql set search_path = '' as $$
declare image_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.post_id::text, 0));
  select count(*) into image_count from public.problem_post_images i
  where i.post_id = new.post_id;
  if image_count >= 5 then
    raise exception 'A post can have at most five photos.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_problem_post_image_limit()
  from public, anon, authenticated;
create trigger problem_post_images_limit
before insert on public.problem_post_images
for each row execute function public.enforce_problem_post_image_limit();

create function public.publish_problem_post(requested_post_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  published_time timestamptz;
  current_user_id uuid := auth.uid();
  published_count integer;
begin
  if current_user_id is null or not exists (
    select 1 from public.problem_posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = requested_post_id and p.author_id = current_user_id
      and pr.account_type = 'customer' and p.status = 'open'
      and p.published_at is null
  ) then
    raise exception 'Post cannot be published.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0));
  select count(*) into published_count from public.problem_posts p
  where p.author_id = current_user_id and p.published_at is not null
    and p.published_at >= pg_catalog.now() - interval '24 hours';
  if published_count >= 5 then
    raise exception 'Post limit reached. Try again later.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.problem_post_images i
    left join storage.objects o on o.bucket_id = 'problem-post-photos'
      and o.name = i.storage_path
    where i.post_id = requested_post_id and o.id is null
  ) then
    raise exception 'Some post photos are not ready.' using errcode = '23514';
  end if;
  update public.problem_posts p set published_at = pg_catalog.now()
  where p.id = requested_post_id and p.author_id = current_user_id
    and p.status = 'open' and p.published_at is null
  returning p.published_at into published_time;
  if published_time is null then
    raise exception 'Post cannot be published.' using errcode = '42501';
  end if;
  return published_time;
end;
$$;
revoke all on function public.publish_problem_post(uuid)
  from public, anon, authenticated;
grant execute on function public.publish_problem_post(uuid) to authenticated;

create function public.get_problem_post_author_cards(requested_post_ids uuid[])
returns table (post_id uuid, author_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id,
    pg_catalog.left(
      case when cardinality(n.parts) > 1
        then n.parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(
          n.parts[cardinality(n.parts)], 1)) || '.'
        else n.parts[1] end,
      20)
  from public.problem_posts p
  join public.profiles pr on pr.id = p.author_id
  cross join lateral (select pg_catalog.regexp_split_to_array(
    coalesce(nullif(pg_catalog.btrim(pr.full_name), ''), 'Fixora member'),
    '\s+') as parts) n
  where (select auth.uid()) is not null
    and cardinality(coalesce(requested_post_ids, array[]::uuid[])) between 1 and 20
    and p.id = any(requested_post_ids)
    and (p.author_id = (select auth.uid()) or
      (p.status = 'open' and p.published_at is not null));
$$;
revoke all on function public.get_problem_post_author_cards(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_problem_post_author_cards(uuid[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('problem-post-photos', 'problem-post-photos', false, 1048576,
  array['image/jpeg']);
create policy "Users read photos for visible posts" on storage.objects
  for select to authenticated using (
    bucket_id = 'problem-post-photos' and exists (
      select 1 from public.problem_post_images i
      join public.problem_posts p on p.id = i.post_id
      where i.storage_path = name and
        (p.author_id = (select auth.uid()) or
          (p.status = 'open' and p.published_at is not null))));
create policy "Customers upload post photos to their own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'problem-post-photos'
    and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
    and pg_catalog.split_part(name, '/', 3) ~ '^[0-4]\.jpg$'
    and name = pg_catalog.split_part(name, '/', 1) || '/'
      || pg_catalog.split_part(name, '/', 2) || '/'
      || pg_catalog.split_part(name, '/', 3)
    and exists (select 1 from public.problem_posts p
      join public.profiles pr on pr.id = p.author_id
      where p.id::text = pg_catalog.split_part(name, '/', 2)
        and p.author_id = (select auth.uid()) and pr.account_type = 'customer'
        and p.status = 'open')
    and exists (select 1 from public.problem_post_images i
      where i.storage_path = name
        and i.post_id::text = pg_catalog.split_part(name, '/', 2)));
create policy "Customers delete photos from their own posts" on storage.objects
  for delete to authenticated using (
    bucket_id = 'problem-post-photos'
    and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.problem_post_images i
      join public.problem_posts p on p.id = i.post_id
      where i.storage_path = name and p.author_id = (select auth.uid())));
-- No anon access or UPDATE/upsert. Upload each JPEG with upsert=false.
-- A reserved image row can exist briefly before its file uploads. If upload
-- fails, the client must delete that reservation (and retry or discard it).
-- Deleting an image reservation does not delete its Storage object. The client
-- must delete the object first; Storage DELETE above authorizes that cleanup.
