-- Add optional campaign attribution fields to candidate applications.
-- Existing applications and source tracking remain unchanged.

ALTER TABLE public.candidate_applications
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text;
