-- Hide the Collections Specialist posting from the public careers page.
-- Soft-delete (is_active = false) so the row and any linked
-- candidate_applications are preserved and it can be reopened later.

update public.job_postings
  set is_active = false
  where title = 'Collections Specialist';
