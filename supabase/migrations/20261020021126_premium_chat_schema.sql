alter table public.messages
  add column reply_to_id uuid references public.messages(id) on delete set null,
  add column deleted_at timestamptz,
  add column image_path text;

alter table public.messages drop constraint messages_body_check;
alter table public.messages drop constraint messages_body_raw_length_check;
alter table public.messages add constraint messages_body_or_image_check
  check (
    (image_path is not null and char_length(body) = 0)
    or (char_length(body) between 1 and 2000 and char_length(btrim(body)) >= 1)
  );

create index messages_reply_to_id_idx on public.messages(reply_to_id) where reply_to_id is not null;

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🙏')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reactions enable row level security;

create policy "Conversation participants read reactions" on public.message_reactions
  for select to authenticated using (
    exists (select 1 from public.messages m where m.id = message_id
      and fixora_private.can_access_conversation(m.conversation_id))
  );
create policy "Users add own conversation reactions" on public.message_reactions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.messages m where m.id = message_id
      and fixora_private.can_access_conversation(m.conversation_id))
  );
create policy "Users update own conversation reactions" on public.message_reactions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.messages m where m.id = message_id
      and fixora_private.can_access_conversation(m.conversation_id))
  );
create policy "Users remove own conversation reactions" on public.message_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.message_reactions from public, anon, authenticated;
grant select, insert, update, delete on public.message_reactions to authenticated;
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, body, reply_to_id, image_path) on public.messages to authenticated;

create or replace function public.unsend_message(requested_message_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.messages
  set deleted_at = coalesce(deleted_at, pg_catalog.now())
  where id = requested_message_id
    and sender_id = (select auth.uid())
    and fixora_private.can_access_conversation(conversation_id);
  if not found then raise exception 'Message not found or cannot be unsent'; end if;
end;
$$;
revoke all on function public.unsend_message(uuid) from public, anon, authenticated;
grant execute on function public.unsend_message(uuid) to authenticated;

create or replace function public.mark_conversation_read(requested_conversation_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.messages m
  set read_at = pg_catalog.now()
  where m.conversation_id = requested_conversation_id
    and m.sender_id <> (select auth.uid())
    and m.read_at is null
    and fixora_private.can_access_conversation(requested_conversation_id);
$$;
revoke all on function public.mark_conversation_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

drop function public.get_my_conversations();
create function public.get_my_conversations()
returns table (
  conversation_id uuid,
  post_id uuid,
  other_user_id uuid,
  other_display_name text,
  post_title text,
  post_status public.problem_post_status,
  cover_path text,
  last_message_preview text,
  last_sender_id uuid,
  last_message_at timestamptz,
  unread_count integer
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.post_id, other_profile.id,
    case when pg_catalog.cardinality(name_parts.parts) > 1
      then name_parts.parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(name_parts.parts[pg_catalog.cardinality(name_parts.parts)], 1)) || '.'
      else name_parts.parts[1] end,
    p.title, p.status, cover.storage_path,
    case when latest.deleted_at is not null then 'Message deleted'
      when latest.image_path is not null then 'Photo'
      else coalesce(latest.body, 'No messages yet') end,
    latest.sender_id,
    coalesce(latest.created_at, c.last_message_at, c.created_at),
    coalesce(unread.total, 0)::integer
  from public.conversations c
  join public.problem_posts p on p.id = c.post_id and p.status <> 'removed'
  join public.profiles other_profile on other_profile.id = case
    when c.customer_id = (select auth.uid()) then c.provider_id else c.customer_id end
  left join public.provider_profiles other_provider on other_provider.profile_id = other_profile.id
  cross join lateral (select pg_catalog.regexp_split_to_array(
    coalesce(nullif(pg_catalog.btrim(coalesce(other_provider.display_name, other_profile.full_name)), ''), 'Fixora member'), '\s+') as parts) name_parts
  left join lateral (
    select i.storage_path from public.problem_post_images i
    where i.post_id = p.id and i.kind = 'before'
    order by i.sort_order asc limit 1
  ) cover on true
  left join lateral (
    select m.body, m.image_path, m.deleted_at, m.sender_id, m.created_at
    from public.messages m where m.conversation_id = c.id
    order by m.created_at desc, m.id desc limit 1
  ) latest on true
  left join lateral (
    select pg_catalog.count(*) as total from public.messages m
    where m.conversation_id = c.id and m.sender_id <> (select auth.uid()) and m.read_at is null
  ) unread on true
  where (select auth.uid()) is not null
    and (c.customer_id = (select auth.uid()) or c.provider_id = (select auth.uid()))
  order by coalesce(latest.created_at, c.last_message_at, c.created_at) desc;
$$;
revoke all on function public.get_my_conversations() from public, anon, authenticated;
grant execute on function public.get_my_conversations() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end;
$$;

