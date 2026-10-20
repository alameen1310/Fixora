-- Hackathon photo upload repair: authorize by owner folder, not post visibility.
-- Public URLs make marketplace photos visible to anyone who has the link.

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'problem-post-photos';

drop policy if exists "Users read photos for visible posts" on storage.objects;
drop policy if exists "Users read photos for eligible posts" on storage.objects;
drop policy if exists "Customers upload post photos to their own folder" on storage.objects;
drop policy if exists "Customers delete photos from their own posts" on storage.objects;

create policy "Signed-in users read post photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'problem-post-photos');

create policy "Users upload post photos to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'problem-post-photos'
    and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "Users delete post photos from their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'problem-post-photos'
    and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
  );

drop policy if exists "Users read images for visible posts" on public.problem_post_images;
drop policy if exists "Users read images for eligible posts" on public.problem_post_images;
drop policy if exists "Signed-in users read eligible posts" on public.problem_post_images;
drop policy if exists "Customers add images to their posts" on public.problem_post_images;
drop policy if exists "Customers remove images from their posts" on public.problem_post_images;

create policy "Signed-in users read post images"
  on public.problem_post_images for select to authenticated
  using (true);

create policy "Post owners add images in any status"
  on public.problem_post_images for insert to authenticated
  with check (fixora_private.is_problem_post_owner(post_id));

create policy "Post owners remove images in any status"
  on public.problem_post_images for delete to authenticated
  using (fixora_private.is_problem_post_owner(post_id));

create or replace function public.enforce_problem_post_staging_limit()
returns trigger language plpgsql set search_path = '' as $$
declare staged_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.author_id::text, 0));
  select count(*) into staged_count from public.problem_posts p
  where p.author_id = new.author_id and p.published_at is null
    and p.status <> 'removed'
    and p.created_at >= pg_catalog.now() - interval '24 hours';
  if staged_count >= 20 then
    raise exception 'Unpublished post limit reached. Try again later.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.publish_problem_post(requested_post_id uuid)
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
  if published_count >= 100 then
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
