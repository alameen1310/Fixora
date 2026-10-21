alter table public.profiles
  add column if not exists preferred_language text not null default 'en'
  check (preferred_language in ('en', 'yo', 'ig', 'ha'));

grant update (preferred_language) on public.profiles to authenticated;

-- Store only a one-way cache key and translated output. Source text is not persisted.
create table if not exists public.fixora_translation_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  translated_text text not null check (char_length(translated_text) between 1 and 1600),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table public.fixora_translation_cache enable row level security;
revoke all on public.fixora_translation_cache from anon, authenticated;
grant select, insert, update, delete on public.fixora_translation_cache to service_role;

create index if not exists fixora_translation_cache_expires_at_idx
  on public.fixora_translation_cache (expires_at);

create table if not exists public.fixora_translation_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count between 0 and 30)
);
alter table public.fixora_translation_usage enable row level security;
revoke all on public.fixora_translation_usage from anon, authenticated;
grant select, insert, update, delete on public.fixora_translation_usage to service_role;

create or replace function public.consume_fixora_translation_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  usage_row public.fixora_translation_usage%rowtype;
begin
  insert into public.fixora_translation_usage (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into usage_row from public.fixora_translation_usage where user_id = p_user_id for update;
  if usage_row.window_started_at < now() - interval '1 minute' then
    update public.fixora_translation_usage set window_started_at = now(), request_count = 1 where user_id = p_user_id;
    return true;
  end if;
  if usage_row.request_count >= 30 then return false; end if;
  update public.fixora_translation_usage set request_count = request_count + 1 where user_id = p_user_id;
  return true;
end;
$$;
revoke all on function public.consume_fixora_translation_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_fixora_translation_quota(uuid) to service_role;

create or replace function public.prune_fixora_translation_cache()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  delete from public.fixora_translation_cache
  where cache_key in (
    select cache_key from public.fixora_translation_cache
    where expires_at <= now()
    order by expires_at
    limit 100
  );
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;
revoke all on function public.prune_fixora_translation_cache() from public, anon, authenticated;
grant execute on function public.prune_fixora_translation_cache() to service_role;
