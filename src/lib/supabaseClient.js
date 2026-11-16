import { createClient } from "@supabase/supabase-js";

// Vite provides import.meta.env in browser bundles; Node test runners do not.
// Do not initialize a client when configuration is absent.
const env = import.meta.env;
const supabaseUrl = env?.VITE_SUPABASE_URL;
const supabaseKey = env?.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;
