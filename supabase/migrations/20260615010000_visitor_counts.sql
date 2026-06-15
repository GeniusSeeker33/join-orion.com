-- Per-page visitor counter.
--
-- A small counts table plus a SECURITY DEFINER RPC that atomically increments
-- and returns the new total. The RPC returns the count directly, so the public
-- (anon) client never needs SELECT access on the table — RLS stays fully
-- locked and direct reads/writes are denied.

create table if not exists public.visitor_counts (
  page text primary key,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.visitor_counts enable row level security;

-- Seed the pages we currently track.
insert into public.visitor_counts (page)
values ('home'), ('careers')
on conflict (page) do nothing;

create or replace function public.bump_visitor_count(page_key text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  insert into public.visitor_counts (page, count, updated_at)
    values (page_key, 1, now())
  on conflict (page)
    do update set count = visitor_counts.count + 1, updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

grant execute on function public.bump_visitor_count(text) to anon, authenticated;
