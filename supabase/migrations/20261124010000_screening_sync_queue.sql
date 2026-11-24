-- Careers project only. Installing this queue does not start a scheduled job.
begin;

create table if not exists public.screening_sync_queue (
  application_id uuid primary key references public.candidate_applications(id) on delete cascade,
  job_id uuid not null references public.screening_positions(job_id),
  state text not null default 'pending' check (state in ('pending','synced','identity_review','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  error_code text
);
create index if not exists screening_sync_pending on public.screening_sync_queue(available_at,application_id) where state='pending';
create index if not exists screening_sync_by_position on public.screening_sync_queue(job_id,state);
create index if not exists screening_applications_position_order on public.candidate_applications(position_id,created_at,id);
alter table public.screening_sync_queue enable row level security;
revoke all on public.screening_sync_queue from public,anon,authenticated;
grant select on public.screening_sync_queue to service_role;

create or replace function public.enqueue_screening_application() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists (select 1 from public.screening_positions where job_id=new.position_id and published_id is not null) then
    insert into public.screening_sync_queue(application_id,job_id) values(new.id,new.position_id)
    on conflict(application_id) do update set job_id=excluded.job_id,state='pending',
      attempts=0, available_at=now(),lease_id=null,error_code=null;
  elsif tg_op='UPDATE' then
    delete from public.screening_sync_queue where application_id=new.id;
  end if;
  return new;
end
$$;
drop trigger if exists enqueue_screening_insert on public.candidate_applications;
create trigger enqueue_screening_insert after insert on public.candidate_applications
for each row execute function public.enqueue_screening_application();
drop trigger if exists enqueue_screening_change on public.candidate_applications;
create trigger enqueue_screening_change after update on public.candidate_applications
for each row when (
  old.position_id is distinct from new.position_id or old.screening_answers is distinct from new.screening_answers or
  old.resume_path is distinct from new.resume_path or
  (to_jsonb(old)->'interview_status',to_jsonb(old)->'interview_at',to_jsonb(old)->'interview_teams_url',to_jsonb(old)->'interview_notes')
    is distinct from
  (to_jsonb(new)->'interview_status',to_jsonb(new)->'interview_at',to_jsonb(new)->'interview_teams_url',to_jsonb(new)->'interview_notes')
)
execute function public.enqueue_screening_application();

-- Backfill one bounded chunk of historical submissions per scheduler invocation.
create or replace function public.claim_screening_sync(p_limit integer)
returns table(application_id uuid,job_id uuid,requisition_id uuid,lease_id uuid)
language plpgsql security definer set search_path='' as $$
begin
  insert into public.screening_sync_queue as queue(application_id,job_id)
  select a.id,p.job_id from public.screening_positions p
    join public.candidate_applications a on a.position_id=p.job_id
  where p.published_id is not null and not exists (
    select 1 from public.screening_sync_queue q where q.application_id=a.id
  ) order by a.created_at,a.id limit 50
  on conflict on constraint screening_sync_queue_pkey do nothing;

  update public.screening_sync_queue q set state='failed',lease_id=null,error_code='retry'
    where q.state='pending' and q.attempts>=5 and q.available_at<=now();

  return query with ready as (
    select q.application_id from public.screening_sync_queue q
    join public.screening_positions p on p.job_id=q.job_id
    where p.published_id is not null and q.state='pending' and q.available_at<=now()
    order by q.available_at,q.application_id limit greatest(1,least(p_limit,10))
    for update of q skip locked
  ), leased as (
    update public.screening_sync_queue q set lease_id=gen_random_uuid(),attempts=q.attempts+1,available_at=now()+interval '5 minutes'
    from ready r where q.application_id=r.application_id
    returning q.application_id,q.job_id,q.lease_id
  ) select l.application_id,l.job_id,p.requisition_id,l.lease_id from leased l
    join public.screening_positions p on p.job_id=l.job_id;
end
$$;

create or replace function public.finish_screening_sync(p_application uuid,p_lease uuid,p_result text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_result is null or p_result not in ('synced','identity_review','manual_resume','mapping_changed','retry') then
    raise exception 'Invalid sync result' using errcode='22023';
  end if;
  update public.screening_sync_queue set
    state=case when p_result in ('synced','identity_review') then p_result
      when p_result='retry' and attempts<5 then 'pending' else 'failed' end,
    available_at=now()+interval '5 minutes' * attempts,
    lease_id=null,error_code=case when p_result in ('synced','identity_review') then null else p_result end
  where application_id=p_application and lease_id=p_lease;
end
$$;

revoke all on function public.enqueue_screening_application(), public.claim_screening_sync(integer),
  public.finish_screening_sync(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_screening_sync(integer),
  public.finish_screening_sync(uuid,uuid,text) to service_role;
commit;
