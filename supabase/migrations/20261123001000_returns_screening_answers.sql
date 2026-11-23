-- Responses are submitted together with the existing candidate application.
-- No public read policy is introduced; existing candidate privacy rules remain.
alter table public.candidate_applications
  add column if not exists screening_answers jsonb;
comment on column public.candidate_applications.screening_answers is
  'Candidate-provided answers to job-specific screening questions. Human-reviewed; not an automated hiring decision.';
