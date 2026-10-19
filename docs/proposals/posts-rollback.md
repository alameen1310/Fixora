# Problem posts migration rollback

This rollback is paired with `20261019195308_add_problem_posts.sql`. It is destructive: it removes all post rows, image reservations, and stored post photos. Do not run it until the owner explicitly approves rollback and confirms retention requirements.

**STEP 1 — Empty and delete the Storage bucket.** Using an admin context, call the Supabase Storage API in order: `emptyBucket('problem-post-photos')`, then `deleteBucket('problem-post-photos')`. Alternatively, empty and delete the bucket in the Supabase dashboard. Do not delete rows from `storage.objects` or `storage.buckets` using SQL; Supabase protects those tables from direct SQL deletes.

**STEP 2 — Run the SQL below** to remove the policies, triggers, functions, tables, and enums in dependency order.

```sql
begin;

drop policy if exists "Customers delete photos from their own posts" on storage.objects;
drop policy if exists "Customers upload post photos to their own folder" on storage.objects;
drop policy if exists "Users read photos for visible posts" on storage.objects;

drop policy if exists "Customers remove images from their posts" on public.problem_post_images;
drop policy if exists "Customers add images to their posts" on public.problem_post_images;
drop policy if exists "Users read images for visible posts" on public.problem_post_images;
drop policy if exists "Customers update their own non-removed posts" on public.problem_posts;
drop policy if exists "Customers create their own staged posts" on public.problem_posts;
drop policy if exists "Signed-in users read open posts and owners read theirs" on public.problem_posts;

drop trigger if exists problem_post_images_limit on public.problem_post_images;
drop trigger if exists problem_posts_staging_limit on public.problem_posts;
drop trigger if exists problem_posts_timestamps on public.problem_posts;

drop function if exists public.get_problem_post_author_cards(uuid[]);
drop function if exists public.publish_problem_post(uuid);
drop function if exists public.enforce_problem_post_image_limit();
drop function if exists public.enforce_problem_post_staging_limit();
drop function if exists public.set_problem_post_timestamps();

drop table if exists public.problem_post_images;
drop table if exists public.problem_posts;

drop type if exists public.problem_job_type;
drop type if exists public.problem_timing;
drop type if exists public.problem_budget_type;
drop type if exists public.problem_post_status;

commit;
```

The migration creates no phone-number columns or public phone projection. `problem_posts.author_id` and `display_name` in the narrow author-card function are identifiers/display text only; the function never selects profile phone data.

## Stage 2 verification notes

- Confirm a fixed budget with NULL `budget_min_naira`, a range with NULL `budget_max_naira`, and any amount above 100,000,000,000 are rejected.
- Do not attempt Storage deletes through SQL. Inspect the Storage DELETE policy text through `pg_policies`; test actual deletion manually through the app.
- Confirm the owner can add an image reservation to a published, open post.
