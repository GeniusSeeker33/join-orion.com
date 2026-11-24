-- ATS project only, after the Phase 2 overlay. Install only with owner approval.
begin;
create table public.ats_screening_rubrics (
  requisition_id uuid not null references ats_dev.requisitions(id),
  version integer not null check (version >= 2),
  categories jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (requisition_id,version)
);
alter table public.ats_screening_rubrics enable row level security;
revoke all on public.ats_screening_rubrics from public,anon,authenticated,service_role;
grant select on public.ats_screening_rubrics to service_role;

create function public.ats_screening_publish_rubric(p_requisition uuid,p_actor uuid,p_version integer,p_categories jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare latest integer;
begin
  if not exists (select 1 from ats_dev.memberships where user_id=p_actor
    and is_active and role='recruiter_admin') or public.ats_screening_legacy_returns(null,p_requisition) then
    raise insufficient_privilege;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_requisition::text,19));
  select coalesce(max(version),1) into latest from public.ats_screening_rubrics where requisition_id=p_requisition;
  if latest<>p_version then raise serialization_failure; end if;
  if jsonb_typeof(p_categories) is distinct from 'array' or jsonb_array_length(p_categories) not between 2 and 12
    or (select count(distinct item->>'id') from jsonb_array_elements(p_categories) item) <> jsonb_array_length(p_categories)
    or exists(select 1 from jsonb_array_elements(p_categories) item where coalesce(item->>'id','') !~ '^[a-z][a-z0-9_]{0,39}$'
      or length(trim(coalesce(item->>'label',''))) not between 4 and 160
      or (item->>'label') ~* '\m(age|race|ethnicity|religion|national origin|citizenship|immigration status|pregnan[a-z]*|disabilit[a-z]*|gender|sexual orientation|date of birth|marital status|medical condition)\M'
      or jsonb_typeof(item->'weight') is distinct from 'number'
      or coalesce(item->>'weight','') !~ '^[1-9][0-9]{0,2}$')
    or (select sum((item->>'weight')::integer) from jsonb_array_elements(p_categories) item) <> 100 then
    raise invalid_parameter_value;
  end if;
  insert into public.ats_screening_rubrics values(p_requisition,latest+1,p_categories,p_actor,now());
end
$$;
revoke all on function public.ats_screening_publish_rubric(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.ats_screening_publish_rubric(uuid,uuid,integer,jsonb) to service_role;
-- Refresh retains the previous draft while a new one is generated.
create function public.ats_screening_refresh_evidence(p_application uuid,p_fingerprint text)
returns uuid language sql security definer set search_path='' as $$
  update public.ats_screening_evidence set lease_id=gen_random_uuid(),leased_at=now()
  where application_id=p_application and fingerprint=p_fingerprint and draft is not null
    and leased_at < now()-interval '5 minutes'
  returning lease_id
$$;
revoke all on function public.ats_screening_refresh_evidence(uuid,text) from public,anon,authenticated;
grant execute on function public.ats_screening_refresh_evidence(uuid,text) to service_role;
commit;
