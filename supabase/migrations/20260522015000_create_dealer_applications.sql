-- Restore missing dealer applications table setup for fresh databases.
-- Later migrations add location fields, relax constraints, and set insert policy.

CREATE TABLE IF NOT EXISTS public.dealer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  business_name text NOT NULL,
  ffl_number text NOT NULL,
  business_email text NOT NULL,
  phone_number text NOT NULL,
  street_address text,
  city text,
  state text,
  zip_code text,
  business_type text,
  referral_source text,
  certified_ffl boolean DEFAULT false,
  status text DEFAULT 'new',
  assigned_rep text,
  admin_notes text,
  ffl_verified boolean DEFAULT false,
  ffl_expiration_date date,
  ffl_premise_address text,
  ffl_validation_status text DEFAULT 'not_checked',
  ffl_validation_notes text,
  source_page text DEFAULT 'join-orion.com',
  utm_source text,
  utm_medium text,
  utm_campaign text
);

ALTER TABLE public.dealer_applications ENABLE ROW LEVEL SECURITY;
