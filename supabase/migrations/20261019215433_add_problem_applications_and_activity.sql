-- Applications and activity for the customer-professional request workflow.
-- Hiring is serialized per post and runs as one database transaction.

alter table public.problem_posts
  add column hired_professional_id uuid references public.profiles(id) on delete set null,
  add column hired_at timestamptz,
  add constraint problem_posts_hire_fields_valid check (
    (hired_professional_id is null and hired_at is null)
    or (hired_professional_id is not null and hired_at is not null and status = 'closed')
  );

create table public.problem_post_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.problem_posts(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  message text check (message is null or char_length(trim(message)) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'withdrawn', 'hired', 'not_selected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint problem_post_applications_one_per_professional unique (post_id, professional_id)
);

create index problem_post_applications_post_idx
  on public.problem_post_applications (post_id, created_at desc);
create index problem_post_applications_professional_idx
  on public.problem_post_applications (professional_id, created_at desc);

create table public.marketplace_activities (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('application_received', 'application_hired', 'application_not_selected')),
  post_id uuid not null references public.problem_posts(id) on delete cascade,
  application_id uuid not null references public.problem_post_applications(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketplace_activities_once_per_event unique (recipient_id, kind, application_id)
);

create index marketplace_activities_recipient_idx
  on public.marketplace_activities (recipient_id, created_at desc);

alter table public.problem_post_applications enable row level security;
alter table public.marketplace_activities enable row level security;

-- These helpers are security-definer only to break policy recursion. They reveal
-- no row data and always bind authorization to the caller's authenticated id.
create function public.can_view_problem_post(requested_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.problem_posts p
    where p.id = requested_post_id and (
      p.author_id = (select auth.uid())
      or (p.status = 'open' and p.published_at is not null)
      or (p.status = 'closed' and p.published_at is not null and exists (
        select 1 from public.problem_post_applications a
        where a.post_id = p.id and a.professional_id = (select auth.uid())
      ))
    )
  );
$$;
revoke all on function public.can_view_problem_post(uuid) from public, anon, authenticated;
grant execute on function public.can_view_problem_post(uuid) to authenticated;

create function public.is_problem_post_owner(requested_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.problem_posts p
    where p.id = requested_post_id and p.author_id = (select auth.uid())
  );
$$;
revoke all on function public.is_problem_post_owner(uuid) from public, anon, authenticated;
grant execute on function public.is_problem_post_owner(uuid) to authenticated;

drop policy "Signed-in users read open posts and owners read theirs" on public.problem_posts;
create policy "Signed-in users read eligible posts"
  on public.problem_posts for select to authenticated
  using (public.can_view_problem_post(id));

drop policy "Users read images for visible posts" on public.problem_post_images;
create policy "Users read images for eligible posts"
  on public.problem_post_images for select to authenticated
  using (public.can_view_problem_post(post_id));

drop policy "Users read photos for visible posts" on storage.objects;
create policy "Users read photos for eligible posts" on storage.objects
  for select to authenticated using (
    bucket_id = 'problem-post-photos' and exists (
      select 1 from public.problem_post_images i
      where i.storage_path = name and public.can_view_problem_post(i.post_id)
    )
  );

create policy "Applicants and post owners read applications"
  on public.problem_post_applications for select to authenticated
  using (professional_id = (select auth.uid()) or public.is_problem_post_owner(post_id));
create policy "Published professionals apply to open posts"
  on public.problem_post_applications for insert to authenticated
  with check (
    professional_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'provider')
    and exists (select 1 from public.provider_profiles pp
      where pp.profile_id = (select auth.uid()) and pp.is_published = true)
    and exists (select 1 from public.problem_posts p
      where p.id = post_id and p.author_id <> (select auth.uid())
        and p.status = 'open' and p.published_at is not null)
  );
create policy "Professionals withdraw their pending applications"
  on public.problem_post_applications for update to authenticated
  using (professional_id = (select auth.uid()) and status = 'pending')
  with check (professional_id = (select auth.uid()) and status = 'withdrawn');

create policy "Users read their marketplace activity"
  on public.marketplace_activities for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "Users mark their marketplace activity read"
  on public.marketplace_activities for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke all on public.problem_post_applications, public.marketplace_activities
  from public, anon, authenticated;
grant select, insert on public.problem_post_applications to authenticated;
grant update (status) on public.problem_post_applications to authenticated;
grant select on public.marketplace_activities to authenticated;
grant update (read_at) on public.marketplace_activities to authenticated;

