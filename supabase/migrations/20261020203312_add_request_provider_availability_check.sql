create or replace function public.get_request_provider_availability(
  requested_post_id uuid,
  requested_provider_ids uuid[]
)
returns table(provider_id uuid, availability text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  request_row public.problem_posts%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sign in to review applicants.' using errcode = '42501';
  end if;

  select p.* into request_row
  from public.problem_posts p
  where p.id = requested_post_id;

  if not found or request_row.author_id <> current_user_id then
    raise exception 'Only the customer who created this post can check applicant availability.' using errcode = '42501';
  end if;

  if pg_catalog.cardinality(coalesce(requested_provider_ids, array[]::uuid[])) not between 1 and 100 then
    raise exception 'Provide between 1 and 100 applicants.' using errcode = '22023';
  end if;

  return query
  select candidate.profile_id,
    case
      when pp.availability = 'busy' then 'busy'
      when exists (
        select 1 from public.problem_posts active
        where active.hired_professional_id = candidate.profile_id
          and active.status = 'closed'
          and (active.schedule_mode is distinct from 'confirmed'
            or active.scheduled_start_at is null
            or active.scheduled_end_at is null)
      ) then 'unknown'
      when exists (
        select 1 from public.problem_posts active
        where active.hired_professional_id = candidate.profile_id
          and active.status = 'closed'
          and active.schedule_mode = 'confirmed'
          and request_row.schedule_mode = 'confirmed'
          and request_row.scheduled_start_at < active.scheduled_end_at
          and request_row.scheduled_end_at > active.scheduled_start_at
      ) then 'unavailable'
      else 'available'
    end
  from (
    select distinct a.professional_id as profile_id
    from public.problem_post_applications a
    where a.post_id = requested_post_id
      and a.status = 'pending'
      and a.professional_id = any(requested_provider_ids)
  ) candidate
  join public.provider_profiles pp on pp.profile_id = candidate.profile_id;
end;
$function$;

revoke all on function public.get_request_provider_availability(uuid, uuid[]) from public, anon;
grant execute on function public.get_request_provider_availability(uuid, uuid[]) to authenticated;
