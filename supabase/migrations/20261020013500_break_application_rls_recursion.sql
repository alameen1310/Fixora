-- Keep post visibility checks out of the application table's RLS evaluation.
-- The helper runs as its owner, so the closed/removed-post application lookup
-- does not recursively re-enter the application policies.
create or replace function fixora_private.can_view_problem_post(requested_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.problem_posts p
    where p.id = requested_post_id
      and (
        p.author_id = (select auth.uid())
        or (p.status in ('open', 'completed') and p.published_at is not null)
        or (p.status in ('closed', 'removed') and exists (
          select 1
          from public.problem_post_applications a
          where a.post_id = p.id
            and a.professional_id = (select auth.uid())
        ))
      )
  );
$$;

revoke all on function fixora_private.can_view_problem_post(uuid) from public, anon, authenticated;
grant execute on function fixora_private.can_view_problem_post(uuid) to authenticated;

drop policy if exists "Signed-in users read eligible posts" on public.problem_posts;
create policy "Signed-in users read eligible posts"
  on public.problem_posts for select to authenticated
  using (fixora_private.can_view_problem_post(id));
