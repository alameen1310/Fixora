create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.problem_posts(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint conversations_distinct_participants check (customer_id <> provider_id)
);

create index conversations_customer_last_message_idx
  on public.conversations (customer_id, last_message_at desc nulls last, created_at desc);
create index conversations_provider_last_message_idx
  on public.conversations (provider_id, last_message_at desc nulls last, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_sender_created_idx on public.messages (sender_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create or replace function fixora_private.can_access_conversation(requested_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.conversations c
    join public.problem_posts p on p.id = c.post_id
    where c.id = requested_conversation_id
      and p.status <> 'removed'
      and (c.customer_id = (select auth.uid()) or c.provider_id = (select auth.uid()))
  );
$$;
revoke all on function fixora_private.can_access_conversation(uuid) from public, anon, authenticated;
grant execute on function fixora_private.can_access_conversation(uuid) to authenticated;

create policy "Participants read conversations"
  on public.conversations for select to authenticated
  using (fixora_private.can_access_conversation(id));

create policy "Participants read conversation messages"
  on public.messages for select to authenticated
  using (fixora_private.can_access_conversation(conversation_id));
create policy "Participants send their own messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and fixora_private.can_access_conversation(conversation_id)
  );
create policy "Participants mark received messages read"
  on public.messages for update to authenticated
  using (
    sender_id <> (select auth.uid())
    and fixora_private.can_access_conversation(conversation_id)
  )
  with check (
    sender_id <> (select auth.uid())
    and fixora_private.can_access_conversation(conversation_id)
  );

revoke all on public.conversations, public.messages from public, anon, authenticated;
grant select on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

create or replace function public.create_hire_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.hired_professional_id is not null
    and new.status in ('closed', 'completed')
    and (old.hired_professional_id is distinct from new.hired_professional_id
      or old.status not in ('closed', 'completed')) then
    insert into public.conversations (post_id, customer_id, provider_id)
    values (new.id, new.author_id, new.hired_professional_id)
    on conflict (post_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.create_hire_conversation() from public, anon, authenticated;
create trigger problem_posts_create_hire_conversation
  after update of status, hired_professional_id on public.problem_posts
  for each row execute function public.create_hire_conversation();

insert into public.conversations (post_id, customer_id, provider_id)
select p.id, p.author_id, p.hired_professional_id
from public.problem_posts p
where p.status in ('closed', 'completed') and p.hired_professional_id is not null
on conflict (post_id) do nothing;

create or replace function public.update_conversation_last_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id
      and (last_message_at is null or last_message_at < new.created_at);
  return new;
end;
$$;
revoke all on function public.update_conversation_last_message() from public, anon, authenticated;
create trigger messages_update_conversation_last_message
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  post_id uuid,
  other_user_id uuid,
  other_display_name text,
  post_title text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count integer
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.post_id, other_profile.id,
    case when pg_catalog.cardinality(name_parts.parts) > 1
      then name_parts.parts[1] || ' ' || pg_catalog.upper(pg_catalog.left(name_parts.parts[pg_catalog.cardinality(name_parts.parts)], 1)) || '.'
      else name_parts.parts[1] end,
    p.title,
    coalesce(latest.body, 'No messages yet'),
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
    select m.body, m.created_at from public.messages m
    where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
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

create or replace function public.get_my_unread_message_count()
returns integer language sql stable security definer set search_path = '' as $$
  select pg_catalog.count(*)::integer
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.problem_posts p on p.id = c.post_id and p.status <> 'removed'
  where (c.customer_id = (select auth.uid()) or c.provider_id = (select auth.uid()))
    and m.sender_id <> (select auth.uid()) and m.read_at is null;
$$;
revoke all on function public.get_my_unread_message_count() from public, anon, authenticated;
grant execute on function public.get_my_unread_message_count() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
