-- Firebase Authentication remains the identity provider. Only the site's
-- server routes access these tables; no browser Supabase credentials are used.
create table if not exists public.daily_contributors (
  firebase_uid text primary key,
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_posts (
  id uuid primary key default gen_random_uuid(),
  author_uid text not null,
  title text not null,
  subject text not null default '',
  question_text text not null default '',
  question_file_path text,
  question_file_name text,
  solution_text text not null default '',
  solution_file_path text,
  solution_file_name text,
  publish_date date,
  published_at timestamptz,
  solution_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_posts_one_per_day_idx
  on public.daily_posts (publish_date)
  where published_at is not null;
create index if not exists daily_posts_public_idx
  on public.daily_posts (publish_date desc)
  where published_at is not null;

create table if not exists public.daily_submissions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.daily_posts(id),
  student_uid text not null,
  answer_text text not null default '',
  file_path text,
  file_name text,
  created_at timestamptz not null default now(),
  unique (post_id, student_uid)
);
create index if not exists daily_submissions_post_idx
  on public.daily_submissions (post_id, created_at desc);

alter table public.daily_contributors enable row level security;
alter table public.daily_posts enable row level security;
alter table public.daily_submissions enable row level security;
revoke all on public.daily_contributors, public.daily_posts, public.daily_submissions from anon, authenticated;

-- Private bucket: signed upload/download URLs are issued only after the site's
-- Firebase UID checks. Supabase Storage enforces the file type and size too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('daily-questions', 'daily-questions', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
