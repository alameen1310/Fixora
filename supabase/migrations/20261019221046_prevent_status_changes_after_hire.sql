create or replace function public.prevent_reopening_hired_problem_post()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.hired_professional_id is not null and new.status is distinct from old.status then
    raise exception 'A hired post cannot change status.' using errcode = '42501';
  end if;
  return new;
end;
$$;
