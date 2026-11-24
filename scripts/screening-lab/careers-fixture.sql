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

-- Model the reviewed operational resume boundary in disposable Careers only.
update storage.buckets set file_size_limit=10485760,allowed_mime_types=
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id='resumes';
create function public.screening_fixture_is_careers_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.admin_users a
    where lower(a.email)=lower(auth.jwt()->>'email') and a.active and a.role='admin')
$$;
revoke all on function public.screening_fixture_is_careers_admin() from public,anon,authenticated;
grant execute on function public.screening_fixture_is_careers_admin() to authenticated;
create policy fixture_careers_resume_read on storage.objects for select to authenticated
using (bucket_id='resumes' and public.screening_fixture_is_careers_admin());
