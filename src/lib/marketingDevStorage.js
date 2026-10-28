import { supabase } from "./lib/supabaseClient";

/** Development-only adapter. Requires the migration in docs/marketing-dev-storage.sql.
 * Never silently fall back to local storage after a failed remote write.
 */
export async function readMarketingDrafts() {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) throw new Error("Sign in before loading marketing drafts.");
  const [campaigns, assets] = await Promise.all([
    supabase.from("marketing_dev_campaigns").select("*").order("updated_at",{ascending:false}),
    supabase.from("marketing_dev_assets").select("*").order("updated_at",{ascending:false})
  ]);
  if (campaigns.error) throw new Error(campaigns.error.message);
  if (assets.error) throw new Error(assets.error.message);
  return { campaigns: campaigns.data || [], assets: assets.data || [] };
}
export async function saveMarketingDraft(table, draft) {
  if (!["marketing_dev_campaigns","marketing_dev_assets"].includes(table)) throw new Error("Unknown marketing record type.");
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) throw new Error("Sign in before saving marketing drafts.");
  const payload = { ...draft, owner_user_id: userData.user.id, status:"draft" };
  delete payload.created_at; delete payload.updated_at;
  const { data,error } = await supabase.from(table).upsert(payload,{onConflict:"id"}).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
