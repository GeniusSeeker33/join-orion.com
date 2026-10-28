-- Development-only marketing storage proposal. Apply to a dedicated development
-- Supabase project, NOT the live join-orion.com database.
-- Ownership is per authenticated user; approval and publication are deliberately
-- not exposed through this initial schema.
create table if not exists public.marketing_dev_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '',
  objectives text not null default '',
  target_audiences text not null default '',
  channels text not null default '',
  primary_cta text not null default '',
  budget_amount numeric(12,2) check (budget_amount >= 0),
  starts_on date,
  ends_on date,
  status text not null default 'draft' check (status = 'draft'),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_dev_campaign_date_order check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint marketing_dev_campaign_owner_id_unique unique (id,owner_user_id)
);
create table if not exists public.marketing_dev_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid,
  title text not null check (char_length(title) between 1 and 160),
  type text not null check (type in ('Facebook post','LinkedIn post','Recruiting email','Ad copy','Landing page copy')),
  headline text not null default '',
  body text not null check (char_length(body) between 1 and 12000),
  cta text not null default '',
  notes text not null default '',
  status text not null default 'draft' check (status = 'draft'),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id,owner_user_id) references public.marketing_dev_campaigns(id,owner_user_id) on delete set null (campaign_id)
);
alter table public.marketing_dev_campaigns enable row level security;
alter table public.marketing_dev_assets enable row level security;
revoke all on public.marketing_dev_campaigns, public.marketing_dev_assets from anon;
grant select,insert,update,delete on public.marketing_dev_campaigns, public.marketing_dev_assets to authenticated;
create policy marketing_dev_campaign_select on public.marketing_dev_campaigns for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy marketing_dev_campaign_insert on public.marketing_dev_campaigns for insert to authenticated with check ((select auth.uid()) = owner_user_id and status = 'draft');
create policy marketing_dev_campaign_update on public.marketing_dev_campaigns for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id and status = 'draft');
create policy marketing_dev_campaign_delete on public.marketing_dev_campaigns for delete to authenticated using ((select auth.uid()) = owner_user_id);
create policy marketing_dev_asset_select on public.marketing_dev_assets for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy marketing_dev_asset_insert on public.marketing_dev_assets for insert to authenticated with check ((select auth.uid()) = owner_user_id and status = 'draft');
create policy marketing_dev_asset_update on public.marketing_dev_assets for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id and status = 'draft');
create policy marketing_dev_asset_delete on public.marketing_dev_assets for delete to authenticated using ((select auth.uid()) = owner_user_id);
-- Do not add approval, activation, publication, or AI execution permissions here.
