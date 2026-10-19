# Saved professionals proposal

**PROPOSED, NOT APPLIED**

Suggested future migration filename: `20261019120000_saved_professionals.sql` (timestamp selected 19 October 2026; later than the latest existing migration).

The current schema uses `public.profiles.id` for account identities and `public.provider_profiles.profile_id` for provider profiles. This proposal uses those actual keys. It adds no phone data and does not enable any save/favorite UI.

```sql
create table public.saved_professionals (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, provider_id)
);

alter table public.saved_professionals enable row level security;

create policy "Customers manage their saved professionals"
on public.saved_professionals for all to authenticated
using (customer_id = auth.uid())
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_type = 'customer'
  )
);

revoke all on table public.saved_professionals from anon, authenticated;
grant select, insert, delete on table public.saved_professionals to authenticated;
```

Review the policy and table grants against the then-current schema before considering a migration. This file is documentation only; it is not in `supabase/migrations/` and has not been applied.
