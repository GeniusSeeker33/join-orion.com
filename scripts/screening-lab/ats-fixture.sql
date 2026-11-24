-- Synthetic ATS contract fixture. The maintained operational ATS baseline is external.
create schema ats_dev;
revoke all on schema ats_dev from public,anon,authenticated;
create table ats_dev.memberships (
  user_id uuid primary key references auth.users(id), role text not null, is_active boolean not null
);
create table ats_dev.requisitions (
  id uuid primary key, title text not null, status text not null, department text not null default 'Synthetic'
);
create table ats_dev.candidates (
  id uuid primary key default gen_random_uuid(), full_name text not null, email text, phone text, application_source text
);
create table ats_dev.requisition_candidates (
  requisition_id uuid references ats_dev.requisitions(id), candidate_id uuid references ats_dev.candidates(id),
  stage text not null, primary key (requisition_id,candidate_id)
);
create table ats_dev.interviews (
  id uuid primary key default gen_random_uuid(), candidate_id uuid not null references ats_dev.candidates(id),
  position_title text not null, interview_date date not null, start_time time, end_time time,
  interview_format text, interview_stage text
);

-- ATS UI RPCs below are fixture equivalents of operational RPCs that are maintained separately.
create function public.ats_admin_requisitions() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists (select 1 from ats_dev.memberships where user_id=auth.uid() and role='recruiter_admin' and is_active) then
    raise insufficient_privilege;
  end if;
  return jsonb_build_object('requisitions', (select jsonb_agg(r) from ats_dev.requisitions r));
end
$$;
create function public.ats_admin_create_interview(
  p_candidate_id uuid,p_position_title text,p_interview_date date,p_start_time time,p_end_time time,
  p_interview_format text,p_interview_stage text
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not exists (select 1 from ats_dev.memberships where user_id=auth.uid() and role='recruiter_admin' and is_active) then
    raise insufficient_privilege;
  end if;
  insert into ats_dev.interviews(candidate_id,position_title,interview_date,start_time,end_time,interview_format,interview_stage)
  values(p_candidate_id,p_position_title,p_interview_date,p_start_time,p_end_time,p_interview_format,p_interview_stage)
  returning id into result;
  return result;
end
$$;
create function public.screening_lab_setup(p_recruiter uuid,p_requisitions jsonb) returns void
language sql security definer set search_path='' as $$
  insert into ats_dev.memberships values(p_recruiter,'recruiter_admin',true);
  insert into ats_dev.requisitions(id,title,status)
    select id,title,'open' from jsonb_to_recordset(p_requisitions) as rows(id uuid,title text);
$$;
create function public.screening_lab_pipeline() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('assignments',(select jsonb_agg(a) from ats_dev.requisition_candidates a),
    'interviews',(select jsonb_agg(i) from ats_dev.interviews i));
$$;
revoke all on function public.ats_admin_requisitions(),public.ats_admin_create_interview(uuid,text,date,time,time,text,text),
  public.screening_lab_setup(uuid,jsonb),public.screening_lab_pipeline() from public,anon,authenticated;
grant execute on function public.ats_admin_requisitions(),public.ats_admin_create_interview(uuid,text,date,time,time,text,text) to authenticated;
grant execute on function public.screening_lab_setup(uuid,jsonb),public.screening_lab_pipeline() to service_role;
