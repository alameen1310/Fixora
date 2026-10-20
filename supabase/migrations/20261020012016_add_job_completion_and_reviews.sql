alter table public.problem_posts
  add column completed_at timestamptz,
  add column final_price_naira bigint,
  add constraint problem_posts_final_price_valid check (
    final_price_naira is null or (final_price_naira > 0 and final_price_naira <= 100000000000)
  );

alter table public.problem_posts drop constraint problem_posts_hire_fields_valid;
alter table public.problem_posts add constraint problem_posts_hire_fields_valid check (
  (hired_professional_id is null and hired_at is null)
  or (hired_professional_id is not null and hired_at is not null and status in ('closed', 'completed'))
);
alter table public.problem_posts drop constraint problem_posts_status_timestamps;
alter table public.problem_posts add constraint problem_posts_status_timestamps check (
  (status <> 'closed' or closed_at is not null)
  and (status <> 'removed' or removed_at is not null)
  and (status <> 'completed' or completed_at is not null)
);

alter table public.problem_post_images add column kind text not null default 'before';
alter table public.problem_post_images add constraint problem_post_images_kind_check check (kind in ('before', 'after'));
alter table public.problem_post_images drop constraint problem_post_images_pkey;
alter table public.problem_post_images add constraint problem_post_images_pkey primary key (post_id, kind, sort_order);

create or replace function public.enforce_problem_post_image_limit()
returns trigger language plpgsql set search_path = '' as $$
declare image_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.post_id::text || ':' || new.kind, 0));
  select count(*) into image_count from public.problem_post_images i
  where i.post_id = new.post_id and i.kind = new.kind;
  if image_count >= 5 then
    raise exception 'A post can have at most five % photos.', new.kind using errcode = '23514';
  end if;
  return new;
end;
$$;

create table public.job_reviews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.problem_posts(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 600),
  customer_display_name text not null,
  created_at timestamptz not null default now()
);
alter table public.job_reviews enable row level security;
revoke all on public.job_reviews from public, anon, authenticated;
grant select on public.job_reviews to authenticated;
create policy "Signed-in users read job reviews"
  on public.job_reviews for select to authenticated using (true);

create view public.provider_rating_summary with (security_invoker = true) as
select r.provider_id, count(*)::bigint as review_count,
  round(avg(r.rating)::numeric, 2)::numeric(3,2) as average_rating
from public.job_reviews r
group by r.provider_id;
grant select on public.provider_rating_summary to authenticated;

alter table public.marketplace_activities drop constraint marketplace_activities_kind_check;
alter table public.marketplace_activities add constraint marketplace_activities_kind_check
  check (kind in ('application_received', 'application_hired', 'application_not_selected', 'post_hired', 'post_completed'));

create or replace function public.can_view_problem_post(requested_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.problem_posts p
    where p.id = requested_post_id and (
      p.author_id = (select auth.uid())
      or (p.status = 'open' and p.published_at is not null)
      or (p.status = 'completed' and p.published_at is not null)
      or (p.status = 'closed' and p.published_at is not null and exists (
        select 1 from public.problem_post_applications a
        where a.post_id = p.id and a.professional_id = (select auth.uid())
      ))
    )
  );
$$;
revoke all on function public.can_view_problem_post(uuid) from public, anon, authenticated;
grant execute on function public.can_view_problem_post(uuid) to authenticated;

create or replace function public.hire_problem_professional(requested_post_id uuid, requested_application_id uuid)
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
  update public.problem_post_applications a set status = 'hired' where a.id = application_row.id;
  update public.problem_post_applications a set status = 'not_selected'
    where a.post_id = requested_post_id and a.id <> application_row.id and a.status = 'pending';
  update public.problem_posts p set status = 'closed',
    hired_professional_id = application_row.professional_id, hired_at = pg_catalog.now()
    where p.id = requested_post_id;
  insert into public.marketplace_activities (recipient_id, actor_id, kind, post_id, application_id)
  values (current_user_id, application_row.professional_id, 'post_hired', requested_post_id, application_row.id)
  on conflict (recipient_id, kind, application_id) do nothing;
end;
$$;
revoke all on function public.hire_problem_professional(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hire_problem_professional(uuid, uuid) to authenticated;

create or replace function public.complete_job(
  requested_post_id uuid,
  requested_rating smallint,
  requested_comment text,
  requested_final_price bigint
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  post_row public.problem_posts%rowtype;
  customer_name text;
  parts text[];
  application_id uuid;
begin
  if current_user_id is null or requested_rating not between 1 and 5
    or requested_final_price is null or requested_final_price <= 0 or requested_final_price > 100000000000
    or requested_comment is not null and char_length(requested_comment) > 600 then
    raise exception 'Review, comment, or final price is invalid.' using errcode = '22023';
  end if;
  select p.* into post_row from public.problem_posts p where p.id = requested_post_id for update;
  if not found or post_row.author_id <> current_user_id or post_row.status <> 'closed'
    or post_row.hired_professional_id is null then
    raise exception 'Only the customer who hired a professional can complete this job.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.problem_post_images i
    where i.post_id = requested_post_id and i.kind = 'after') then
    raise exception 'Add at least one after photo before completing this job.' using errcode = '23514';
  end if;
  select a.id into application_id from public.problem_post_applications a
    where a.post_id = requested_post_id and a.professional_id = post_row.hired_professional_id
      and a.status = 'hired' limit 1;
  select pg_catalog.regexp_split_to_array(
    coalesce(nullif(pg_catalog.btrim(pr.full_name), ''), 'Fixora customer'), '\s+')
    into parts from public.profiles pr where pr.id = current_user_id;
  customer_name := case when cardinality(parts) > 1
    then parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(parts[cardinality(parts)], 1)) || '.'
    else parts[1] end;

  update public.problem_posts p set status = 'completed',
    completed_at = pg_catalog.now(), final_price_naira = requested_final_price
    where p.id = requested_post_id;
  insert into public.job_reviews (post_id, provider_id, customer_id, rating, comment, customer_display_name)
  values (requested_post_id, post_row.hired_professional_id, current_user_id, requested_rating,
    nullif(pg_catalog.btrim(requested_comment), ''), coalesce(customer_name, 'Fixora customer'));
  insert into public.marketplace_activities (recipient_id, actor_id, kind, post_id, application_id)
  values (current_user_id, post_row.hired_professional_id, 'post_completed', requested_post_id, application_id)
  on conflict (recipient_id, kind, application_id) do nothing;
end;
$$;
revoke all on function public.complete_job(uuid, smallint, text, bigint) from public, anon, authenticated;
grant execute on function public.complete_job(uuid, smallint, text, bigint) to authenticated;

