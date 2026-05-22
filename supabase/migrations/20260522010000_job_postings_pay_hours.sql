-- Add pay and hours fields to job postings so they can be displayed
-- as structured fields on the /careers page instead of being buried
-- in the description body.

alter table public.job_postings
  add column if not exists pay   text,
  add column if not exists hours text;
