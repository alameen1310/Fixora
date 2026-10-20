create index if not exists job_reviews_provider_created_idx
  on public.job_reviews (provider_id, created_at desc);
create index if not exists job_reviews_customer_idx
  on public.job_reviews (customer_id);

create or replace function public.can_view_problem_post(requested_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.problem_posts p
    where p.id = requested_post_id and (
      p.author_id = (select auth.uid())
      or (p.status = 'open' and p.published_at is not null)
      or (p.status = 'completed' and p.published_at is not null)
      or (p.status in ('closed', 'removed') and exists (
        select 1 from public.problem_post_applications a
        where a.post_id = p.id and a.professional_id = (select auth.uid())
      ))
    )
  );
$$;
revoke all on function public.can_view_problem_post(uuid) from public, anon, authenticated;
grant execute on function public.can_view_problem_post(uuid) to authenticated;
