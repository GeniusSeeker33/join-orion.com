-- ATS project. Read-only. Excludes applicant names, contact information, resumes and scheduler command bodies.
begin read only;
select to_regclass('ats_dev.requisitions') as requisitions,
       to_regclass('ats_dev.candidates') as candidates,
       to_regclass('ats_dev.requisition_candidates') as assignments,
       to_regclass('public.ats_screening_cases') as screening_cases,
       to_regprocedure('public.ats_screening_save_interview_review(uuid,uuid,integer,jsonb,boolean)') as phase2_review,
       to_regclass('cron.job') as postgres_scheduler;
select table_name,column_name,data_type
from information_schema.columns
where table_schema='ats_dev' and table_name in ('candidates','requisitions','requisition_candidates','memberships')
order by table_name,ordinal_position;
select schemaname,tablename,indexdef from pg_indexes
where schemaname='ats_dev' and tablename='requisition_candidates';
select id,public,file_size_limit from storage.buckets order by id;
rollback;

-- Run once the ATS base schema is confirmed present.
-- begin read only;
-- select r.id,r.title,r.status,count(a.candidate_id) as assignments
-- from ats_dev.requisitions r left join ats_dev.requisition_candidates a on a.requisition_id=r.id
-- where r.id in ('0b3de8eb-dfff-435b-ab7a-cbf9667a3eee','a822e721-4d9e-439d-83c8-a1a0a41efbe6')
--   or r.title ~* '(customer service|warehouse middle|picker/packer|production assistant|cerakote applicator|sales executive)'
-- group by r.id,r.title,r.status order by r.title,r.status,r.id;
-- select count(*) from ats_dev.memberships where is_active and role='recruiter_admin';
-- rollback;

-- If cron.job exists and is accessible, check candidates for overlapping automation.
-- select jobid,schedule,active,command ~* '(returns|screening|resume)' as might_sync_screening
-- from cron.job where command ~* '(returns|screening|resume)';
