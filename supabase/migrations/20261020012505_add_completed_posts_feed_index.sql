create index if not exists problem_posts_completed_feed_idx
  on public.problem_posts (completed_at desc, id desc)
  where status = 'completed' and published_at is not null;
