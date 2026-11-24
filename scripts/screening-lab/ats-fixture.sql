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
  stage text not null, candidate_outcome text, interview_disposition text,
  primary key (requisition_id,candidate_id)
);
create table ats_dev.interviews (
  id uuid primary key default gen_random_uuid(), candidate_id uuid not null references ats_dev.candidates(id),
  position_title text not null, interview_date date not null, start_time time, end_time time,
  interview_format text, interview_stage text,
  attendance_status text not null default 'unverified', source_event text
);

-- ATS UI RPCs below are fixture equivalents of operational RPCs that are maintained separately.
create function public.ats_admin_requisitions() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists (select 1 from ats_dev.memberships where user_id=auth.uid() and role='recruiter_admin' and is_active) then
    raise insufficient_privilege;
  end if;
  return jsonb_build_object('requisitions', (select jsonb_agg(r) from ats_dev.requisitions r),
    'assignments', (select jsonb_agg(a) from ats_dev.requisition_candidates a));
end
$$;
create function public.ats_admin_create_interview(
  p_candidate_id uuid,p_position_title text,p_interview_date date,p_start_time text,p_end_time text,
  p_interview_format text,p_interview_stage text
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not exists (select 1 from ats_dev.memberships where user_id=auth.uid() and role='recruiter_admin' and is_active) then
    raise insufficient_privilege;
  end if;
  if not exists (select 1 from ats_dev.candidates where id=p_candidate_id) then
    raise exception 'Candidate not found' using errcode='22023';
  end if;
  if (nullif(p_start_time,'') is not null and p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    or (nullif(p_end_time,'') is not null and p_end_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
    raise exception 'Expected HH:MM' using errcode='22023';
  end if;
  if nullif(p_end_time,'')::time <= nullif(p_start_time,'')::time then
    raise exception 'End time must follow start time' using errcode='22023';
  end if;
  insert into ats_dev.interviews(candidate_id,position_title,interview_date,start_time,end_time,interview_format,interview_stage)
  values(p_candidate_id,p_position_title,p_interview_date,nullif(p_start_time,'')::time,nullif(p_end_time,'')::time,p_interview_format,p_interview_stage)
  returning id into result;
  return result;
end
$$;
revoke all on function public.ats_admin_requisitions(),public.ats_admin_create_interview(uuid,text,date,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ats_admin_requisitions(),public.ats_admin_create_interview(uuid,text,date,text,text,text,text) to authenticated;

-- Synthetic equivalent of the verified bucket boundary, local fixture only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ats-dev-resumes','ats-dev-resumes',false,10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create function public.screening_fixture_is_recruiter() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from ats_dev.memberships where user_id=auth.uid() and role='recruiter_admin' and is_active)
$$;
revoke all on function public.screening_fixture_is_recruiter() from public,anon,authenticated;
grant execute on function public.screening_fixture_is_recruiter() to authenticated;
create policy fixture_legacy_resume_read on storage.objects for select to authenticated
using (bucket_id='ats-dev-resumes' and public.screening_fixture_is_recruiter());
create policy fixture_legacy_resume_insert on storage.objects for insert to authenticated
with check (bucket_id='ats-dev-resumes' and public.screening_fixture_is_recruiter());

-- Directory surface used for interactive acceptance on the synthetic schema.
create function public.ats_admin_directory() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.screening_fixture_is_recruiter() then raise insufficient_privilege; end if;
  return jsonb_build_object(
    'candidates',(select coalesce(jsonb_agg(c),'[]') from ats_dev.candidates c),
    'interviews',(select coalesce(jsonb_agg(i),'[]') from ats_dev.interviews i));
end
$$;
revoke all on function public.ats_admin_directory() from public,anon,authenticated;
grant execute on function public.ats_admin_directory() to authenticated;
