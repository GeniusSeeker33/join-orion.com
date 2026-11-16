-- Sales-only employee referral program. Payroll recording, never money movement.
create schema referrals;
revoke all on schema referrals from public, anon, authenticated;

create table referrals.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 160),
  email text not null unique check(email=lower(trim(email)) and email like '%@%' and length(email)<=254),
  code text not null unique default ('ORION-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))) check(code ~ '^ORION-[A-Z0-9]{2,24}$'),
  started_on date,
  employment_verified_on date not null default ((now() at time zone 'America/New_York')::date),
  last_employed_on date check(last_employed_on is null or last_employed_on>=started_on),
  sales_eligible boolean not null default true,
  sharing_enabled boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table referrals.eligible_jobs (
  job_id uuid primary key references public.job_postings(id),
  enabled boolean not null default true
);
insert into referrals.eligible_jobs(job_id)
select id from public.job_postings
where lower(trim(department))='sales' and title ~* '^Sales (Executive|Consultant)' and is_active;

create table referrals.claims (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.candidate_applications(id),
  candidate_email text not null unique,
  employee_id uuid not null references referrals.employees(id),
  captured_code text not null,
  job_id uuid not null references public.job_postings(id),
  captured_at timestamptz not null default now(),
  program_version text not null default 'sales-2026-11' check(program_version='sales-2026-11'),
  hired_on date,
  last_employed_on date,
  void_reason text check(void_reason is null or length(trim(void_reason)) between 1 and 2000),
  revision integer not null default 1,
  check(last_employed_on is null or (hired_on is not null and last_employed_on>=hired_on))
);
create index referral_claim_employee on referrals.claims(employee_id);
create index referral_claim_job on referrals.claims(job_id);

create table referrals.milestones (
  claim_id uuid not null references referrals.claims(id),
  milestone text not null check(milestone in ('30_days','6_months','12_months')),
  due_on date not null,
  amount integer not null,
  state text not null default 'pending' check(state in ('pending','approved','paid')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  employee_revision integer,
  claim_revision integer,
  approval_note text,
  paid_by uuid references auth.users(id),
  paid_at timestamptz,
  payroll_reference text,
  primary key(claim_id,milestone),
  check ((milestone in ('30_days','6_months') and amount=250) or (milestone='12_months' and amount=500)),
  check(state='pending' or (approved_by is not null and approved_at is not null and employee_revision is not null and claim_revision is not null)),
  check((state='paid') = (paid_by is not null and paid_at is not null and payroll_reference is not null))
);
create index referral_due_milestones on referrals.milestones(due_on) where state<>'paid';
create table referrals.audit (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  action text not null,
  entity_id uuid not null,
  details jsonb not null,
  occurred_at timestamptz not null default now()
);
create index referral_audit_entity on referrals.audit(entity_id,id);
alter table referrals.employees enable row level security;
alter table referrals.eligible_jobs enable row level security;
alter table referrals.claims enable row level security;
alter table referrals.milestones enable row level security;
alter table referrals.audit enable row level security;
revoke all on all tables in schema referrals from public,anon,authenticated;

create function referrals.today() returns date language sql stable set search_path='' as $$
  select (now() at time zone 'America/New_York')::date
$$;
create function referrals.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u join public.admin_users a on lower(a.email)=lower(u.email)
    where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and a.active=true and a.role='admin')
$$;
create function referrals.require_admin() returns void language plpgsql security definer set search_path='' as $$
begin
  if not referrals.is_admin() then raise exception 'Referral administrator access required' using errcode='42501'; end if;
end $$;
create function referrals.immutable_audit() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Referral audit history is immutable'; end $$;
create trigger referral_audit_immutable before update or delete on referrals.audit
for each row execute function referrals.immutable_audit();

-- Public check deliberately reveals no employee identity or candidate information.
create function public.validate_sales_referral(p_code text,p_job uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from referrals.employees e cross join referrals.eligible_jobs j
    join public.job_postings p on p.id=j.job_id
    where e.code=upper(trim(p_code)) and length(p_code)<=64 and e.sales_eligible and e.sharing_enabled
    and coalesce(e.started_on,e.employment_verified_on)<=referrals.today() and (e.last_employed_on is null or e.last_employed_on>=referrals.today())
    and j.job_id=p_job and j.enabled and p.is_active)
$$;

alter table public.candidate_applications add column employee_referral_code text
check(employee_referral_code is null or length(employee_referral_code)<=64);

create function referrals.capture_application() returns trigger language plpgsql security definer set search_path='' as $$
declare e referrals.employees; new_claim uuid;
begin
  if tg_op='UPDATE' then
    if new.employee_referral_code is distinct from old.employee_referral_code then
      raise exception 'Referral attribution is locked after application submission' using errcode='22023';
    end if;
    return new;
  end if;
  if nullif(trim(new.employee_referral_code),'') is null then return new; end if;
  select * into e from referrals.employees where code=upper(trim(new.employee_referral_code)) for share;
  if not public.validate_sales_referral(new.employee_referral_code,new.position_id) then
    raise exception 'Referral code is unavailable for this position. Check the code or remove it to apply.' using errcode='22023';
  end if;
  if lower(trim(new.email))=e.email then
    raise exception 'Self-referrals do not qualify. Remove the code to apply.' using errcode='22023';
  end if;
  -- One award ledger per normalized applicant email, even for repeated applications.
  -- Concurrent submissions are serialized by the unique constraint.
  insert into referrals.claims(application_id,candidate_email,employee_id,captured_code,job_id)
    values(new.id,lower(trim(new.email)),e.id,e.code,new.position_id)
    on conflict(candidate_email) do nothing returning id into new_claim;
  if new_claim is not null then
    insert into referrals.audit(actor,action,entity_id,details)
      values(null,'application_attributed',new_claim,jsonb_build_object('application_id',new.id,'employee_id',e.id,'code',e.code));
  end if;
  return new;
end $$;
create trigger capture_sales_referral after insert on public.candidate_applications
for each row execute function referrals.capture_application();
create trigger lock_sales_referral before update of employee_referral_code on public.candidate_applications
for each row execute function referrals.capture_application();

create function public.save_sales_referral_employee(p_id uuid,p_revision integer,p_name text,p_email text,
  p_started_on date,p_last_employed_on date,p_sales_eligible boolean,p_sharing_enabled boolean,p_code text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare e referrals.employees; result_id uuid;
begin
  perform referrals.require_admin();
  if p_started_on>referrals.today() then raise exception 'A known start date must be on or before today'; end if;
  if p_id is null then
    insert into referrals.employees(name,email,code,started_on,last_employed_on,sales_eligible,sharing_enabled,updated_by)
    values(trim(p_name),lower(trim(p_email)),coalesce(nullif(upper(trim(p_code)),''),'ORION-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),p_started_on,p_last_employed_on,p_sales_eligible,p_sharing_enabled,auth.uid()) returning id into result_id;
  else
    select * into e from referrals.employees where id=p_id for update;
    if not found or e.revision is distinct from p_revision then raise exception 'Employee changed. Refresh before saving.' using errcode='40001'; end if;
    if p_code is not null and upper(trim(p_code))<>e.code then raise exception 'Referral codes cannot be changed after enrollment'; end if;
    -- Keep a code bound to one employee identity once referrals exist.
    if lower(trim(p_email))<>e.email and exists(select 1 from referrals.claims where employee_id=e.id) then
      raise exception 'Email cannot change after referrals are attributed. Disable sharing and contact an administrator for an identity correction.';
    end if;
    update referrals.employees set name=trim(p_name),email=lower(trim(p_email)),started_on=p_started_on,
      last_employed_on=p_last_employed_on,sales_eligible=p_sales_eligible,sharing_enabled=p_sharing_enabled,
      revision=revision+1,updated_by=auth.uid() where id=e.id returning id into result_id;
  end if;
  insert into referrals.audit(actor,action,entity_id,details) select auth.uid(),'employee_saved',result_id,
    jsonb_build_object('before',to_jsonb(e),'after',to_jsonb(x)) from referrals.employees x where x.id=result_id;
  return result_id;
end $$;

create function public.save_sales_referral_hire(p_claim uuid,p_revision integer,p_hired_on date,
  p_last_employed_on date,p_sales_role_confirmed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare c referrals.claims;
begin
  perform referrals.require_admin();
  select * into c from referrals.claims where id=p_claim for update;
  if not found or c.revision is distinct from p_revision then raise exception 'Referral changed. Refresh before saving.' using errcode='40001'; end if;
  if c.void_reason is not null then raise exception 'This referral is disqualified'; end if;
  if p_sales_role_confirmed is distinct from true or p_hired_on is null or p_hired_on>referrals.today()
     or p_hired_on<(c.captured_at at time zone 'America/New_York')::date then
    raise exception 'Confirm the Sales Consultant hire and a start date between application and today';
  end if;
  if not exists(select 1 from public.candidate_applications where id=c.application_id and status='hired') then
    raise exception 'Mark this candidate Hired in Recruiting before recording the start date';
  end if;
  if c.hired_on is distinct from p_hired_on and exists(select 1 from referrals.milestones where claim_id=c.id and state<>'pending') then
    raise exception 'Hire date is locked after milestone approval';
  end if;
  update referrals.claims set hired_on=p_hired_on,last_employed_on=p_last_employed_on,revision=revision+1 where id=c.id;
  if c.hired_on is distinct from p_hired_on then
    delete from referrals.milestones where claim_id=c.id and state='pending';
    insert into referrals.milestones(claim_id,milestone,due_on,amount) values
      (c.id,'30_days',p_hired_on+30,250),
      (c.id,'6_months',(p_hired_on+interval '6 months')::date,250),
      (c.id,'12_months',(p_hired_on+interval '12 months')::date,500);
  end if;
  insert into referrals.audit(actor,action,entity_id,details) values(auth.uid(),'employment_verified',c.id,
    jsonb_build_object('before',to_jsonb(c),'hired_on',p_hired_on,'last_employed_on',p_last_employed_on,'sales_role_confirmed',true));
end $$;

create function referrals.eligibility(c referrals.claims,e referrals.employees,m referrals.milestones) returns text
language sql stable set search_path='' as $$
 select case
   when c.void_reason is not null then 'Disqualified'
   when c.hired_on is null then 'Hire not recorded'
   when m.due_on>referrals.today() then 'Not due'
   when not e.sales_eligible then 'Referrer is not eligible for the Sales program'
   when coalesce(e.started_on,e.employment_verified_on)>m.due_on or (e.last_employed_on is not null and e.last_employed_on<referrals.today()) then 'Referrer is no longer employed'
   when c.last_employed_on is not null and c.last_employed_on<referrals.today() then 'New consultant is no longer employed'
   when m.state='approved' and (m.employee_revision<>e.revision or m.claim_revision<>c.revision) then 'Employment changed; verify again'
   else 'Ready for verification' end
$$;

create function public.review_sales_referral_milestone(p_claim uuid,p_milestone text,p_action text,
  p_both_employed boolean,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare c referrals.claims; e referrals.employees; m referrals.milestones; reason text;
begin
  perform referrals.require_admin();
  select * into c from referrals.claims where id=p_claim for update;
  if not found then raise exception 'Referral unavailable'; end if;
  select * into e from referrals.employees where id=c.employee_id for share;
  select * into m from referrals.milestones where claim_id=c.id and milestone=p_milestone for update;
  if not found then raise exception 'Milestone unavailable'; end if;
  if m.state='paid' then raise exception 'Payment already recorded'; end if;
  if p_action is null or p_action not in ('approve','paid') or p_both_employed is distinct from true or nullif(trim(p_note),'') is null or length(p_note)>2000 then
    raise exception 'Confirm both employees are still employed and provide a verification note or payroll reference';
  end if;
  reason:=referrals.eligibility(c,e,m);
  if reason<>'Ready for verification' and not(p_action='approve' and reason='Employment changed; verify again') then
    raise exception '%',reason;
  end if;
  if p_action='approve' then
    update referrals.milestones set state='approved',approved_by=auth.uid(),approved_at=now(),employee_revision=e.revision,
      claim_revision=c.revision,approval_note=trim(p_note) where claim_id=c.id and milestone=p_milestone;
  else
    if m.state<>'approved' then raise exception 'Verify and approve this milestone before recording payroll'; end if;
    update referrals.milestones set state='paid',paid_by=auth.uid(),paid_at=now(),payroll_reference=trim(p_note)
      where claim_id=c.id and milestone=p_milestone;
  end if;
  insert into referrals.audit(actor,action,entity_id,details) values(auth.uid(),p_action,c.id,
    jsonb_build_object('milestone',p_milestone,'amount',m.amount,'due_on',m.due_on,'both_employed',true,'note',trim(p_note),
      'employee_revision',e.revision,'claim_revision',c.revision));
end $$;

create function public.disqualify_sales_referral(p_claim uuid,p_revision integer,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare c referrals.claims;
begin
  perform referrals.require_admin();
  select * into c from referrals.claims where id=p_claim for update;
  if not found or c.revision is distinct from p_revision then raise exception 'Referral changed. Refresh before saving.' using errcode='40001'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reason is required'; end if;
  update referrals.claims set void_reason=trim(p_reason),revision=revision+1 where id=c.id;
  insert into referrals.audit(actor,action,entity_id,details) values(auth.uid(),'disqualified',c.id,jsonb_build_object('reason',trim(p_reason)));
end $$;

create function public.read_sales_referral_admin() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform referrals.require_admin();
  return jsonb_build_object(
    'today',referrals.today(),
    'employees',coalesce((select jsonb_agg(to_jsonb(e) order by e.name) from referrals.employees e),'[]'::jsonb),
    'claims',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('candidate_name',a.first_name||' '||a.last_name,
      'candidate_status',a.status,'position_title',a.position_title,'employee_name',e.name) order by c.captured_at desc)
      from referrals.claims c join public.candidate_applications a on a.id=c.application_id join referrals.employees e on e.id=c.employee_id),'[]'::jsonb),
    'milestones',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('eligibility',referrals.eligibility(c,e,m)) order by m.due_on)
      from referrals.milestones m join referrals.claims c on c.id=m.claim_id join referrals.employees e on e.id=c.employee_id),'[]'::jsonb),
    'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title)) from referrals.eligible_jobs j join public.job_postings p on p.id=j.job_id where j.enabled and p.is_active),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from (select * from referrals.audit order by id desc limit 200) a),'[]'::jsonb)
  );
end $$;

create function public.read_my_sales_referral() returns jsonb
language plpgsql security definer set search_path='' as $$
declare e referrals.employees;
begin
  select x.* into e from referrals.employees x join auth.users u on lower(u.email)=x.email
  where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and x.sales_eligible and x.sharing_enabled and coalesce(x.started_on,x.employment_verified_on)<=referrals.today()
    and (x.last_employed_on is null or x.last_employed_on>=referrals.today());
  if not found then raise exception 'Your account is not enrolled in the Sales referral program. Contact your administrator.' using errcode='42501'; end if;
  return jsonb_build_object('employee',jsonb_build_object('name',e.name,'code',e.code),
    'application_count',(select count(*) from referrals.claims where employee_id=e.id),
    'hired_count',(select count(*) from referrals.claims where employee_id=e.id and hired_on is not null and void_reason is null),
    'paid_total',(select coalesce(sum(m.amount),0) from referrals.milestones m join referrals.claims c on c.id=m.claim_id where c.employee_id=e.id and m.state='paid'));
end $$;

revoke all on all functions in schema referrals from public,anon,authenticated;
revoke all on function public.validate_sales_referral(text,uuid),public.read_my_sales_referral(),public.read_sales_referral_admin(),
 public.save_sales_referral_employee(uuid,integer,text,text,date,date,boolean,boolean,text),public.save_sales_referral_hire(uuid,integer,date,date,boolean),
 public.review_sales_referral_milestone(uuid,text,text,boolean,text),public.disqualify_sales_referral(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.validate_sales_referral(text,uuid) to anon,authenticated;
grant execute on function public.read_my_sales_referral(),public.read_sales_referral_admin(),
 public.save_sales_referral_employee(uuid,integer,text,text,date,date,boolean,boolean,text),public.save_sales_referral_hire(uuid,integer,date,date,boolean),
 public.review_sales_referral_milestone(uuid,text,text,boolean,text),public.disqualify_sales_referral(uuid,integer,text) to authenticated;
