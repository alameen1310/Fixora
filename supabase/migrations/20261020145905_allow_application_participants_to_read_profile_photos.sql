create or replace function public.get_profile_photo_cards(requested_profile_ids uuid[])
returns table(profile_id uuid, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.avatar_path from public.profiles p
  where p.id = any(coalesce(requested_profile_ids, array[]::uuid[]))
    and cardinality(coalesce(requested_profile_ids, array[]::uuid[])) between 1 and 100
    and (p.id = (select auth.uid())
      or exists (select 1 from public.provider_profiles pp where pp.profile_id = p.id and pp.is_published)
      or exists (select 1 from public.conversations c where
        (c.customer_id = (select auth.uid()) and c.provider_id = p.id)
        or (c.provider_id = (select auth.uid()) and c.customer_id = p.id))
      or exists (select 1 from public.problem_post_applications a join public.problem_posts post on post.id = a.post_id
        where a.professional_id = (select auth.uid()) and post.author_id = p.id and a.status = 'pending'));
$$;
revoke all on function public.get_profile_photo_cards(uuid[]) from public, anon, authenticated;
grant execute on function public.get_profile_photo_cards(uuid[]) to authenticated;
