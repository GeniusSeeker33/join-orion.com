-- Join-Orion ATS development schema blueprint. NOT applied to production.
-- Apply only to a dedicated ATS development Supabase project after approval.
create table public.ats_candidates (
 id uuid primary key default gen_random_uuid(),
 full_name text not null,
 email text,
 phone text,
 future_consideration text not null default 'unreviewed' check (future_consideration in ('unreviewed','yes','no')),
 identity_review text not null default 'pending',
 created_at timestamptz not null default now()
);
create table public.ats_interviews (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references public.ats_candidates(id) on delete cascade,
 position_title text not null,
 scheduled_at timestamptz,
 format text,
 stage text,
 attendance_status text not null default 'unverified',
 source_calendar_event text,
 created_at timestamptz not null default now()
);
create table public.ats_interview_feedback (
 id uuid primary key default gen_random_uuid(),
 interview_id uuid not null references public.ats_interviews(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 interview_notes text not null default '',
 manager_feedback text not null default '',
 rating integer check (rating between 1 and 5),
 created_at timestamptz not null default now()
);
create table public.ats_candidate_attachments (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references public.ats_candidates(id) on delete cascade,
 uploaded_by uuid not null references auth.users(id),
 storage_path text not null unique,
 original_filename text not null,
 content_type text not null,
 created_at timestamptz not null default now()
);
alter table public.ats_candidates enable row level security;
alter table public.ats_interviews enable row level security;
alter table public.ats_interview_feedback enable row level security;
alter table public.ats_candidate_attachments enable row level security;
-- Intentional deny-by-default: no policies or grants until ATS user roles
-- and secure server-side authorization are implemented and tested.
revoke all on public.ats_candidates,public.ats_interviews,public.ats_interview_feedback,public.ats_candidate_attachments from anon,authenticated;
-- Resumes must use a PRIVATE storage bucket with authenticated, audited access.
