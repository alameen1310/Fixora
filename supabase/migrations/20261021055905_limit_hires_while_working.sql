-- A professional may take another assignment while a current job is unfinished
-- only when the new request has enough lead time (flexible or at least 7 days away).
create or replace function public.guard_problem_post_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  post_row public.problem_posts%rowtype;
begin
  if tg_op = 'INSERT' then
    select p.* into post_row from public.problem_posts p
    where p.id = new.post_id for update;

    if not found or post_row.status <> 'open' or post_row.published_at is null
      or post_row.author_id = new.professional_id then
      raise exception 'This post is no longer accepting applications.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.profiles p
      join public.provider_profiles pp on pp.profile_id = p.id
      where p.id = new.professional_id and p.account_type = 'provider'
        and pp.is_published = true
    ) then
      raise exception 'A published professional profile is required to apply.' using errcode = '42501';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.professional_id::text, 918273)
    );

    if exists (
      select 1 from public.problem_posts active
      where active.hired_professional_id = new.professional_id
        and active.status = 'closed'
    ) and not (
      post_row.timing = 'flexible'
      or (post_row.timing = 'specific_date' and post_row.target_date >=
        (pg_catalog.timezone('Africa/Lagos', pg_catalog.now())::date + 7))
    ) then
      raise exception 'You already have an unfinished job. You can apply to flexible jobs or jobs scheduled at least 7 days from today.'
        using errcode = 'P0001';
    end if;

    new.status := 'pending';
    new.updated_at := pg_catalog.now();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.post_id is distinct from old.post_id
      or new.professional_id is distinct from old.professional_id
      or new.message is distinct from old.message or new.created_at is distinct from old.created_at
      or old.status <> 'pending'
      or new.status not in ('withdrawn', 'hired', 'not_selected') then
      raise exception 'Only a pending application can change status.' using errcode = '42501';
    end if;
    new.updated_at := pg_catalog.now();
    return new;
  end if;
  return new;
end;
$function$;

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
  near_term_request boolean;
begin
  if current_user_id is null then
    raise exception 'Sign in to review applicants.' using errcode = '42501';
  end if;

  select p.* into request_row from public.problem_posts p where p.id = requested_post_id;
  if not found or request_row.author_id <> current_user_id then
    raise exception 'Only the customer who created this post can check applicant availability.' using errcode = '42501';
  end if;
  if pg_catalog.cardinality(coalesce(requested_provider_ids, array[]::uuid[])) not between 1 and 100 then
    raise exception 'Provide between 1 and 100 applicants.' using errcode = '22023';
  end if;

  near_term_request := not (
    request_row.timing = 'flexible'
    or (request_row.timing = 'specific_date' and request_row.target_date >=
      (pg_catalog.timezone('Africa/Lagos', pg_catalog.now())::date + 7))
  );

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
      when exists (
        select 1 from public.problem_posts active
        where active.hired_professional_id = candidate.profile_id and active.status = 'closed'
      ) and near_term_request then 'active_job'
      when exists (
        select 1 from public.problem_posts active
        where active.hired_professional_id = candidate.profile_id and active.status = 'closed'
      ) then 'working'
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

create or replace function public.hire_problem_professional(requested_post_id uuid, requested_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  post_row public.problem_posts%rowtype;
  application_row public.problem_post_applications%rowtype;
begin
  if current_user_id is null or not exists (
    select 1 from public.profiles p where p.id = current_user_id and p.account_type = 'customer'
  ) then
    raise exception 'Only the customer who created this post can hire.' using errcode = '42501';
  end if;

  select p.* into post_row from public.problem_posts p where p.id = requested_post_id for update;
  if not found or post_row.author_id <> current_user_id then
    raise exception 'Only the customer who created this post can hire.' using errcode = '42501';
  end if;
  if post_row.status <> 'open' or post_row.published_at is null or post_row.hired_professional_id is not null then
    return jsonb_build_object('outcome', 'already_hired');
  end if;
  if post_row.schedule_mode <> 'confirmed'
    or post_row.scheduled_start_at is null
    or post_row.scheduled_end_at <= post_row.scheduled_start_at then
    return jsonb_build_object('outcome', 'invalid_schedule');
  end if;

  select a.* into application_row from public.problem_post_applications a
  where a.id = requested_application_id and a.post_id = requested_post_id and a.status = 'pending'
  for update;
  if not found then return jsonb_build_object('outcome', 'application_changed'); end if;
  if not exists (
    select 1 from public.profiles p join public.provider_profiles pp on pp.profile_id = p.id
    where p.id = application_row.professional_id and p.account_type = 'provider' and pp.is_published
  ) then
    return jsonb_build_object('outcome', 'provider_ineligible');
  end if;
  if exists (
    select 1 from public.provider_profiles pp
    where pp.profile_id = application_row.professional_id and pp.availability = 'busy'
  ) then
    return jsonb_build_object('outcome', 'busy');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(application_row.professional_id::text, 918273)
  );

  if exists (
    select 1 from public.problem_posts active
    where active.hired_professional_id = application_row.professional_id
      and active.status = 'closed'
      and (active.schedule_mode is distinct from 'confirmed'
        or active.scheduled_start_at is null or active.scheduled_end_at is null)
  ) then
    return jsonb_build_object('outcome', 'availability_unknown');
  end if;
  if exists (
    select 1 from public.problem_posts active
    where active.hired_professional_id = application_row.professional_id
      and active.status = 'closed' and active.schedule_mode = 'confirmed'
      and post_row.scheduled_start_at < active.scheduled_end_at
      and post_row.scheduled_end_at > active.scheduled_start_at
  ) then
    return jsonb_build_object('outcome', 'conflict');
  end if;
  if exists (
    select 1 from public.problem_posts active
    where active.hired_professional_id = application_row.professional_id and active.status = 'closed'
  ) and not (
    post_row.timing = 'flexible'
    or (post_row.timing = 'specific_date' and post_row.target_date >=
      (pg_catalog.timezone('Africa/Lagos', pg_catalog.now())::date + 7))
  ) then
    return jsonb_build_object('outcome', 'active_job_near_term');
  end if;

  update public.problem_post_applications set status = 'hired' where id = application_row.id;
  update public.problem_post_applications set status = 'not_selected'
  where post_id = requested_post_id and id <> application_row.id and status = 'pending';
  update public.problem_posts
  set status = 'closed', hired_professional_id = application_row.professional_id, hired_at = pg_catalog.now()
  where id = requested_post_id;
  insert into public.marketplace_activities (recipient_id, actor_id, kind, post_id, application_id)
  values (current_user_id, application_row.professional_id, 'post_hired', requested_post_id, application_row.id)
  on conflict (recipient_id, kind, application_id) do nothing;

  return jsonb_build_object('outcome', 'hired');
end;
$function$;

revoke all on function public.get_request_provider_availability(uuid, uuid[]) from public, anon;
grant execute on function public.get_request_provider_availability(uuid, uuid[]) to authenticated;
revoke all on function public.hire_problem_professional(uuid, uuid) from public, anon;
grant execute on function public.hire_problem_professional(uuid, uuid) to authenticated;
