-- Careers only. Preserve public questionnaire behavior and assign exclusive sync ownership.
begin;
alter table public.screening_positions add column sync_owner text not null default 'universal'
  check (sync_owner in ('universal','legacy_returns'));

create function public.enforce_screening_sync_owner() returns trigger
language plpgsql set search_path='' as $$
begin
  if (tg_op='UPDATE' and old.sync_owner='legacy_returns')
    or new.job_id='db38820b-3d0b-4018-a7b1-8012b53ba996'
    or new.public_slug='returns'
    or exists (select 1 from public.job_postings j where j.id=new.job_id
      and lower(j.title) ~ '^[[:space:]]*customer service.*[[:<:]]returns[[:>:]]') then
    new.sync_owner:='legacy_returns';
  end if;
  if new.sync_owner='legacy_returns' then new.automation_enabled:=false; end if;
  if new.sync_owner='universal'
    and 'a822e721-4d9e-439d-83c8-a1a0a41efbe6' in (new.requisition_id,new.alternate_requisition_id) then
    raise exception 'Returns requisition belongs to legacy synchronization' using errcode='22023';
  end if;
  return new;
end
$$;
create trigger enforce_screening_sync_owner before insert or update on public.screening_positions
for each row execute function public.enforce_screening_sync_owner();
update public.screening_positions set sync_owner='universal';
-- Keep original state, attempts, errors and lease tokens for reconciliation. Quarantine
-- makes retained tokens unusable and requires a separately approved cleanup or handoff.
alter table public.screening_sync_queue add column legacy_quarantined_at timestamptz;
update public.screening_sync_queue q set legacy_quarantined_at=now()
where exists (select 1 from public.screening_positions p
  join public.candidate_applications a on a.id=q.application_id
  where p.sync_owner='legacy_returns' and p.job_id in (q.job_id,a.position_id));

create function public.enforce_screening_route_owner() returns trigger
language plpgsql set search_path='' as $$
begin
  if not exists (select 1 from public.screening_positions p
    where p.job_id=new.job_id and p.sync_owner='universal') then
    raise exception 'Application is outside universal routing' using errcode='22023';
  end if;
  return new;
end
$$;
create trigger enforce_screening_route_owner before insert or update on public.screening_application_routes
for each row execute function public.enforce_screening_route_owner();
revoke all on function public.enforce_screening_sync_owner(),public.enforce_screening_route_owner()
  from public,anon,authenticated;

create or replace function public.enqueue_screening_application() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists (select 1 from public.screening_positions where job_id=new.position_id and sync_owner='legacy_returns') then
    update public.screening_sync_queue set legacy_quarantined_at=now()
      where application_id=new.id and legacy_quarantined_at is null;
  elsif exists (select 1 from public.screening_positions where job_id=new.position_id
      and published_id is not null and sync_owner='universal') then
    insert into public.screening_sync_queue(application_id,job_id) values(new.id,new.position_id)
    on conflict(application_id) do update set job_id=excluded.job_id,state='pending',
      attempts=0, available_at=now(),lease_id=null,error_code=null
    where screening_sync_queue.legacy_quarantined_at is null;
  end if;
  return new;
end
$$;
create or replace function public.claim_screening_sync(p_limit integer)
returns table(application_id uuid,job_id uuid,requisition_id uuid,lease_id uuid)
language plpgsql security definer set search_path='' as $$
begin
  insert into public.screening_sync_queue as queue(application_id,job_id)
  select a.id,p.job_id from public.screening_positions p
    join public.candidate_applications a on a.position_id=p.job_id
  where p.sync_owner='universal' and p.automation_enabled and p.published_id is not null and not exists (
    select 1 from public.screening_sync_queue q where q.application_id=a.id
  ) order by a.created_at,a.id limit 50
  on conflict on constraint screening_sync_queue_pkey do nothing;

  update public.screening_sync_queue q set state='failed',lease_id=null,error_code='retry'
    where q.legacy_quarantined_at is null and exists (
      select 1 from public.candidate_applications a join public.screening_positions p on p.job_id=a.position_id
      where a.id=q.application_id and a.position_id=q.job_id and p.sync_owner='universal')
      and q.state='pending' and q.attempts>=5 and q.available_at<=now();

  return query with ready as (
    select q.application_id from public.screening_sync_queue q
    join public.candidate_applications a on a.id=q.application_id and a.position_id=q.job_id
    join public.screening_positions p on p.job_id=q.job_id
    left join public.screening_application_routes r on r.application_id=q.application_id and r.job_id=q.job_id
    where q.legacy_quarantined_at is null and p.sync_owner='universal' and p.automation_enabled and p.published_id is not null and (not p.requires_routing or r.requisition_id is not null) and q.state='pending' and q.available_at<=now()
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

-- A stale worker cannot acknowledge work after ownership changes or quarantine.
create or replace function public.finish_screening_sync(p_application uuid,p_lease uuid,p_result text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_result is null or p_result not in ('synced','identity_review','manual_resume','mapping_changed','retry') then
    raise exception 'Invalid sync result' using errcode='22023';
  end if;
  update public.screening_sync_queue q set
    state=case when p_result in ('synced','identity_review') then p_result
      when p_result='retry' and q.attempts<5 then 'pending' else 'failed' end,
    available_at=now()+interval '5 minutes' * q.attempts,
    lease_id=null,error_code=case when p_result in ('synced','identity_review') then null else p_result end
  where q.application_id=p_application and q.lease_id=p_lease and q.legacy_quarantined_at is null
    and exists (select 1 from public.candidate_applications a
      join public.screening_positions p on p.job_id=a.position_id
      where a.id=q.application_id and a.position_id=q.job_id and p.sync_owner='universal');
end
$$;

commit;
