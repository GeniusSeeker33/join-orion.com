-- Correct the Sales Executive video URL.

update public.job_postings
  set video_url = 'https://www.youtube.com/shorts/kRoyTbkqxYQ'
  where title = 'Sales Executive – Inside Sales';
