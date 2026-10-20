create or replace function public.prevent_reopening_hired_problem_post()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.hired_professional_id is not null and new.status is distinct from old.status then
    if old.status = 'closed' and new.status = 'completed'
      and new.id = old.id
      and pg_catalog.current_setting('fixora.completing_job', true) = new.id::text then
      return new;
    end if;
    raise exception 'A hired post cannot change status.' using errcode = '42501';
  end if;
  return new;
end;
$$;

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
  if current_user_id is null or requested_rating is null or requested_rating not between 1 and 5
    or requested_final_price is null or requested_final_price <= 0 or requested_final_price > 100000000000
    or requested_comment is not null and char_length(requested_comment) > 600 then
    raise exception 'Review, comment, or final price is invalid.' using errcode = '22023';
  end if;
  select p.* into post_row from public.problem_posts p where p.id = requested_post_id for update;

  if not found or post_row.author_id <> current_user_id then
    raise exception 'Only the customer who hired a professional can complete this job.' using errcode = '42501';
  end if;

  -- A retry after a successful commit is a no-op and cannot create a duplicate review.
  if post_row.status = 'completed' and exists (
    select 1 from public.job_reviews r
    where r.post_id = requested_post_id and r.customer_id = current_user_id
  ) then
    return;
  end if;

  if post_row.status <> 'closed' or post_row.hired_professional_id is null then
    raise exception 'Only the customer who hired a professional can complete this job.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.problem_post_images i
    where i.post_id = requested_post_id and i.kind = 'after') then
    raise exception 'Add at least one after photo before completing this job.' using errcode = '23514';
  end if;
  select a.id into application_id from public.problem_post_applications a
    where a.post_id = requested_post_id and a.professional_id = post_row.hired_professional_id
      and a.status = 'hired' limit 1;
  if application_id is null then
    raise exception 'The hired application could not be found.' using errcode = '23503';
  end if;
  select pg_catalog.regexp_split_to_array(
    coalesce(nullif(pg_catalog.btrim(pr.full_name), ''), 'Fixora customer'), '\s+')
    into parts from public.profiles pr where pr.id = current_user_id;
  customer_name := case when cardinality(parts) > 1
    then parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(parts[cardinality(parts)], 1)) || '.'
    else parts[1] end;

  perform pg_catalog.set_config('fixora.completing_job', requested_post_id::text, true);
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
