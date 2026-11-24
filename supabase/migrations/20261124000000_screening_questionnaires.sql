begin;

create table public.screening_positions (
  job_id uuid primary key references public.job_postings(id),
  requisition_id uuid unique not null,
  draft jsonb,
  published_id uuid,
  updated_by uuid not null
);

create table public.screening_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.screening_positions(job_id),
  version integer not null,
  questions jsonb not null,
  published_by uuid not null,
  published_at timestamptz not null default now(),
  unique (job_id, version),
  unique (job_id, id)
);

alter table public.screening_positions add foreign key (job_id, published_id)
  references public.screening_versions(job_id,id);
alter table public.screening_positions enable row level security;
alter table public.screening_versions enable row level security;
revoke all on public.screening_positions,public.screening_versions from public,anon,authenticated;
grant select,insert,update on public.screening_positions to service_role;
grant select,insert on public.screening_versions to service_role;

alter table public.candidate_applications
  add column if not exists screening_answers jsonb,
  add column screening_version_id uuid references public.screening_versions(id);

-- The public reader projects only the currently published questions and active posting.
create function public.read_screening_questionnaire(p_job uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',v.id,'job_id',j.id,'title',j.title,
    'version',v.version,'questions',v.questions)
  from public.job_postings j
  join public.screening_positions p on p.job_id=j.id
  join public.screening_versions v on v.id=p.published_id
  where j.is_active and (j.id=p_job or (p_job is null and
    j.title='Customer Service & Returns Specialist — Compliance Support'))
  order by j.created_at desc, j.id limit 1
$$;

create function public.write_screening_questionnaire(
  p_job uuid,p_requisition uuid,p_questions jsonb,p_actor uuid,p_publish boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_position public.screening_positions; next_id uuid; next_version integer;
begin
  if jsonb_typeof(p_questions) is distinct from 'array'
    or jsonb_array_length(p_questions) not between 1 and 30 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_questions) q
    where jsonb_typeof(q) <> 'object' or coalesce(q->>'id','') !~ '^[a-z][a-z0-9_]{0,39}$'
    or length(trim(coalesce(q->>'prompt',''))) not between 5 and 600)
    or (select count(distinct q->>'id') from jsonb_array_elements(p_questions) q)
      <> jsonb_array_length(p_questions) then
    raise exception 'Invalid question IDs or prompts' using errcode='22023';
  end if;
  insert into public.screening_positions(job_id,requisition_id,draft,updated_by)
    values(p_job,p_requisition,p_questions,p_actor)
    on conflict(job_id) do nothing;
  select * into strict current_position from public.screening_positions where job_id=p_job for update;
  if current_position.requisition_id<>p_requisition then
    raise exception 'This posting is already linked to another requisition' using errcode='22023';
  end if;
  if p_publish then
    if not exists (select 1 from public.job_postings where id=p_job and is_active) then
      raise exception 'Activate this posting before publishing' using errcode='22023';
    end if;
    select id into next_id from public.screening_versions
      where id=current_position.published_id and questions=p_questions;
    if next_id is null then
      select coalesce(max(version),0)+1 into next_version from public.screening_versions where job_id=p_job;
      insert into public.screening_versions(job_id,version,questions,published_by)
        values(p_job,next_version,p_questions,p_actor) returning id into next_id;
    end if;
  end if;
  update public.screening_positions set draft=p_questions,updated_by=p_actor,
    published_id=coalesce(next_id,published_id) where job_id=p_job returning * into current_position;
  return to_jsonb(current_position);
end
$$;

create function public.validate_screening_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare questions jsonb; job_title text;
begin
  if tg_op='UPDATE' then
    if new.screening_version_id is distinct from old.screening_version_id
      or new.screening_answers is distinct from old.screening_answers
      or (old.screening_version_id is not null and new.position_id is distinct from old.position_id) then
      raise exception 'Submitted screening responses are immutable' using errcode='22023';
    end if;
    return new;
  end if;
  if new.screening_version_id is null then
    if new.screening_answers is not null then
      raise exception 'A questionnaire version is required' using errcode='22023';
    end if;
    return new;
  end if;
  select v.questions,j.title into questions,job_title
  from public.screening_versions v
  join public.screening_positions p on p.published_id=v.id
  join public.job_postings j on j.id=v.job_id and j.is_active
  where v.id=new.screening_version_id and v.job_id=new.position_id for share of p;
  if not found then
    raise exception 'The questionnaire changed. Reload the application to continue.' using errcode='22023';
  end if;
  if jsonb_typeof(new.screening_answers) is distinct from 'object' then
    raise exception 'Complete the screening questions' using errcode='22023';
  end if;
  if (select count(*) from jsonb_object_keys(new.screening_answers))<>jsonb_array_length(questions)
    or exists (select 1 from jsonb_array_elements(questions) q
      where jsonb_typeof(new.screening_answers->(q->>'id')) is distinct from 'string'
      or length(trim(new.screening_answers->>(q->>'id'))) not between 1 and 3000) then
    raise exception 'Complete each screening question in 3,000 characters or fewer' using errcode='22023';
  end if;
  if new.resume_path is not null and split_part(new.resume_path,'/',1)<>new.id::text then
    raise exception 'Invalid resume path' using errcode='22023';
  end if;
  new.position_title=job_title;
  return new;
end
$$;

create trigger validate_screening_application
before insert or update on public.candidate_applications
for each row execute function public.validate_screening_application();

revoke all on function public.read_screening_questionnaire(uuid),
  public.write_screening_questionnaire(uuid,uuid,jsonb,uuid,boolean),
  public.validate_screening_application() from public,anon,authenticated;
grant execute on function public.read_screening_questionnaire(uuid) to anon,authenticated;
grant execute on function public.write_screening_questionnaire(uuid,uuid,jsonb,uuid,boolean) to service_role;
commit;
