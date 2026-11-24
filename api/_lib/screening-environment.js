const operationalProjects = new Set(["ykftchggpdkmkpkbdbgs", "ofmqhrcmdrdrnvtnykyq"]);

export const labCareersUrl = "http://127.0.0.1:56321";
export const labAtsUrl = "http://127.0.0.1:57321";
export const labInferenceUrl = "http://127.0.0.1:5588/v1";
export const labInferenceKey = "local-fixture-only";

export function screeningIsolationError(env, scheduled = false) {
  const careers = env.VITE_SUPABASE_URL;
  const ats = env.VITE_MARKETING_DEV_SUPABASE_URL;
  if (env.ATS_SCREENING_LOCAL_MODE === "true") {
    if (scheduled || env.ATS_SCREENING_CRON_ENABLED === "true" || env.VERCEL || env.VERCEL_ENV ||
      careers !== labCareersUrl || ats !== labAtsUrl ||
      !/^[a-f0-9]{32}$/.test(env.ATS_SCREENING_LAB_RUN ?? "") ||
      (env.OPENAI_API_KEY && (env.OPENAI_API_KEY !== labInferenceKey || env.OPENAI_BASE_URL !== labInferenceUrl))) {
      return "Local screening requires isolated loopback projects, a lab run ID and local inference.";
    }
    return null;
  }
  if (env.ATS_SCREENING_LAB_RUN) return "A lab run ID requires explicit local screening mode.";
  if (!scheduled && env.VERCEL_ENV !== "preview" && !(env.VERCEL && env.VERCEL_ENV !== "production")) return null;
  const approved = (url, ref) => /^[a-z0-9]{20}$/.test(ref ?? "") && !operationalProjects.has(ref)
    && url?.replace(/\/$/, "") === `https://${ref}.supabase.co`;
  const careersRef = env.ATS_SCREENING_STAGING_CAREERS_REF;
  const atsRef = env.ATS_SCREENING_STAGING_ATS_REF;
  if (careersRef === atsRef || !approved(careers, careersRef) || !approved(ats, atsRef)) {
    return "Preview requires two verified isolated staging Supabase projects.";
  }
  return null;
}

export async function screeningLabIdentityError(env) {
  if (env.ATS_SCREENING_LOCAL_MODE !== "true") return null;
  const failure = "The local databases are not the expected synthetic screening lab.";
  const scopes = [
    ["careers", labCareersUrl, env.SUPABASE_SERVICE_ROLE_KEY],
    ["ats", labAtsUrl, env.ATS_SCREENING_SERVICE_ROLE_KEY]
  ];
  if (scopes.some(([, , key]) => !key)) return failure;
  try {
    const matches = await Promise.all(scopes.map(async ([realm, url, key]) => {
      const reply = await fetch(url + "/rest/v1/rpc/screening_lab_identity", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
        headers: { apikey: key, authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: "{}"
      });
      if (!reply.ok) return false;
      const identity = await reply.json();
      return identity?.realm === realm && identity?.run === env.ATS_SCREENING_LAB_RUN;
    }));
    return matches.every(Boolean) ? null : failure;
  } catch {
    return failure;
  }
}
