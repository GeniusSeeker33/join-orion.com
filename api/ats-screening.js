import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isSplitPosting, isWarehouseSplitPair } from "../src/components/screening/routing.js";
import { evidenceFingerprint, extractResumeText, generateEvidence, hash } from "./_lib/screening-evidence.js";

const id = z.uuid();
const applicationRequest = { applicationId: id, requisitionId: id };
const questions = z.array(z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  prompt: z.string().trim().min(5).max(600)
})).min(1).max(30).refine(items => new Set(items.map(item => item.id)).size === items.length);
const review = z.object({
  notes: z.string().max(5000),
  decision: z.enum(["pending", "contact", "interview", "hold", "closed"]),
  interview_at: z.iso.datetime().nullable(),
  meeting_url: z.url({ protocol: /^https$/ }).max(1000).nullable(),
  approved_evidence: z.string().trim().max(10000),
  completed: z.boolean()
});
const request = z.discriminatedUnion("action", [
  z.object({ action: z.literal("postings") }),
  z.object({ action: z.literal("configuration"), requisitionId: id }),
  z.object({ action: z.literal("questionnaire"), requisitionId: id, jobId: id, alternateRequisitionId: id.optional(), questions, publish: z.boolean() }),
  z.object({ action: z.literal("applicants"), requisitionId: id, offset: z.number().int().nonnegative().max(100000).default(0) }),
  z.object({ action: z.literal("candidateScreening"), candidateId: id }),
  z.object({ action: z.literal("sync"), ...applicationRequest, candidateId: id.optional() }),
  z.object({ action: z.literal("route"), ...applicationRequest, destinationId: id }),
  z.object({ action: z.literal("resume"), ...applicationRequest }),
  z.object({ action: z.literal("draft"), ...applicationRequest, generate: z.boolean().default(false) }),
  z.object({ action: z.literal("review"), ...applicationRequest, revision: z.number().int().nonnegative(), review, advancePipeline: z.boolean().default(false) })
]);

const resumeTypes = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};
const bucket = "ats-screening-resumes";
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const pageSize = 30;

class ScreeningError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function query(operation) {
  const { data, error } = await operation;
  if (error?.code === "40001") throw new ScreeningError(409, "This review changed. Reload before saving.");
  if (error?.code === "22023" || error?.code === "23505") throw new ScreeningError(409, "Check the posting, requisition and question configuration.");
  if (error) throw error;
  return data;
}

const operationalProjects = new Set(["ykftchggpdkmkpkbdbgs", "ofmqhrcmdrdrnvtnykyq"]);

function verifyPreviewProjects(careersUrl, atsUrl, scheduled) {
  if (!scheduled && process.env.VERCEL_ENV !== "preview") return;
  const careersRef = process.env.ATS_SCREENING_STAGING_CAREERS_REF;
  const atsRef = process.env.ATS_SCREENING_STAGING_ATS_REF;
  const approved = (url, ref) => /^[a-z0-9]{20}$/.test(ref ?? "") && !operationalProjects.has(ref)
    && url?.replace(/\/$/, "") === `https://${ref}.supabase.co`;
  if (careersRef === atsRef || !approved(careersUrl, careersRef) || !approved(atsUrl, atsRef)) {
    throw new ScreeningError(503, "Preview requires two verified isolated staging Supabase projects.");
  }
}

