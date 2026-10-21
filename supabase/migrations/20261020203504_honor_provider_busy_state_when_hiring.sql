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

  select a.* into application_row
  from public.problem_post_applications a
  where a.id = requested_application_id
    and a.post_id = requested_post_id
    and a.status = 'pending'
  for update;
  if not found then return jsonb_build_object('outcome', 'application_changed'); end if;

  if not exists (
    select 1 from public.profiles p
    join public.provider_profiles pp on pp.profile_id = p.id
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(application_row.professional_id::text, 918273));

  if exists (
    select 1 from public.problem_posts active
    where active.hired_professional_id = application_row.professional_id
      and active.status = 'closed'
      and (active.schedule_mode <> 'confirmed' or active.scheduled_start_at is null or active.scheduled_end_at is null)
  ) then
    return jsonb_build_object('outcome', 'availability_unknown');
  end if;
  if exists (
    select 1 from public.problem_posts active
    where active.hired_professional_id = application_row.professional_id
      and active.status = 'closed'
      and active.schedule_mode = 'confirmed'
      and post_row.scheduled_start_at < active.scheduled_end_at
      and post_row.scheduled_end_at > active.scheduled_start_at
  ) then
    return jsonb_build_object('outcome', 'conflict');
  end if;

  update public.problem_post_applications set status = 'hired' where id = application_row.id;
  update public.problem_post_applications
    set status = 'not_selected'
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

revoke all on function public.hire_problem_professional(uuid, uuid) from public, anon;
grant execute on function public.hire_problem_professional(uuid, uuid) to authenticated;
