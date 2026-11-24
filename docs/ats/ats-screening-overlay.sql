-- Apply to the ATS Supabase project only, after the existing ats_dev schema.
begin;

create table public.ats_screening_cases (
  application_id uuid primary key,
  requisition_id uuid not null references ats_dev.requisitions(id),
  job_id uuid not null,
  candidate_id uuid references ats_dev.candidates(id) on delete set null,
  identity_state text not null check (identity_state in ('linked','needs_review')),
  application jsonb not null,
  questionnaire jsonb,
  resume_path text,
  resume_sha256 text,
  resume_name text,
  review jsonb not null default '{}',
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
create index on public.ats_screening_cases(requisition_id,application_id);

create table public.ats_screening_audit (
  id bigint generated always as identity primary key,
  application_id uuid not null,
  actor uuid not null,
  action text not null,
  details jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table public.ats_screening_evidence (
  application_id uuid not null references public.ats_screening_cases(application_id),
  fingerprint text not null,
  lease_id uuid not null default gen_random_uuid(),
  leased_at timestamptz not null default now(),
  draft jsonb,
  primary key(application_id,fingerprint)
);

alter table public.ats_screening_cases enable row level security;
alter table public.ats_screening_audit enable row level security;
alter table public.ats_screening_evidence enable row level security;
revoke all on public.ats_screening_cases, public.ats_screening_audit,
  public.ats_screening_evidence from public,anon,authenticated;
grant select on public.ats_screening_cases to service_role;
grant select,insert on public.ats_screening_audit to service_role;
grant select,update,delete on public.ats_screening_evidence to service_role;

create function public.ats_screening_authorize() returns uuid
language sql stable security definer set search_path='' as $$
  select auth.uid() where exists(select 1 from ats_dev.memberships
    where user_id=auth.uid() and is_active and role='recruiter_admin')
$$;

-- Serialize screening imports and preserve existing ATS assignments.
create function public.ats_screening_import(
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
  if not exists (select 1 from ats_dev.memberships where user_id=p_actor
    and is_active and role='recruiter_admin') then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended('ats_screening_identity_import',0));
  -- Coordinate identity checks with existing ATS writers, including manual intake.
  lock table ats_dev.candidates in share row exclusive mode;
  select * into current_case from public.ats_screening_cases where application_id=source_id for update;
  if found then
    if current_case.requisition_id<>p_requisition or current_case.job_id<>job then
      raise exception 'Application already belongs to another requisition';
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

create function public.ats_screening_record_resume(
  p_application uuid,p_candidate uuid,p_actor uuid,p_path text,p_digest text,p_name text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.ats_screening_cases;
begin
  select * into strict result from public.ats_screening_cases
    where application_id=p_application and candidate_id=p_candidate for update;
  if result.resume_path is not null then return to_jsonb(result); end if;
  update public.ats_screening_cases set resume_path=p_path,resume_sha256=p_digest,
    resume_name=p_name,updated_at=now() where application_id=p_application returning * into result;
  insert into public.ats_screening_audit(application_id,actor,action,details)
    values(p_application,p_actor,'resume_synchronized',jsonb_build_object('sha256',p_digest));
  return to_jsonb(result);
end
$$;

create function public.ats_screening_save_review(
  p_actor uuid,p_application uuid,p_revision integer,p_review jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.ats_screening_cases;
begin
  update public.ats_screening_cases set review=p_review,revision=revision+1,updated_at=now()
    where application_id=p_application and revision=p_revision returning * into result;
  if not found then raise exception 'Review changed. Reload before saving again.' using errcode='40001'; end if;
  insert into public.ats_screening_audit(application_id,actor,action,details)
    values(p_application,p_actor,'review_saved',p_review);
  return to_jsonb(result);
end
$$;

create function public.ats_screening_claim_evidence(p_application uuid,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.ats_screening_evidence;
begin
  insert into public.ats_screening_evidence(application_id,fingerprint) values(p_application,p_fingerprint)
  on conflict(application_id,fingerprint) do update set leased_at=now(),lease_id=gen_random_uuid()
    where public.ats_screening_evidence.draft is null
      and public.ats_screening_evidence.leased_at < now()-interval '5 minutes'
  returning * into result;
  if found then return jsonb_build_object('lease',result.lease_id); end if;
  select * into strict result from public.ats_screening_evidence
    where application_id=p_application and fingerprint=p_fingerprint;
  return jsonb_build_object('draft',result.draft);
end
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ats-screening-resumes','ats-screening-resumes',false,10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

revoke all on function public.ats_screening_authorize(),
  public.ats_screening_import(uuid,uuid,jsonb,jsonb,uuid),
  public.ats_screening_record_resume(uuid,uuid,uuid,text,text,text),
  public.ats_screening_save_review(uuid,uuid,integer,jsonb),
  public.ats_screening_claim_evidence(uuid,text) from public,anon,authenticated;
grant execute on function public.ats_screening_authorize() to authenticated;
grant execute on function public.ats_screening_import(uuid,uuid,jsonb,jsonb,uuid),
  public.ats_screening_record_resume(uuid,uuid,uuid,text,text,text),
  public.ats_screening_save_review(uuid,uuid,integer,jsonb),
  public.ats_screening_claim_evidence(uuid,text) to service_role;
commit;
