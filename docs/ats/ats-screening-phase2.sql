-- ATS project only, after ats-screening-overlay.sql.
begin;
-- NULL identifies an automated action. Import remains executable by service_role only.
alter table public.ats_screening_audit alter column actor drop not null;
create index if not exists ats_screening_resume_digest on public.ats_screening_cases(candidate_id,resume_sha256)
  where resume_path is not null;
create index if not exists ats_screening_review_status on public.ats_screening_cases(requisition_id,(review->>'completed'));

-- Protect known operational IDs and canonical titles in disposable or reviewed baselines.
create or replace function public.ats_screening_legacy_returns(p_job uuid,p_requisition uuid)
returns boolean language sql stable set search_path='' as $$
  select coalesce(p_job='db38820b-3d0b-4018-a7b1-8012b53ba996',false)
    or coalesce(p_requisition='a822e721-4d9e-439d-83c8-a1a0a41efbe6',false)
    or exists (select 1 from ats_dev.requisitions r where r.id=p_requisition
      and lower(r.title) ~ '^[[:space:]]*customer service.*[[:<:]]returns[[:>:]]')
$$;
create or replace function public.ats_screening_enforce_case_owner() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (tg_op='UPDATE' and public.ats_screening_legacy_returns(old.job_id,old.requisition_id))
    or public.ats_screening_legacy_returns(new.job_id,new.requisition_id) then
    raise exception 'Returns synchronization is owned by the legacy engine' using errcode='22023';
  end if;
  return new;
end
$$;
drop trigger if exists ats_screening_enforce_case_owner on public.ats_screening_cases;
create trigger ats_screening_enforce_case_owner before insert or update on public.ats_screening_cases
for each row execute function public.ats_screening_enforce_case_owner();
revoke all on function public.ats_screening_legacy_returns(uuid,uuid),public.ats_screening_enforce_case_owner()
  from public,anon,authenticated;

