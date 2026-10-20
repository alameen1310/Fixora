alter table public.profiles add column if not exists avatar_path text;
alter table public.provider_profiles add column if not exists is_nationwide boolean not null default false;
alter table public.provider_service_areas add column if not exists state_code text;

alter table public.provider_service_areas drop constraint if exists provider_service_areas_state_code_check;
alter table public.provider_service_areas add constraint provider_service_areas_state_code_check check (
  state_code is null or state_code in (
    'NG-AB','NG-AD','NG-AK','NG-AN','NG-BA','NG-BY','NG-BE','NG-BO','NG-CR','NG-DE','NG-EB','NG-ED',
    'NG-EK','NG-EN','NG-GO','NG-IM','NG-JI','NG-KD','NG-KN','NG-KT','NG-KE','NG-KO','NG-KW','NG-LA',
    'NG-NA','NG-NI','NG-OG','NG-ON','NG-OS','NG-OY','NG-PL','NG-RI','NG-SO','NG-TA','NG-YO','NG-ZA','NG-FC'
  )
);

update public.provider_service_areas
set state_code = case upper(regexp_replace(btrim(region), '\s+state$', '', 'i'))
  when 'ABIA' then 'NG-AB' when 'ADAMAWA' then 'NG-AD' when 'AKWA IBOM' then 'NG-AK' when 'ANAMBRA' then 'NG-AN'
  when 'BAUCHI' then 'NG-BA' when 'BAYELSA' then 'NG-BY' when 'BENUE' then 'NG-BE' when 'BORNO' then 'NG-BO'
  when 'CROSS RIVER' then 'NG-CR' when 'DELTA' then 'NG-DE' when 'EBONYI' then 'NG-EB' when 'EDO' then 'NG-ED'
  when 'EKITI' then 'NG-EK' when 'ENUGU' then 'NG-EN' when 'GOMBE' then 'NG-GO' when 'IMO' then 'NG-IM'
  when 'JIGAWA' then 'NG-JI' when 'KADUNA' then 'NG-KD' when 'KANO' then 'NG-KN' when 'KATSINA' then 'NG-KT'
  when 'KEBBI' then 'NG-KE' when 'KOGI' then 'NG-KO' when 'KWARA' then 'NG-KW' when 'LAGOS' then 'NG-LA'
  when 'NASARAWA' then 'NG-NA' when 'NIGER' then 'NG-NI' when 'OGUN' then 'NG-OG' when 'ONDO' then 'NG-ON'
  when 'OSUN' then 'NG-OS' when 'OYO' then 'NG-OY' when 'PLATEAU' then 'NG-PL' when 'RIVERS' then 'NG-RI'
  when 'SOKOTO' then 'NG-SO' when 'TARABA' then 'NG-TA' when 'YOBE' then 'NG-YO' when 'ZAMFARA' then 'NG-ZA'
  when 'FCT' then 'NG-FC' when 'FEDERAL CAPITAL TERRITORY' then 'NG-FC' else state_code end
where country_code = 'NG' and state_code is null;

alter table public.provider_profiles drop constraint if exists provider_profiles_nationwide_business_only;
alter table public.provider_profiles add constraint provider_profiles_nationwide_business_only
  check (not is_nationwide or provider_type = 'business');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own profile photos" on storage.objects;
drop policy if exists "Users can upload own profile photos" on storage.objects;
drop policy if exists "Users can replace own profile photos" on storage.objects;
drop policy if exists "Users can delete own profile photos" on storage.objects;
create policy "Users can read own profile photos" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can upload own profile photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can replace own profile photos" on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can delete own profile photos" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

grant update (avatar_path) on public.profiles to authenticated;

create or replace function public.get_profile_photo_cards(requested_profile_ids uuid[])
returns table(profile_id uuid, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.avatar_path
  from public.profiles p
  where p.id = any(coalesce(requested_profile_ids, array[]::uuid[]))
    and cardinality(coalesce(requested_profile_ids, array[]::uuid[])) between 1 and 100
    and (
      p.id = (select auth.uid())
      or exists (select 1 from public.provider_profiles pp where pp.profile_id = p.id and pp.is_published)
      or exists (select 1 from public.conversations c where
        (c.customer_id = (select auth.uid()) and c.provider_id = p.id)
        or (c.provider_id = (select auth.uid()) and c.customer_id = p.id))
    );
$$;
revoke all on function public.get_profile_photo_cards(uuid[]) from public, anon, authenticated;
grant execute on function public.get_profile_photo_cards(uuid[]) to authenticated;

alter table public.provider_service_areas add constraint provider_service_areas_state_code_region_match
  check (state_code is null or country_code <> 'NG' or state_code like 'NG-%');

drop function if exists public.replace_provider_service_areas(jsonb);
create function public.replace_provider_service_areas(requested_areas jsonb, requested_nationwide boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  provider_kind text;
begin
  select pp.provider_type into provider_kind from public.provider_profiles pp
    where pp.profile_id = current_user_id for update;
  if current_user_id is null or not exists (select 1 from public.profiles p where p.id = current_user_id and p.account_type = 'provider') then
    raise exception 'A provider account is required.' using errcode = '42501';
  end if;
  if requested_nationwide and provider_kind is distinct from 'business' then
    raise exception 'Nationwide coverage is available to service businesses only.' using errcode = '42501';
  end if;
  if requested_areas is null or jsonb_typeof(requested_areas) is distinct from 'array'
    or (not requested_nationwide and jsonb_array_length(requested_areas) = 0)
    or (requested_nationwide and jsonb_array_length(requested_areas) <> 0) then
    raise exception 'Choose one or more service areas, or choose Nationwide.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_areas) a
    where upper(trim(a->>'country_code')) = 'NG'
      and coalesce(a->>'state_code','') not in (
        'NG-AB','NG-AD','NG-AK','NG-AN','NG-BA','NG-BY','NG-BE','NG-BO','NG-CR','NG-DE','NG-EB','NG-ED',
        'NG-EK','NG-EN','NG-GO','NG-IM','NG-JI','NG-KD','NG-KN','NG-KT','NG-KE','NG-KO','NG-KW','NG-LA',
        'NG-NA','NG-NI','NG-OG','NG-ON','NG-OS','NG-OY','NG-PL','NG-RI','NG-SO','NG-TA','NG-YO','NG-ZA','NG-FC'
      )
  ) then raise exception 'Choose a valid Nigerian state or territory.' using errcode = '22023'; end if;

  delete from public.provider_service_areas where provider_id = current_user_id;
  update public.provider_profiles set is_nationwide = requested_nationwide where profile_id = current_user_id;
  insert into public.provider_service_areas (provider_id, country_code, region, city, state_code)
  select current_user_id, upper(trim(a->>'country_code')), trim(a->>'region'), trim(a->>'city'), nullif(a->>'state_code','')
  from jsonb_array_elements(requested_areas) a;
end;
$$;
revoke all on function public.replace_provider_service_areas(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.replace_provider_service_areas(jsonb, boolean) to authenticated;
