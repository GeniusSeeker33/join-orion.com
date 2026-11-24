-- Run against the operational Careers database with read-only authorization.
begin read only;
select id,title,is_active
from public.job_postings
where is_active
order by title,id;
rollback;
