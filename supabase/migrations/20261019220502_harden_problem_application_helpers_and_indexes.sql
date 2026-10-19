-- Keep policy helpers out of the exposed REST schema and cover new foreign keys.
create schema fixora_private;
revoke all on schema fixora_private from public, anon, authenticated;
grant usage on schema fixora_private to authenticated;

create function fixora_private.can_view_problem_post(requested_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.problem_posts p where p.id = requested_post_id and (
      p.author_id = (select auth.uid())
      or (p.status = 'open' and p.published_at is not null)
      or (p.status = 'closed' and p.published_at is not null and exists (
        select 1 from public.problem_post_applications a
        where a.post_id = p.id and a.professional_id = (select auth.uid())
      ))
    )
  );
$$;
revoke all on function fixora_private.can_view_problem_post(uuid) from public, anon, authenticated;
grant execute on function fixora_private.can_view_problem_post(uuid) to authenticated;

create function fixora_private.is_problem_post_owner(requested_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.problem_posts p where p.id = requested_post_id and p.author_id = (select auth.uid())
  );
$$;
revoke all on function fixora_private.is_problem_post_owner(uuid) from public, anon, authenticated;
grant execute on function fixora_private.is_problem_post_owner(uuid) to authenticated;

drop policy "Signed-in users read eligible posts" on public.problem_posts;
create policy "Signed-in users read eligible posts" on public.problem_posts for select to authenticated
  using (fixora_private.can_view_problem_post(id));
drop policy "Users read images for eligible posts" on public.problem_post_images;
create policy "Users read images for eligible posts" on public.problem_post_images for select to authenticated
  using (fixora_private.can_view_problem_post(post_id));
drop policy "Users read photos for eligible posts" on storage.objects;
create policy "Users read photos for eligible posts" on storage.objects for select to authenticated using (
  bucket_id = 'problem-post-photos' and exists (
    select 1 from public.problem_post_images i
    where i.storage_path = name and fixora_private.can_view_problem_post(i.post_id)
  )
);
drop policy "Applicants and post owners read applications" on public.problem_post_applications;
create policy "Applicants and post owners read applications" on public.problem_post_applications for select to authenticated
  using (professional_id = (select auth.uid()) or fixora_private.is_problem_post_owner(post_id));

create or replace function public.get_problem_post_author_cards(requested_post_ids uuid[])
returns table (post_id uuid, author_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id,
    pg_catalog.left(case when cardinality(n.parts) > 1
      then n.parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(n.parts[cardinality(n.parts)], 1)) || '.'
      else n.parts[1] end, 20)
  from public.problem_posts p join public.profiles pr on pr.id = p.author_id
  cross join lateral (select pg_catalog.regexp_split_to_array(
    coalesce(nullif(pg_catalog.btrim(pr.full_name), ''), 'Fixora member'), '\s+') as parts) n
  where (select auth.uid()) is not null
    and cardinality(coalesce(requested_post_ids, array[]::uuid[])) between 1 and 20
    and p.id = any(requested_post_ids)
    and fixora_private.can_view_problem_post(p.id);
$$;
revoke all on function public.get_problem_post_author_cards(uuid[]) from public, anon, authenticated;
grant execute on function public.get_problem_post_author_cards(uuid[]) to authenticated;

drop function public.can_view_problem_post(uuid);
drop function public.is_problem_post_owner(uuid);

create index marketplace_activities_actor_idx on public.marketplace_activities (actor_id);
create index marketplace_activities_application_idx on public.marketplace_activities (application_id);
create index marketplace_activities_post_idx on public.marketplace_activities (post_id);
create index problem_posts_hired_professional_idx on public.problem_posts (hired_professional_id);