create or replace function public.ats_screening_import(
  p_actor uuid,p_requisition uuid,p_application jsonb,p_questionnaire jsonb,p_candidate uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  source_id uuid:=(p_application->>'id')::uuid;
  job uuid:=(p_application->>'position_id')::uuid;
  applicant_name text:=trim(concat_ws(' ',p_application->>'first_name',p_application->>'last_name'));
  applicant_email text:=lower(trim(coalesce(p_application->>'email','')));
  applicant_phone text:=right(regexp_replace(coalesce(p_application->>'phone',''),'[^0-9]','','g'),10);
  current_case public.ats_screening_cases;
  matched ats_dev.candidates;
  matches integer;
  chosen uuid;
  outcome text:='needs_review';
begin
  if p_actor is not null and not exists (select 1 from ats_dev.memberships where user_id=p_actor
    and is_active and role='recruiter_admin') then raise insufficient_privilege; end if;
  if public.ats_screening_legacy_returns(job,p_requisition) then
    raise exception 'Returns synchronization is owned by the legacy engine' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ats_screening_identity_import',0));
  -- Coordinate identity checks with existing ATS writers, including manual intake.
  lock table ats_dev.candidates in share row exclusive mode;
  select * into current_case from public.ats_screening_cases where application_id=source_id for update;
  if found then
    if current_case.requisition_id<>p_requisition or current_case.job_id<>job then
      raise exception 'Application already belongs to another requisition';
    end if;
    -- Only backfill missing legacy assessment data and refresh source interview metadata.
    -- Preserve versioned submissions, existing identity decisions and recruiter reviews.
    update public.ats_screening_cases c set
      application=c.application || jsonb_build_object(
        'screening_answers',coalesce(nullif(c.application->'screening_answers','null'::jsonb),p_application->'screening_answers'),
        'interview_status',p_application->'interview_status','interview_at',p_application->'interview_at',
        'interview_teams_url',p_application->'interview_teams_url','interview_notes',p_application->'interview_notes'),
      questionnaire=coalesce(c.questionnaire,p_questionnaire),updated_at=now()
    where c.application_id=source_id and (
      (c.application->>'interview_status',c.application->>'interview_at',c.application->>'interview_teams_url',c.application->>'interview_notes')
        is distinct from (p_application->>'interview_status',p_application->>'interview_at',p_application->>'interview_teams_url',p_application->>'interview_notes')
      or (nullif(c.application->'screening_answers','null'::jsonb) is null and nullif(p_application->'screening_answers','null'::jsonb) is not null)
      or (c.questionnaire is null and p_questionnaire is not null))
    returning * into current_case;
    if found then
      insert into public.ats_screening_audit(application_id,actor,action)
        values(source_id,p_actor,'source_details_refreshed');
    else
      select * into strict current_case from public.ats_screening_cases where application_id=source_id;
    end if;
    if current_case.candidate_id is not null or p_candidate is null then return to_jsonb(current_case); end if;
  end if;

  if p_candidate is not null then
    select id into strict chosen from ats_dev.candidates where id=p_candidate;
  else
    select count(*) into matches from ats_dev.candidates c
      where (applicant_email<>'' and lower(trim(c.email))=applicant_email)
        or (length(applicant_phone)=10 and right(regexp_replace(c.phone,'[^0-9]','','g'),10)=applicant_phone);
    if matches=1 then
      select * into matched from ats_dev.candidates c
        where (applicant_email<>'' and lower(trim(c.email))=applicant_email)
          or (length(applicant_phone)=10 and right(regexp_replace(c.phone,'[^0-9]','','g'),10)=applicant_phone);
      if applicant_email<>'' and lower(trim(matched.email))=applicant_email
        and lower(regexp_replace(trim(matched.full_name),'\s+',' ','g'))=lower(regexp_replace(applicant_name,'\s+',' ','g'))
        and (applicant_phone='' or nullif(regexp_replace(matched.phone,'[^0-9]','','g'),'') is null
          or right(regexp_replace(matched.phone,'[^0-9]','','g'),10)=applicant_phone) then
        chosen:=matched.id;
      end if;
    elsif matches=0 and applicant_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
      and length(applicant_name)>1 and length(applicant_phone)=10 then
      insert into ats_dev.candidates(full_name,email,phone,application_source)
        values(applicant_name,applicant_email,p_application->>'phone',
          case
            when lower(p_application->>'source') in ('indeed','indeed_followup') then 'Indeed'
            when lower(p_application->>'source')='linkedin' then 'LinkedIn'
            when lower(p_application->>'source')='orionfflsales' then 'OrionFFLSales'
            else 'Join-Orion'
          end) returning id into chosen;
    end if;
  end if;

  if chosen is not null then
    outcome:='linked';
    insert into ats_dev.requisition_candidates(requisition_id,candidate_id,stage)
      values(p_requisition,chosen,'new') on conflict(requisition_id,candidate_id) do nothing;
  end if;
  insert into public.ats_screening_cases(application_id,requisition_id,job_id,candidate_id,
      identity_state,application,questionnaire,review)
    values(source_id,p_requisition,job,chosen,outcome,p_application - 'resume_path',p_questionnaire,
      jsonb_strip_nulls(jsonb_build_object('interview_at',p_application->>'interview_at',
        'meeting_url',p_application->>'interview_teams_url','notes',p_application->>'interview_notes')))
  on conflict(application_id) do update set candidate_id=excluded.candidate_id,
    identity_state=excluded.identity_state,updated_at=now()
  returning * into current_case;
  insert into public.ats_screening_audit(application_id,actor,action,details)
    values(source_id,p_actor,case when p_candidate is not null then 'identity_resolved' else outcome end,
      jsonb_build_object('candidate_id',chosen,'requisition_id',p_requisition));
  return to_jsonb(current_case);
end
$$;

create or replace function public.ats_screening_save_interview_review(
  p_actor uuid,p_application uuid,p_revision integer,p_review jsonb,p_advance boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.ats_screening_cases;
begin
  if not exists (select 1 from ats_dev.memberships where user_id=p_actor
    and is_active and role='recruiter_admin') then raise insufficient_privilege; end if;
  result:=jsonb_populate_record(null::public.ats_screening_cases,
    public.ats_screening_save_review(p_actor,p_application,p_revision,p_review));
  if p_advance then
    if result.candidate_id is null or nullif(p_review->>'interview_at','') is null then
      raise exception 'Link the candidate and record an interview time before moving the pipeline' using errcode='22023';
    end if;
    update ats_dev.requisition_candidates set stage='interview'
      where candidate_id=result.candidate_id and requisition_id=result.requisition_id and stage in ('new','screening')
        -- Leave dispositions and recorded outcomes to the ATS outcome/closure workflow.
        and nullif(candidate_outcome::text,'') is null
        and nullif(interview_disposition::text,'') is null;
    if found then
      insert into public.ats_screening_audit(application_id,actor,action)
        values(p_application,p_actor,'interview_stage_confirmed');
    end if;
  end if;
  return to_jsonb(result);
end
$$;
revoke all on function public.ats_screening_save_interview_review(uuid,uuid,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.ats_screening_save_interview_review(uuid,uuid,integer,jsonb,boolean) to service_role;
commit;