create function public.guard_problem_post_application()
returns trigger language plpgsql security definer set search_path = '' as $$
declare post_row public.problem_posts%rowtype;
begin
  if tg_op = 'INSERT' then
    select p.* into post_row from public.problem_posts p
      where p.id = new.post_id for update;
    if not found or post_row.status <> 'open' or post_row.published_at is null
      or post_row.author_id = new.professional_id then
      raise exception 'This post is no longer accepting applications.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.profiles p
      join public.provider_profiles pp on pp.profile_id = p.id
      where p.id = new.professional_id and p.account_type = 'provider'
        and pp.is_published = true) then
      raise exception 'A published professional profile is required to apply.' using errcode = '42501';
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
$$;
revoke all on function public.guard_problem_post_application() from public, anon, authenticated;
create trigger problem_post_applications_guard
before insert or update on public.problem_post_applications
for each row execute function public.guard_problem_post_application();

create function public.record_problem_post_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  if tg_op = 'INSERT' then
    select p.author_id into owner_id from public.problem_posts p where p.id = new.post_id;
    insert into public.marketplace_activities (recipient_id, actor_id, kind, post_id, application_id)
    values (owner_id, new.professional_id, 'application_received', new.post_id, new.id)
    on conflict (recipient_id, kind, application_id) do nothing;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'hired' then
      insert into public.marketplace_activities (recipient_id, actor_id, kind, post_id, application_id)
      values (new.professional_id, null, 'application_hired', new.post_id, new.id)
      on conflict (recipient_id, kind, application_id) do nothing;
    elsif new.status = 'not_selected' then
      insert into public.marketplace_activities (recipient_id, actor_id, kind, post_id, application_id)
      values (new.professional_id, null, 'application_not_selected', new.post_id, new.id)
      on conflict (recipient_id, kind, application_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.record_problem_post_activity() from public, anon, authenticated;
create trigger problem_post_applications_activity
after insert or update on public.problem_post_applications
for each row execute function public.record_problem_post_activity();

create function public.hire_problem_professional(requested_post_id uuid, requested_application_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  post_row public.problem_posts%rowtype;
  application_row public.problem_post_applications%rowtype;
begin
  if current_user_id is null or not exists (select 1 from public.profiles p
    where p.id = current_user_id and p.account_type = 'customer') then
    raise exception 'Only the customer who created this post can hire.' using errcode = '42501';
  end if;

  select p.* into post_row from public.problem_posts p
    where p.id = requested_post_id for update;
  if not found or post_row.author_id <> current_user_id
    or post_row.status <> 'open' or post_row.published_at is null
    or post_row.hired_professional_id is not null then
    raise exception 'This post is no longer available for hiring.' using errcode = '42501';
  end if;

  select a.* into application_row from public.problem_post_applications a
    where a.id = requested_application_id and a.post_id = requested_post_id
      and a.status = 'pending' for update;
  if not found then
    raise exception 'This application is no longer pending.' using errcode = '42501';
  end if;

  update public.problem_post_applications a set status = 'hired'
    where a.id = application_row.id;
  update public.problem_post_applications a set status = 'not_selected'
    where a.post_id = requested_post_id and a.id <> application_row.id and a.status = 'pending';
  update public.problem_posts p set status = 'closed',
    hired_professional_id = application_row.professional_id, hired_at = pg_catalog.now()
    where p.id = requested_post_id;
end;
$$;
revoke all on function public.hire_problem_professional(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hire_problem_professional(uuid, uuid) to authenticated;

create function public.prevent_reopening_hired_problem_post()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.hired_professional_id is not null and new.status = 'open' then
    raise exception 'A hired post cannot be reopened.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_reopening_hired_problem_post() from public, anon, authenticated;
create trigger problem_posts_prevent_reopen_after_hire
before update of status on public.problem_posts
for each row execute function public.prevent_reopening_hired_problem_post();

create or replace function public.get_problem_post_author_cards(requested_post_ids uuid[])
returns table (post_id uuid, author_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id,
    pg_catalog.left(
      case when cardinality(n.parts) > 1
        then n.parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(
          n.parts[cardinality(n.parts)], 1)) || '.'
        else n.parts[1] end,
      20)
  from public.problem_posts p
  join public.profiles pr on pr.id = p.author_id
  cross join lateral (select pg_catalog.regexp_split_to_array(
    coalesce(nullif(pg_catalog.btrim(pr.full_name), ''), 'Fixora member'),
    '\s+') as parts) n
  where (select auth.uid()) is not null
    and cardinality(coalesce(requested_post_ids, array[]::uuid[])) between 1 and 20
    and p.id = any(requested_post_ids)
    and public.can_view_problem_post(p.id);
$$;
revoke all on function public.get_problem_post_author_cards(uuid[]) from public, anon, authenticated;
grant execute on function public.get_problem_post_author_cards(uuid[]) to authenticated;
