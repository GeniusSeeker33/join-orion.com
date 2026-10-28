-- Restore missing admin users table for fresh database environments.
-- Existing admin access policy is created by the following migration.

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  email text NOT NULL UNIQUE,
  role text DEFAULT 'admin',
  active boolean DEFAULT true
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
