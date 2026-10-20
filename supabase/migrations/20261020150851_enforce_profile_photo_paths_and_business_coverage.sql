alter table public.profiles drop constraint if exists profiles_avatar_path_own_folder;
alter table public.profiles add constraint profiles_avatar_path_own_folder
  check (avatar_path is null or avatar_path like id::text || '/%');

revoke update (is_nationwide) on public.provider_profiles from authenticated;
create or replace function public.clear_nationwide_for_individual()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.provider_type <> 'business' then new.is_nationwide := false; end if;
  return new;
end;
$$;
drop trigger if exists provider_profiles_clear_nationwide_for_individual on public.provider_profiles;
create trigger provider_profiles_clear_nationwide_for_individual
before insert or update of provider_type on public.provider_profiles
for each row execute function public.clear_nationwide_for_individual();
