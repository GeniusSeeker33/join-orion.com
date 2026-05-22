alter table public.dealer_applications
  alter column last_name drop not null,
  alter column ffl_number drop not null;
