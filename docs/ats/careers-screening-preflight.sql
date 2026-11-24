-- CAREERS project. Read-only. Returns posting metadata, schema metadata and aggregate counts.
begin read only;
select id, title, department, is_active, location, hours, pay
from public.job_postings
where id='6702d7a6-3c34-4b93-9fba-d86b67b419ec'
   or title ~* '(customer service|warehouse middle|picker/packer|production assistant|cerakote applicator|sales executive)'
order by title,is_active desc,id;

select count(*) filter (where title='Customer Service & Returns Specialist — Compliance Support') as returns_repost_rows,
       count(*) filter (where title='Customer Service & Returns Specialist — Compliance Support' and is_active) as returns_active_rows,
       count(*) filter (where title in ('Customer Service & Compliance Specialist','Customer Service and Compliance Specialist') and is_active) as original_active_rows
from public.job_postings;

select p.id,p.title,count(a.id) as historical_applications,
  count(a.id) filter (where jsonb_typeof(to_jsonb(a)->'screening_answers')='object') as assessed
from public.job_postings p left join public.candidate_applications a on a.position_id=p.id
where p.title ~* '(customer service|warehouse middle|picker/packer|production assistant|cerakote applicator|sales executive)'
group by p.id,p.title order by p.title,p.id;

select to_regclass('supabase_migrations.schema_migrations') as migration_ledger,
       to_regclass('public.screening_positions') as positions,
       to_regclass('public.screening_versions') as versions,
       to_regclass('public.screening_sync_queue') as sync_queue,
       to_regclass('cron.job') as postgres_scheduler;
select table_name,column_name,data_type
from information_schema.columns
where table_schema='public' and table_name in ('job_postings','candidate_applications','screening_positions','screening_versions','screening_sync_queue')
order by table_name,ordinal_position;
select tgname from pg_trigger where tgrelid='public.candidate_applications'::regclass and not tgisinternal;
select id,public,file_size_limit from storage.buckets where id='resumes';
rollback;

-- If the migration ledger exists, run this statement in a separate read-only transaction.
-- select version from supabase_migrations.schema_migrations
-- where version in ('20261123000000','20261123001000','20261124000000','20261124010000','20261124020000') order by version;

-- If cron.job exists and is accessible, check for legacy automation without returning command bodies.
-- select jobid,schedule,active,command ~* '(returns|screening|resume)' as might_sync_screening
-- from cron.job where command ~* '(returns|screening|resume)';
