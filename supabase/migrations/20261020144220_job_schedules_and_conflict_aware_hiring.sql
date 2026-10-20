alter table public.problem_posts add column if not exists schedule_mode text not null default 'flexible';
alter table public.problem_posts add column if not exists scheduled_start_at timestamptz;
alter table public.problem_posts add column if not exists scheduled_end_at timestamptz;
alter table public.problem_posts drop constraint if exists problem_posts_schedule_valid;
alter table public.problem_posts add constraint problem_posts_schedule_valid check (
  (schedule_mode = 'flexible' and scheduled_start_at is null and scheduled_end_at is null)
  or (schedule_mode = 'confirmed' and scheduled_start_at is not null and scheduled_end_at is not null and scheduled_end_at > scheduled_start_at)
);
alter table public.problem_posts add constraint problem_posts_schedule_mode_valid check (schedule_mode in ('flexible','confirmed'));
grant insert (schedule_mode, scheduled_start_at, scheduled_end_at) on public.problem_posts to authenticated;
grant update (schedule_mode, scheduled_start_at, scheduled_end_at) on public.problem_posts to authenticated;
grant select (schedule_mode, scheduled_start_at, scheduled_end_at) on public.problem_posts to anon, authenticated;
create index if not exists problem_posts_hired_schedule_idx on public.problem_posts (hired_professional_id, scheduled_start_at, scheduled_end_at)
  where status = 'closed' and hired_professional_id is not null;

create or replace function public.get_post_application_availability(requested_post_id uuid)
returns table(application_id uuid, availability text)
language plpgsql stable security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  target_post public.problem_posts%rowtype;
begin
  select p.* into target_post from public.problem_posts p where p.id = requested_post_id;
  if not found or target_post.author_id <> current_user_id then
    raise exception 'Only the post owner can check applicant availability.' using errcode = '42501';
  end if;
  return query
  select a.id,
    case
      when target_post.schedule_mode <> 'confirmed' then 'schedule_required'
      when exists (select 1 from public.problem_posts active
        where active.hired_professional_id = a.professional_id and active.status = 'closed'
          and (active.schedule_mode <> 'confirmed' or active.scheduled_start_at is null or active.scheduled_end_at is null)) then 'availability_unknown'
      when exists (select 1 from public.problem_posts active
        where active.hired_professional_id = a.professional_id and active.status = 'closed'
          and active.schedule_mode = 'confirmed'
          and target_post.scheduled_start_at < active.scheduled_end_at
          and target_post.scheduled_end_at > active.scheduled_start_at) then 'unavailable_time'
      else 'available'
    end
  from public.problem_post_applications a
  where a.post_id = requested_post_id and a.status = 'pending';
end;
$$;
revoke all on function public.get_post_application_availability(uuid) from public, anon, authenticated;
grant execute on function public.get_post_application_availability(uuid) to authenticated;

create or replace function public.hire_problem_professional(requested_post_id uuid, requested_application_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  post_row public.problem_posts%rowtype;
  application_row public.problem_post_applications%rowtype;
begin
  if current_user_id is null or not exists (select 1 from public.profiles p
    where p.id = current_user_id and p.account_type = 'customer') then
    raise exception 'Only the customer who created this post can hire.' using errcode = '42501';
  end if;
  select p.* into post_row from public.problem_posts p where p.id = requested_post_id for update;
  if not found or post_row.author_id <> current_user_id then
    raise exception 'Only the customer who created this post can hire.' using errcode = '42501';
  end if;
  if post_row.status <> 'open' or post_row.published_at is null or post_row.hired_professional_id is not null then
    return jsonb_build_object('outcome','already_hired');
  end if;
  if post_row.schedule_mode <> 'confirmed' or post_row.scheduled_start_at is null or post_row.scheduled_end_at <= post_row.scheduled_start_at then
    return jsonb_build_object('outcome','invalid_schedule');
  end if;
  select a.* into application_row from public.problem_post_applications a
    where a.id = requested_application_id and a.post_id = requested_post_id and a.status = 'pending' for update;
  if not found then return jsonb_build_object('outcome','application_changed'); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(application_row.professional_id::text, 918273));
  if exists (select 1 from public.problem_posts active
    where active.hired_professional_id = application_row.professional_id and active.status = 'closed'
      and (active.schedule_mode <> 'confirmed' or active.scheduled_start_at is null or active.scheduled_end_at is null)) then
    return jsonb_build_object('outcome','availability_unknown');
  end if;
  if exists (select 1 from public.problem_posts active
    where active.hired_professional_id = application_row.professional_id and active.status = 'closed'
      and active.schedule_mode = 'confirmed'
      and post_row.scheduled_start_at < active.scheduled_end_at
      and post_row.scheduled_end_at > active.scheduled_start_at) then
    return jsonb_build_object('outcome','conflict');
  end if;

  update public.problem_post_applications set status = 'hired' where id = application_row.id;
  update public.problem_post_applications set status = 'not_selected'
    where post_id = requested_post_id and id <> application_row.id and status = 'pending';
  update public.problem_posts set status = 'closed', hired_professional_id = application_row.professional_id, hired_at = pg_catalog.now()
    where id = requested_post_id;
  insert into public.marketplace_activities (recipient_id, actor_id, kind, post_id, application_id)
  values (current_user_id, application_row.professional_id, 'post_hired', requested_post_id, application_row.id)
  on conflict (recipient_id, kind, application_id) do nothing;
  return jsonb_build_object('outcome','hired');
end;
$$;
revoke all on function public.hire_problem_professional(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hire_problem_professional(uuid, uuid) to authenticated;
