-- Make staged-post authorization independent of profiles SELECT RLS.
-- Keep the same customer-only and staged-row restrictions as the original policy.

create or replace function fixora_private.is_fixora_customer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'customer'
  );
$$;

revoke all on function fixora_private.is_fixora_customer()
  from public, anon, authenticated;
grant execute on function fixora_private.is_fixora_customer() to authenticated;

drop policy if exists "Customers create their own staged posts"
  on public.problem_posts;
create policy "Customers create their own staged posts"
  on public.problem_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'open'
    and published_at is null
    and closed_at is null
    and removed_at is null
    and fixora_private.is_fixora_customer()
  );
