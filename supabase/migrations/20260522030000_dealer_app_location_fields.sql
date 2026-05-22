alter table public.dealer_applications
  add column if not exists location_type text,
  add column if not exists multiple_locations boolean;
