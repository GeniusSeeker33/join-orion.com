create policy "Authenticated users can read own admin row"
  on public.admin_users
  for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
