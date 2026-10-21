alter table public.profiles
  add column if not exists location_region text,
  add column if not exists location_city text;
alter table public.profiles
  drop constraint if exists profiles_location_region_length_check,
  add constraint profiles_location_region_length_check check (location_region is null or char_length(location_region) <= 100),
  drop constraint if exists profiles_location_city_length_check,
  add constraint profiles_location_city_length_check check (location_city is null or char_length(location_city) <= 100);

alter table public.provider_profiles
  add column if not exists avatar_path text,
  add column if not exists availability text not null default 'available';
alter table public.provider_profiles
  drop constraint if exists provider_profiles_availability_check,
  add constraint provider_profiles_availability_check check (availability in ('available', 'busy')),
  drop constraint if exists provider_profiles_avatar_path_length_check,
  add constraint provider_profiles_avatar_path_length_check check (avatar_path is null or char_length(avatar_path) <= 500);

grant select (location_region, location_city) on public.profiles to authenticated;
grant update (location_region, location_city) on public.profiles to authenticated;
grant select (avatar_path, availability) on public.provider_profiles to anon, authenticated;
grant update (avatar_path, availability) on public.provider_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  show_status boolean not null default true
);
alter table public.user_presence enable row level security;
drop policy if exists user_presence_read_visible on public.user_presence;
create policy user_presence_read_visible on public.user_presence for select to authenticated using (show_status or user_id = (select auth.uid()));
drop policy if exists user_presence_insert_own on public.user_presence;
create policy user_presence_insert_own on public.user_presence for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists user_presence_update_own on public.user_presence;
create policy user_presence_update_own on public.user_presence for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on public.user_presence to authenticated;
grant insert (user_id, last_seen_at, show_status), update (last_seen_at, show_status) on public.user_presence to authenticated;

create or replace function public.get_profile_photo_cards(requested_profile_ids uuid[])
returns table(profile_id uuid, avatar_path text)
language sql stable security definer set search_path = ''
as $function$
  select p.id, coalesce(pp.avatar_path, p.avatar_path)
  from public.profiles p
  left join public.provider_profiles pp on pp.profile_id = p.id
  where p.id = any(coalesce(requested_profile_ids, array[]::uuid[]))
    and cardinality(coalesce(requested_profile_ids, array[]::uuid[])) between 1 and 100
    and (p.id = (select auth.uid())
      or exists (select 1 from public.provider_profiles ppub where ppub.profile_id = p.id and ppub.is_published)
      or exists (select 1 from public.conversations c where (c.customer_id = (select auth.uid()) and c.provider_id = p.id) or (c.provider_id = (select auth.uid()) and c.customer_id = p.id))
      or exists (select 1 from public.problem_post_applications a join public.problem_posts post on post.id = a.post_id where a.professional_id = (select auth.uid()) and post.author_id = p.id and a.status = 'pending')
      or exists (select 1 from public.problem_posts post where post.author_id = p.id and post.published_at is not null and post.status <> 'removed' and fixora_private.can_view_problem_post(post.id)));
$function$;

create or replace function public.get_problem_post_author_cards_v2(requested_post_ids uuid[])
returns table(post_id uuid, author_id uuid, display_name text, avatar_path text, provider_type text)
language sql stable security definer set search_path = ''
as $function$
  select p.id, p.author_id,
    pg_catalog.left(case when pg_catalog.cardinality(n.parts) > 1 then n.parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(n.parts[pg_catalog.cardinality(n.parts)], 1)) || '.' else n.parts[1] end, 20),
    coalesce(pp.avatar_path, pr.avatar_path), pp.provider_type
  from public.problem_posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.provider_profiles pp on pp.profile_id = p.author_id
  cross join lateral (select pg_catalog.regexp_split_to_array(coalesce(nullif(pg_catalog.btrim(pr.full_name), ''), 'Fixora member'), '\\s+') as parts) n
  where (select auth.uid()) is not null
    and pg_catalog.cardinality(coalesce(requested_post_ids, array[]::uuid[])) between 1 and 20
    and p.id = any(requested_post_ids)
    and fixora_private.can_view_problem_post(p.id);
$function$;

create or replace function public.get_my_conversations_with_profiles()
returns table(
  conversation_id uuid, post_id uuid, other_user_id uuid, other_display_name text,
  post_title text, post_status public.problem_post_status, cover_path text,
  last_message_preview text, last_sender_id uuid, last_message_at timestamptz,
  unread_count integer, other_avatar_path text, other_provider_type text
)
language sql stable security definer set search_path = ''
as $function$
  select c.conversation_id, c.post_id, c.other_user_id, c.other_display_name,
    c.post_title, c.post_status, c.cover_path, c.last_message_preview,
    c.last_sender_id, c.last_message_at, c.unread_count,
    coalesce(pp.avatar_path, pr.avatar_path), pp.provider_type
  from public.get_my_conversations() c
  join public.profiles pr on pr.id = c.other_user_id
  left join public.provider_profiles pp on pp.profile_id = c.other_user_id;
$function$;

revoke all on function public.get_my_conversations_with_profiles() from public, anon;
grant execute on function public.get_my_conversations_with_profiles() to authenticated;
revoke all on function public.get_problem_post_author_cards_v2(uuid[]) from public, anon;
grant execute on function public.get_problem_post_author_cards_v2(uuid[]) to authenticated;
