-- The post form sends schedule fields on insert and update. The table uses
-- column-level grants, so include these fields while keeping server-owned
-- columns and row-level security protected.
grant insert (schedule_mode, scheduled_start_at, scheduled_end_at)
  on public.problem_posts to authenticated;

grant update (schedule_mode, scheduled_start_at, scheduled_end_at)
  on public.problem_posts to authenticated;
