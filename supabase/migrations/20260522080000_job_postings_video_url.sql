-- Add video_url column to job_postings and set the Sales Executive video.

alter table public.job_postings
  add column if not exists video_url text;

update public.job_postings
  set video_url = 'https://www.youtube.com/shorts/mn18fKOTR2Q'
  where title = 'Sales Executive – Inside Sales';
