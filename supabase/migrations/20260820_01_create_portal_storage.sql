-- HSC Portal persistence migration: Firebase Authentication stays in place;
-- this database is accessed only by Vercel APIs after Firebase token verification.

create table if not exists public.portal_user_data (
  firebase_uid text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portal_user_data enable row level security;
revoke all on table public.portal_user_data from anon, authenticated;

create table if not exists public.paper_metadata (
  paper_key text primary key,
  paper_id text not null,
  paper_name text not null,
  source_fingerprint text not null,
  extraction_version text not null,
  status text not null check (status in ('analysing', 'ready', 'error', 'missing')),
  analysis_started_at_millis bigint,
  question_count integer,
  total_marks numeric,
  questions jsonb not null default '[]'::jsonb,
  confidence text,
  notes text,
  pages_analysed integer,
  total_pages integer,
  error_message text,
  extracted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.paper_metadata enable row level security;
revoke all on table public.paper_metadata from anon, authenticated;

create index if not exists paper_metadata_status_updated_at_idx
  on public.paper_metadata (status, updated_at desc);

-- Atomically claims a missing, stale, or failed paper-analysis job. If another
-- request already owns a current job or a ready cache entry, that row is returned
-- unchanged. This avoids client races without Firestore transactions.
create or replace function public.claim_paper_analysis(
  p_paper_key text,
  p_paper_id text,
  p_paper_name text,
  p_source_fingerprint text,
  p_extraction_version text,
  p_analysis_started_at_millis bigint,
  p_lock_ms bigint
)
returns public.paper_metadata
language plpgsql
set search_path = public
as $$
declare
  claimed public.paper_metadata;
begin
  insert into public.paper_metadata (
    paper_key,
    paper_id,
    paper_name,
    source_fingerprint,
    extraction_version,
    status,
    analysis_started_at_millis,
    updated_at
  ) values (
    p_paper_key,
    p_paper_id,
    p_paper_name,
    p_source_fingerprint,
    p_extraction_version,
    'analysing',
    p_analysis_started_at_millis,
    now()
  )
  on conflict (paper_key) do update
    set paper_id = excluded.paper_id,
        paper_name = excluded.paper_name,
        source_fingerprint = excluded.source_fingerprint,
        extraction_version = excluded.extraction_version,
        status = 'analysing',
        analysis_started_at_millis = excluded.analysis_started_at_millis,
        question_count = null,
        total_marks = null,
        questions = '[]'::jsonb,
        confidence = null,
        notes = null,
        pages_analysed = null,
        total_pages = null,
        error_message = null,
        extracted_at = null,
        updated_at = now()
    where public.paper_metadata.source_fingerprint is distinct from excluded.source_fingerprint
       or public.paper_metadata.extraction_version is distinct from excluded.extraction_version
       or public.paper_metadata.status not in ('ready', 'analysing')
       or (
         public.paper_metadata.status = 'analysing'
         and coalesce(public.paper_metadata.analysis_started_at_millis, 0)
             <= p_analysis_started_at_millis - p_lock_ms
       )
  returning * into claimed;

  if claimed.paper_key is null then
    select * into claimed
    from public.paper_metadata
    where paper_key = p_paper_key;
  end if;

  return claimed;
end;
$$;

revoke all on function public.claim_paper_analysis(text, text, text, text, text, bigint, bigint)
  from public;
