-- CAREERS only, after the screening queue migration. Scheduler approval starts off for every mapping.
begin;
alter table public.screening_positions
  add column if not exists alternate_requisition_id uuid,
  add column if not exists requires_routing boolean not null default false,
  add column if not exists automation_enabled boolean not null default false;

update public.screening_positions p set requires_routing=true
from public.job_postings j where j.id=p.job_id
  and lower(regexp_replace(j.title,'\s+','','g'))='warehousepicker/packer';

create table if not exists public.screening_application_routes (
  application_id uuid primary key references public.candidate_applications(id) on delete cascade,
  job_id uuid not null references public.screening_positions(job_id),
  requisition_id uuid not null,
  selected_by uuid not null,
  selected_at timestamptz not null default now()
);
alter table public.screening_application_routes enable row level security;
revoke all on public.screening_application_routes from public,anon,authenticated;
grant select on public.screening_application_routes to service_role;

create or replace function public.write_screening_routing(
  p_job uuid,p_requisition uuid,p_questions jsonb,p_actor uuid,p_publish boolean,p_alternate uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.screening_positions; split boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('screening_routing_configuration',0));
  select lower(regexp_replace(title,'\s+','','g'))='warehousepicker/packer' into split
    from public.job_postings where id=p_job;
  if not found or p_requisition is null or p_alternate=p_requisition or (p_alternate is not null and not split) then
    raise exception 'Invalid posting or destination' using errcode='22023';
  end if;
  select * into p from public.screening_positions where job_id=p_job;
  split:=split or coalesce(p.requires_routing,false);
  p_alternate:=coalesce(p_alternate,p.alternate_requisition_id);
  if (split and p_publish and p_alternate is null)
    or (p.published_id is not null and p.alternate_requisition_id is not null and p.alternate_requisition_id<>p_alternate)
    or exists (select 1 from public.screening_positions s where s.job_id<>p_job
      and (s.requisition_id in (p_requisition,p_alternate) or s.alternate_requisition_id in (p_requisition,p_alternate))) then
    raise exception 'Both distinct destinations must be verified and each requisition must belong to only one posting' using errcode='22023';
  end if;
  perform public.write_screening_questionnaire(p_job,p_requisition,p_questions,p_actor,p_publish);
  update public.screening_positions set requires_routing=split,alternate_requisition_id=p_alternate
    where job_id=p_job returning * into p;
  return to_jsonb(p);
end
$$;

-- The source row and immutable application route share a transaction. No ATS write takes place here.
create or replace function public.select_screening_application_route(
  p_application uuid,p_job uuid,p_requisition uuid,p_actor uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  perform 1 from public.candidate_applications where id=p_application and position_id=p_job for update;
  if not found or p_actor is null or not exists (
    select 1 from public.screening_positions where job_id=p_job and requires_routing
      and alternate_requisition_id is not null and published_id is not null
      and p_requisition in (requisition_id,alternate_requisition_id)
  ) then raise exception 'Unverified application route' using errcode='22023'; end if;
  insert into public.screening_application_routes(application_id,job_id,requisition_id,selected_by)
    values(p_application,p_job,p_requisition,p_actor) on conflict(application_id) do nothing;
  select r.requisition_id into strict target from public.screening_application_routes r
    where r.application_id=p_application and r.job_id=p_job;
  if target<>p_requisition then
    raise exception 'This application already has a destination' using errcode='22023';
  end if;
  return target;
end
$$;

create or replace function public.list_routed_screening_applicants(p_job uuid,p_requisition uuid,p_offset integer)
returns jsonb language sql stable security definer set search_path='' as $$
 with scoped as not materialized (
   select a.*, r.requisition_id as routed_requisition_id
   from public.candidate_applications a
   join public.screening_positions p on p.job_id=a.position_id
   left join public.screening_application_routes r on r.application_id=a.id and r.job_id=p.job_id
   where p.job_id=p_job and (
     r.requisition_id=p_requisition or
     (r.application_id is null and p.requisition_id=p_requisition)
   )
 ), page as (
   select * from scoped order by created_at desc,id offset greatest(p_offset,0) limit 31
 )
 select jsonb_build_object(
   'applications',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id) from page),'[]'),
   'total',(select count(*) from scoped),
   'assessed',(select count(*) from scoped where screening_answers is not null),
   'resumes',(select count(*) from scoped where resume_path is not null)
 )
$$;

-- Existing legacy Returns automation remains independent. This function only claims approved mappings.
create or replace function public.claim_screening_sync(p_limit integer)
returns table(application_id uuid,job_id uuid,requisition_id uuid,lease_id uuid)
language plpgsql security definer set search_path='' as $$
begin
  insert into public.screening_sync_queue as queue(application_id,job_id)
  select a.id,p.job_id from public.screening_positions p
    join public.candidate_applications a on a.position_id=p.job_id
  where p.automation_enabled and p.published_id is not null and not exists (
    select 1 from public.screening_sync_queue q where q.application_id=a.id
  ) order by a.created_at,a.id limit 50
  on conflict on constraint screening_sync_queue_pkey do nothing;

  update public.screening_sync_queue q set state='failed',lease_id=null,error_code='retry'
    where q.state='pending' and q.attempts>=5 and q.available_at<=now();

  return query with ready as (
    select q.application_id from public.screening_sync_queue q
    join public.screening_positions p on p.job_id=q.job_id
    left join public.screening_application_routes r on r.application_id=q.application_id and r.job_id=q.job_id
    where p.automation_enabled and p.published_id is not null and (not p.requires_routing or r.requisition_id is not null) and q.state='pending' and q.available_at<=now()
    order by q.available_at,q.application_id limit greatest(1,least(p_limit,10))
    for update of q skip locked
  ), leased as (
    update public.screening_sync_queue q set lease_id=gen_random_uuid(),attempts=q.attempts+1,available_at=now()+interval '5 minutes'
    from ready r where q.application_id=r.application_id
    returning q.application_id,q.job_id,q.lease_id
  ) select l.application_id,l.job_id,coalesce(r.requisition_id,p.requisition_id),l.lease_id from leased l
    join public.screening_positions p on p.job_id=l.job_id
    left join public.screening_application_routes r on r.application_id=l.application_id and r.job_id=l.job_id;
end
$$;

revoke insert,update on public.screening_positions from service_role;
revoke execute on function public.write_screening_questionnaire(uuid,uuid,jsonb,uuid,boolean) from service_role;
revoke all on function public.write_screening_routing(uuid,uuid,jsonb,uuid,boolean,uuid),
  public.select_screening_application_route(uuid,uuid,uuid,uuid),
  public.list_routed_screening_applicants(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.write_screening_routing(uuid,uuid,jsonb,uuid,boolean,uuid),
  public.select_screening_application_route(uuid,uuid,uuid,uuid),
  public.list_routed_screening_applicants(uuid,uuid,integer) to service_role;
commit;
