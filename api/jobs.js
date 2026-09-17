import { createClient } from "@supabase/supabase-js";

/* global process */

const PUBLIC_FIELDS = [
  "id",
  "title",
  "location",
  "employment_type",
  "department",
  "hours",
  "pay",
  "description",
  "video_url",
  "created_at"
].join(", ");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return res.status(503).json({ error: "Job feed is not configured" });
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase
    .from("job_postings")
    .select(PUBLIC_FIELDS)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Public job feed error:", error);
    return res.status(502).json({ error: "Unable to load jobs" });
  }

  res.setHeader("Access-Control-Allow-Origin", "https://geniusseeker.com");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({
    workspace: { slug: "orion", name: "Orion Wholesale" },
    jobs: data || []
  });
}
