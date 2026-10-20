-- Add user-submitted safety reports without exposing reports to other users.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'user', 'message')),
  target_id uuid not null,
  reason text not null check (reason in ('Spam', 'Inappropriate', 'Scam', 'Other')),
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy reports_select_own
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

create policy reports_insert_own
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

revoke all on public.reports from anon, authenticated;
grant select, insert on public.reports to authenticated;
