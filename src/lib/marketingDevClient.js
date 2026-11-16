import { createClient } from "@supabase/supabase-js";

// Dedicated development project. Never substitute the live Join-Orion client here.
// Vite supplies import.meta.env in browser builds; Node.js test runs do not.
const env = import.meta.env;
const url = env?.VITE_MARKETING_DEV_SUPABASE_URL;
const key = env?.VITE_MARKETING_DEV_SUPABASE_PUBLISHABLE_KEY;
export const marketingDevClient = url && key ? createClient(url,key,{
  auth: { persistSession:true,autoRefreshToken:true,storageKey:"join-orion-marketing-dev-auth" }
}) : null;
export async function marketingDevSignIn(email,password) {
  if (!marketingDevClient) return {error:"Marketing development connection not configured."};
  const {error}=await marketingDevClient.auth.signInWithPassword({email:email.trim(),password});
  return {error:error?.message||null};
}
export async function marketingDevSignOut() {
  await marketingDevClient?.auth.signOut({scope:"local"});
}
