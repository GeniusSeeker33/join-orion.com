import { marketingDevClient } from "../../lib/marketingDevClient";

export async function screeningRequest(action, payload = {}) {
  const { data } = await marketingDevClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in to the ATS again.");
  const response = await fetch("/api/ats-screening", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.error || "The screening service is unavailable.");
  }
  return result;
}