function clients(token, signal) {
  const careersUrl = process.env.VITE_SUPABASE_URL;
  const careersKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const atsUrl = process.env.VITE_MARKETING_DEV_SUPABASE_URL;
  const atsKey = process.env.ATS_SCREENING_SERVICE_ROLE_KEY;
  const atsPublicKey = process.env.VITE_MARKETING_DEV_SUPABASE_PUBLISHABLE_KEY;
  if (!atsUrl || !atsKey || (token && !atsPublicKey) || !careersUrl || !careersKey) {
    throw new ScreeningError(503, "Recruiter screening connections are not configured.");
  }
  verifyPreviewProjects(careersUrl, atsUrl, Boolean(signal));
  const options = signal ? { auth: authOptions, global: {
    fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal })
  } } : { auth: authOptions };
  return {
    careers: createClient(careersUrl, careersKey, options),
    ats: createClient(atsUrl, atsKey, options),
    recruiter: token && createClient(atsUrl, atsPublicKey, {
      auth: authOptions,
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
  };
}

function applicantSnapshot(source) {
  const {
    id, first_name, last_name, email, phone, position_id, position_title, screening_answers, screening_version_id,
    created_at, cover_letter, source: channel, employee_referral_code, utm_campaign, utm_medium, utm_content, interview_status, interview_at,
    interview_teams_url, interview_notes, resume_path
  } = source;
  return {
    id, first_name, last_name, email, phone, position_id, position_title, screening_answers, screening_version_id,
    created_at, cover_letter, source: channel, employee_referral_code, utm_campaign, utm_medium, utm_content, interview_status, interview_at,
    interview_teams_url, interview_notes, resume_path
  };
}

async function copyResume(careers, ats, source, record, actor) {
  if (!record.candidate_id || !source.resume_path || record.resume_path) return record;
  const parts = source.resume_path.split("/");
  const name = parts[1] || "";
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (parts.length !== 2 || parts[0] !== source.id || !/^[\w.-]+$/.test(name) || !Object.hasOwn(resumeTypes, extension)) {
    throw new ScreeningError(422, "The original resume path needs manual review.");
  }
  const sourceStorage = careers.storage.from("resumes");
  const maxBytes = 10 * 1024 * 1024;
  const invalidSize = size => size === 0 || size > maxBytes;
  const { size } = await query(sourceStorage.info(source.resume_path));
  if (invalidSize(size)) throw new ScreeningError(422, "The source resume exceeds the supported file size or is empty.");
  const file = await query(sourceStorage.download(source.resume_path));
  if (invalidSize(file.size)) throw new ScreeningError(422, "The source resume exceeds the supported file size or is empty.");
  const digest = hash(Buffer.from(await file.arrayBuffer()));
  const existing = await query(ats.from("ats_screening_cases").select("resume_path")
    .eq("candidate_id", record.candidate_id).eq("resume_sha256", digest)
    .not("resume_path", "is", null).limit(1).maybeSingle());
  const path = existing?.resume_path ?? `${record.candidate_id}/${digest}.${extension}`;
  // The path is content-addressed. Concurrent copies and retries target the same object.
  const storage = ats.storage.from(bucket);
  const alreadyStored = existing && (await storage.exists(path)).data;
  if (!alreadyStored) {
    const { error } = await storage.upload(path, file, { contentType: resumeTypes[extension], upsert: false });
    if (error && !(await storage.exists(path)).data) throw error;
  }
  return query(ats.rpc("ats_screening_record_resume", {
    p_application: source.id, p_candidate: record.candidate_id, p_actor: actor,
    p_path: path, p_digest: digest, p_name: name
  }));
}

async function evidence(ats, record, actor, generate) {
  if (!record.resume_sha256 || !record.questionnaire?.questions?.length) {
    if (!generate) return { draft: null };
    throw new ScreeningError(422, "A private resume and position questionnaire are required.");
  }
  const fingerprint = evidenceFingerprint(record.resume_sha256, record.questionnaire);
  const key = () => ats.from("ats_screening_evidence").select("draft")
    .eq("application_id", record.application_id).eq("fingerprint", fingerprint);
  if (!generate) return { draft: (await query(key().maybeSingle()))?.draft ?? null };
  if (!process.env.OPENAI_API_KEY) {
    const cached = await query(key().maybeSingle());
    if (cached?.draft) return { draft: cached.draft };
    throw new ScreeningError(503, "Resume evidence generation is not configured.");
  }
  const claim = await query(ats.rpc("ats_screening_claim_evidence", {
    p_application: record.application_id, p_fingerprint: fingerprint
  }));
  if (claim.draft) return { draft: claim.draft };
  if (!claim.lease) throw new ScreeningError(409, "A recruiter is already generating this draft. Reload in a moment.");
  const scope = operation => operation.eq("application_id", record.application_id)
    .eq("fingerprint", fingerprint).eq("lease_id", claim.lease);
  try {
    const file = await query(ats.storage.from(bucket).download(record.resume_path));
    const text = await extractResumeText(file, record.resume_path).catch(() => {
      throw new ScreeningError(422, "Automatic extraction requires a readable PDF or DOCX. Review this file manually.");
    });
    if (!text.trim()) throw new ScreeningError(422, "This resume has no extractable text. Review it manually.");
    const draft = await generateEvidence(text, record.questionnaire);
    await query(scope(ats.from("ats_screening_evidence").update({ draft })).select("fingerprint").single());
    await query(ats.from("ats_screening_audit").insert({
      application_id: record.application_id, actor, action: "evidence_generated", details: { fingerprint }
    }));
    return { draft };
  } catch (error) {
    await scope(ats.from("ats_screening_evidence").delete()).is("draft", null);
    throw error;
  }
}

async function syncApplication({ careers, ats }, position, applicationId, actor, candidateId, requisitionId = position.requisition_id) {
  const source = await query(careers.from("candidate_applications").select("*")
    .eq("id", applicationId).eq("position_id", position.job_id).maybeSingle());
  if (!source) throw new ScreeningError(404, "Application not found for this posting.");
  if (position.requires_routing) {
    const route = await query(careers.from("screening_application_routes").select("requisition_id")
      .eq("application_id", applicationId).eq("job_id", position.job_id).maybeSingle());
    if (route?.requisition_id !== requisitionId) {
      throw new ScreeningError(409, "Choose the application's destination before syncing it from that requisition.");
    }
  }
  const versionId = source.screening_version_id ?? position.published_id;
  const questionnaire = versionId ? await query(careers.from("screening_versions")
    .select("id,version,questions").eq("id", versionId).eq("job_id", position.job_id).maybeSingle()) : null;
  const record = await query(ats.rpc("ats_screening_import", {
    p_actor: actor, p_requisition: requisitionId, p_application: applicantSnapshot(source),
    p_questionnaire: questionnaire, p_candidate: candidateId ?? null
  }));
  return copyResume(careers, ats, source, record, actor);
}

async function scheduledSync(req, res) {
  const secret = process.env.CRON_SECRET;
  if (process.env.ATS_SCREENING_CRON_ENABLED !== "true" || process.env.VERCEL_ENV === "production" || !secret || secret.length < 32) {
    return res.status(404).json({ error: "Scheduled screening sync is disabled." });
  }
  const supplied = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: "Invalid scheduler authorization." });
  }
  const connection = clients(null, AbortSignal.timeout(45000));
  const { careers } = connection;
  const entries = await query(careers.rpc("claim_screening_sync", { p_limit: 8 }));
  const results = await Promise.all(entries.map(async entry => {
    let result;
    try {
      const position = await query(careers.from("screening_positions")
        .select("job_id,requisition_id,alternate_requisition_id,published_id,requires_routing,automation_enabled").eq("job_id", entry.job_id).maybeSingle());
      if (!position?.automation_enabled || !position.published_id ||
        ![position.requisition_id, position.alternate_requisition_id].includes(entry.requisition_id)) {
        result = "mapping_changed";
      } else {
        const record = await syncApplication(connection, position, entry.application_id, null, undefined, entry.requisition_id);
        result = record.candidate_id ? "synced" : "identity_review";
      }
    } catch (error) {
      result = error.status === 422 ? "manual_resume" : error.status === 404 ? "mapping_changed" : "retry";
    }
    await query(careers.rpc("finish_screening_sync", {
      p_application: entry.application_id, p_lease: entry.lease_id, p_result: result
    }));
    return result;
  }));
  const totals = {};
  for (const result of results) totals[result] = (totals[result] ?? 0) + 1;
  return res.status(200).json({ processed: results.length, totals });
}

