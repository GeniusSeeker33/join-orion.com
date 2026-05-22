drop policy if exists "anon insert" on public.dealer_applications;

create policy "public insert dealer applications"
  on public.dealer_applications
  for insert
  to public
  with check (true);
