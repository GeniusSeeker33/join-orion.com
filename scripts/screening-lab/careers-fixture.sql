-- Synthetic local baseline additions after the Careers base migration.
delete from public.job_postings;
drop policy "Anon can attach resume path" on public.candidate_applications;
revoke all on public.candidate_applications from anon,authenticated;
grant insert on public.candidate_applications to anon;
grant select on public.job_postings to anon,authenticated;
grant select,insert,update on public.candidate_applications to service_role;
grant select,insert,update on public.job_postings to service_role;
alter table public.job_postings add column hours text, add column pay text, add column video_url text;
alter table public.candidate_applications add column source text not null default 'direct_or_unknown';
create table public.admin_users (email text primary key, active boolean not null, role text not null);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon,authenticated;
grant insert on public.admin_users to service_role;
