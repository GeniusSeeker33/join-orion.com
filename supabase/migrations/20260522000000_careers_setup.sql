-- =====================================================================
-- Orion Careers Page — Supabase setup
-- Run these statements in your Supabase project: SQL Editor → New Query.
-- Re-running is safe: each block uses IF NOT EXISTS / DROP-then-CREATE
-- patterns for policies so you won't get duplicate-policy errors.
-- =====================================================================

-- 1. job_postings -----------------------------------------------------
create table if not exists public.job_postings (
  id              uuid primary key default gen_random_uuid(),
  title           text        not null,
  department      text,
  location        text,
  employment_type text,        -- e.g. "Full-time", "Part-time", "Contract"
  description     text,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now()
);

alter table public.job_postings enable row level security;

drop policy if exists "Anyone can read active job postings" on public.job_postings;
create policy "Anyone can read active job postings"
  on public.job_postings
  for select
  using (is_active = true);

-- 2. candidate_applications ------------------------------------------
create table if not exists public.candidate_applications (
  id              uuid primary key default gen_random_uuid(),
  first_name      text        not null,
  last_name       text        not null,
  email           text        not null,
  phone           text        not null,
  position_id     uuid        references public.job_postings(id) on delete set null,
  position_title  text        not null,
  cover_letter    text,
  resume_path     text,
  status          text        not null default 'new',
  created_at      timestamptz not null default now()
);

alter table public.candidate_applications enable row level security;

-- Anon role can INSERT (public form submission) and UPDATE (so we can
-- attach the resume_path after the file uploads). Anon CANNOT select —
-- only authenticated/service_role can read submissions.
drop policy if exists "Anon can submit candidate application" on public.candidate_applications;
create policy "Anon can submit candidate application"
  on public.candidate_applications
  for insert
  to anon
  with check (true);

drop policy if exists "Anon can attach resume path" on public.candidate_applications;
create policy "Anon can attach resume path"
  on public.candidate_applications
  for update
  to anon
  using (true)
  with check (true);

-- 3. Storage bucket: resumes -----------------------------------------
-- Create the bucket (private). Run once; Supabase ignores if it exists.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Allow anon role to upload to the resumes bucket only.
drop policy if exists "Anon can upload resumes" on storage.objects;
create policy "Anon can upload resumes"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'resumes');

-- 4. Sample job posting (optional — delete if you want to start empty)
insert into public.job_postings (title, department, location, employment_type, description)
values ('Warehouse Associate', 'Operations', 'TX (On-site)', 'Full-time',
        'Pull, pack, and ship dealer orders accurately and quickly. Prior warehouse experience a plus.');
