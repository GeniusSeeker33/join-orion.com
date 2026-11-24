-- Local-only synthetic seed and observation helpers for either reviewed or fixture ATS schema.
create function public.screening_lab_setup(p_recruiter uuid,p_requisitions jsonb) returns void
language sql security definer set search_path='' as $$
  insert into ats_dev.memberships(user_id,role,is_active) values(p_recruiter,'recruiter_admin',true);
  insert into ats_dev.requisitions(id,title,status)
    select id,title,'open' from jsonb_to_recordset(p_requisitions) as rows(id uuid,title text);
$$;
create function public.screening_lab_pipeline() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('assignments',(select jsonb_agg(a) from ats_dev.requisition_candidates a),
    'interviews',(select jsonb_agg(i) from ats_dev.interviews i));
$$;
revoke all on function public.screening_lab_setup(uuid,jsonb),public.screening_lab_pipeline() from public,anon,authenticated;
grant execute on function public.screening_lab_setup(uuid,jsonb),public.screening_lab_pipeline() to service_role;
