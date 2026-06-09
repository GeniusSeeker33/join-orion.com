drop policy if exists "Anon can submit candidate application" on public.candidate_applications;
create policy "public insert candidate applications"
  on public.candidate_applications
  for insert
  to public
  with check (true);

drop policy if exists "Anon can attach resume path" on public.candidate_applications;
create policy "public update candidate resume path"
  on public.candidate_applications
  for update
  to public
  using (true)
  with check (true);

drop policy if exists "Anon can upload resumes" on storage.objects;
create policy "public upload resumes"
  on storage.objects
  for insert
  to public
  with check (bucket_id = 'resumes');
