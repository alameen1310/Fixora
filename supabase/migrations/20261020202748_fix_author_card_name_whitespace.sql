create or replace function public.get_problem_post_author_cards_v2(requested_post_ids uuid[])
returns table(post_id uuid, author_id uuid, display_name text, avatar_path text, provider_type text)
language sql stable security definer set search_path = ''
as $function$
  select p.id, p.author_id,
    pg_catalog.left(
      case
        when pg_catalog.cardinality(n.parts) > 1
          then n.parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(n.parts[pg_catalog.cardinality(n.parts)], 1)) || '.'
        else n.parts[1]
      end,
      20
    ),
    coalesce(pp.avatar_path, pr.avatar_path), pp.provider_type
  from public.problem_posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.provider_profiles pp on pp.profile_id = p.author_id
  cross join lateral (
    select pg_catalog.regexp_split_to_array(
      coalesce(nullif(pg_catalog.btrim(pr.full_name), ''), 'Fixora member'),
      '[[:space:]]+'
    ) as parts
  ) n
  where (select auth.uid()) is not null
    and pg_catalog.cardinality(coalesce(requested_post_ids, array[]::uuid[])) between 1 and 20
    and p.id = any(requested_post_ids)
    and fixora_private.can_view_problem_post(p.id);
$function$;

revoke all on function public.get_problem_post_author_cards_v2(uuid[]) from public, anon;
grant execute on function public.get_problem_post_author_cards_v2(uuid[]) to authenticated;
