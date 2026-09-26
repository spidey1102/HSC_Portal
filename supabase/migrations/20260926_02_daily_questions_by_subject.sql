-- Allow a separate published question for each subject on the same day.
drop index if exists public.daily_posts_one_per_day_idx;

create unique index daily_posts_one_per_day_idx
  on public.daily_posts (publish_date, lower(subject))
  where published_at is not null;
