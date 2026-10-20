-- Make INSERT ... RETURNING work for newly staged posts.
-- The prior SELECT policy called a helper that re-queried problem_posts,
-- which cannot reliably see the just-inserted row during RETURNING checks.
drop policy if exists "Signed-in users read eligible posts"
  on public.problem_posts;

create policy "Signed-in users read eligible posts"
  on public.problem_posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or (status = 'open' and published_at is not null)
    or (
      status = 'closed'
      and published_at is not null
      and exists (
        select 1
        from public.problem_post_applications a
        where a.post_id = problem_posts.id
          and a.professional_id = (select auth.uid())
      )
    )
  );
