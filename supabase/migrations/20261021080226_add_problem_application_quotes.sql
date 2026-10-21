alter table public.problem_post_applications
  add column quote_naira bigint;

alter table public.problem_post_applications
  add constraint problem_post_applications_quote_naira_check
  check (quote_naira is null or (quote_naira > 0 and quote_naira <= 100000000000));

grant insert (quote_naira) on public.problem_post_applications to authenticated;
