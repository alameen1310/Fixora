-- Restore anonymous reads for published provider discovery. Existing RLS
-- policies continue to limit rows to published providers.
grant select on table public.provider_service_categories to anon;
grant select on table public.provider_service_areas to anon;

-- Reject NULL before the allowed-value check. CREATE OR REPLACE preserves
-- the function owner and existing ACL; the explicit grants below restate the
-- intended authenticated-only API access.
create or replace function public.choose_account_type(requested_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if requested_type is null
    or requested_type not in ('customer', 'provider') then
    raise exception 'Choose a valid account type.' using errcode = '22023';
  end if;

  update public.profiles
  set account_type = requested_type
  where id = auth.uid() and account_type is null
  returning account_type into existing_type;

  if existing_type is not null then
    return existing_type;
  end if;

  select account_type into existing_type
  from public.profiles where id = auth.uid();
  if existing_type is null then
    raise exception 'Profile is not ready yet.' using errcode = 'P0002';
  end if;
  if existing_type <> requested_type then
    raise exception 'Account type has already been selected.' using errcode = '42501';
  end if;
  return existing_type;
end;
$$;

revoke all on function public.choose_account_type(text)
  from public, anon, authenticated;
grant execute on function public.choose_account_type(text) to authenticated;
