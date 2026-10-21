-- INSERT ... RETURNING evaluates the SELECT policy against the staged row.
-- The visibility helper re-queries problem_posts, where that row is not yet
-- visible to the helper. Let the author pass directly, then preserve the
-- existing helper for all other post visibility checks.
drop policy if exists "Signed-in users read eligible posts"
  on public.problem_posts;

create policy "Signed-in users read eligible posts"
  on public.problem_posts for select to authenticated
  using (
    case
      when author_id = (select auth.uid()) then true
      else fixora_private.can_view_problem_post(id)
    end
  );