async function dispatch(body, { careers, ats, recruiter }, actor) {
  if (body.action === "postings") {
    return { postings: await query(careers.from("job_postings")
      .select("id,title,description,location,hours,pay,is_active").order("title").limit(1000)) };
  }

  if (body.action === "candidateScreening") {
    return { records: await query(ats.from("ats_screening_cases")
      .select("application_id,requisition_id,application,questionnaire,resume_name,resume_sha256")
      .eq("candidate_id", body.candidateId).order("updated_at", { ascending: false })) };
  }
  if (body.action === "questionnaire") {
    const [requisitions, posting] = await Promise.all([
      query(recruiter.rpc("ats_admin_requisitions")),
      query(careers.from("job_postings").select("id,title").eq("id", body.jobId).maybeSingle())
    ]);
    if (!posting) throw new ScreeningError(404, "Careers posting ID was not found in this project.");
    const requisition = requisitions?.requisitions?.find(item => item.id === body.requisitionId);
    if (!requisition) throw new ScreeningError(404, "Requisition not found.");
    if (body.publish && requisition.status !== "open") {
      throw new ScreeningError(409, "Open the requisition before publishing a questionnaire.");
    }
    if (body.alternateRequisitionId || (isSplitPosting(posting.title) && body.publish)) {
      const alternate = requisitions?.requisitions?.find(item => item.id === body.alternateRequisitionId);
      if (!isSplitPosting(posting.title) || requisition.status !== "open" || alternate?.status !== "open" ||
          !isWarehouseSplitPair(requisition.title, alternate.title)) {
        throw new ScreeningError(409, "Select the distinct open Warehouse Picker and Warehouse Packer requisitions.");
      }
    }
    return { position: await query(careers.rpc("write_screening_routing", {
      p_job: body.jobId, p_requisition: body.requisitionId, p_actor: actor,
      p_questions: body.questions, p_publish: body.publish, p_alternate: body.alternateRequisitionId ?? null
    })) };
  }

  if (body.action === "configuration" || body.action === "applicants" || body.action === "sync" || body.action === "route") {
    const position = await query(careers.from("screening_positions").select("*")
      .or(`requisition_id.eq.${body.requisitionId},alternate_requisition_id.eq.${body.requisitionId}`).maybeSingle());
    if (body.action === "configuration") return { position };
    if (!position) throw new ScreeningError(404, "Link a Careers posting in Open Positions first.");
    if (body.action === "route") {
      if (!position.requires_routing || position.requisition_id !== body.requisitionId ||
          !position.alternate_requisition_id ||
          ![position.requisition_id, position.alternate_requisition_id].includes(body.destinationId)) {
        throw new ScreeningError(409, "Select a configured destination from the primary routing queue.");
      }
      const [existing, requisitions] = await Promise.all([
        query(ats.from("ats_screening_cases").select("job_id,requisition_id").eq("application_id", body.applicationId).maybeSingle()),
        query(recruiter.rpc("ats_admin_requisitions"))
      ]);
      if (!requisitions?.requisitions?.some(item => item.id === body.destinationId && item.status === "open")) {
        throw new ScreeningError(409, "Select a destination that is still open in the ATS.");
      }
      if (existing && (existing.job_id !== position.job_id || existing.requisition_id !== body.destinationId)) {
        throw new ScreeningError(409, "An existing ATS screening case owns this application. Review its requisition before routing.");
      }
      const destination = await query(careers.rpc("select_screening_application_route", {
        p_application: body.applicationId, p_job: position.job_id, p_requisition: body.destinationId, p_actor: actor
      }));
      return { destination };
    }
    if (body.action === "applicants") {
      const [scoped, reviewed] = await Promise.all([
        query(careers.rpc("list_routed_screening_applicants", {
          p_job: position.job_id, p_requisition: body.requisitionId, p_offset: body.offset
        })),
        ats.from("ats_screening_cases").select("application_id", { count: "exact", head: true })
          .eq("requisition_id", body.requisitionId).eq("review->>completed", "true")
      ]);
      if (reviewed.error) throw reviewed.error;
      const source = scoped.applications;
      const summary = { total: scoped.total, assessed: scoped.assessed, resumes: scoped.resumes,
        waiting: Math.max(0, scoped.total - reviewed.count) };
      const page = source.slice(0, pageSize);
      const applicationIds = page.map(item => item.id);
      const [saved, syncRows] = page.length ? await Promise.all([
        query(ats.from("ats_screening_cases").select("*").eq("requisition_id", body.requisitionId).in("application_id", applicationIds)),
        query(careers.from("screening_sync_queue").select("application_id,state,error_code").in("application_id", applicationIds))
      ]) : [[], []];
      const syncStates = new Map(syncRows.map(item => [item.application_id, item]));
      const cases = new Map(saved.map(item => [item.application_id, item]));
      const versionIds = [...new Set(page.flatMap(item =>
        item.screening_version_id && !cases.has(item.id) ? [item.screening_version_id] : []))];
      const versions = versionIds.length ? await query(careers.from("screening_versions")
        .select("id,version,questions").eq("job_id", position.job_id).in("id", versionIds)) : [];
      const questionnaires = new Map(versions.map(version => [version.id, version]));
      return {
        summary,
        routing: position.requires_routing ? { primary: position.requisition_id, alternate: position.alternate_requisition_id } : null,
        nextOffset: source.length > pageSize ? body.offset + pageSize : null,
        applicants: page.map(item => {
          const { resume_path, ...application } = applicantSnapshot(item);
          return {
            application, case: cases.get(item.id) ?? null, hasResume: Boolean(resume_path),
            sync: syncStates.get(item.id) ?? null,
            automationEnabled: position.automation_enabled,
            needsRoute: position.requires_routing && !item.routed_requisition_id,
            questionnaire: questionnaires.get(item.screening_version_id) ?? null
          };
        })
      };
    }

    return { case: await syncApplication({ careers, ats }, position, body.applicationId, actor, body.candidateId, body.requisitionId) };
  }

  const record = await query(ats.from("ats_screening_cases").select("*")
    .eq("application_id", body.applicationId).eq("requisition_id", body.requisitionId).maybeSingle());
  if (!record) throw new ScreeningError(404, "Sync this application first.");
  if (body.action === "review") {
    return { case: await query(ats.rpc("ats_screening_save_interview_review", {
      p_actor: actor, p_application: record.application_id, p_revision: body.revision,
      p_review: body.review, p_advance: body.advancePipeline
    })) };
  }
  if (body.action === "draft") return evidence(ats, record, actor, body.generate);
  if (!record.resume_path) throw new ScreeningError(404, "No synchronized resume.");
  const { signedUrl } = await query(ats.storage.from(bucket).createSignedUrl(record.resume_path, 60, {
    download: record.resume_name
  }));
  await query(ats.from("ats_screening_audit").insert({
    application_id: record.application_id, actor, action: "resume_access_granted"
  }));
  return { url: signedUrl };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    try {
      return await scheduledSync(req, res);
    } catch {
      return res.status(503).json({ error: "Scheduled screening sync could not finish. Leases expire and queued work can retry." });
    }
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: "Sign in to the ATS." });
  const result = request.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid screening request." });
  try {
    const connection = clients(token);
    const { data, error } = await connection.recruiter.rpc("ats_screening_authorize");
    if (error || !data) return res.status(403).json({ error: "Recruiter administrator access required." });
    return res.status(200).json(await dispatch(result.data, connection, data));
  } catch (error) {
    if (error instanceof ScreeningError) return res.status(error.status).json({ error: error.message });
    // Database, storage and inference errors can carry applicant data. Keep responses generic.
    console.error("ATS screening operation failed", result.data.action, error.code ?? error.name);
    return res.status(502).json({ error: "Screening operation failed. Try again or contact the ATS administrator." });
  }
}
