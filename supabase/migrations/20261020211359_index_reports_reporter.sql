create index if not exists reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);
