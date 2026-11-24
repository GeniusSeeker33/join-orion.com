-- Owner host only. Raw definitions may contain secrets. Write to a private file for review.
begin read only;
select p.oid::regprocedure,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.prokind='f' and (
  (n.nspname='public' and p.proname in (
    'ats_admin_directory','ats_admin_requisitions','ats_admin_assign_requisition',
    'ats_admin_create_interview','ats_admin_update_attendance','ats_admin_hiring_managers',
    'ats_admin_manager_feedback_labels','ats_admin_save_manager_feedback','ats_admin_record_resume',
    'ats_admin_resumes','ats_admin_set_candidate_outcome','ats_admin_set_interview_disposition',
    'ats_service_sync_returns','ats_service_returns_resume_imported'
  )) or (n.nspname in ('public','ats_dev') and p.proname='ats_is_recruiter_admin')
  or p.oid in (
    select t.tgfoid from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace s on s.oid=c.relnamespace
    where s.nspname='ats_dev' and c.relname in ('requisition_candidates','interviews','candidate_resumes')
      and not t.tgisinternal
  )
)
order by p.oid::regprocedure::text;
rollback;
