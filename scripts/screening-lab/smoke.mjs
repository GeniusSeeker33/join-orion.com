import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { compareContract } from "./contract.mjs";
import handler from "../../api/ats-screening.js";
import { labAtsUrl, labCareersUrl, labInferenceKey, labInferenceUrl } from "../../api/_lib/screening-environment.js";
import { postings, requisitions } from "./dataset.mjs";

const [root, run, mode] = process.argv.slice(2);
const acceptance = mode === "--acceptance";
const contract = compareContract(JSON.parse(await readFile(join(root, "ats-contract.json"), "utf8")));
assert.ok(!contract.blockers.some(issue => /Interview RPC signature|unavailable authenticated RPC: ats_admin_create_interview/.test(issue)),
  "The local interview RPC must expose the reported text-time contract");
const status = async (realm, url) => {
  const value = JSON.parse(await readFile(join(root, realm + ".status.json"), "utf8"));
  assert.equal(value.API_URL, url, "The CLI must report the expected loopback API");
  assert.ok(value.ANON_KEY && value.SERVICE_ROLE_KEY, "Local SDK keys were not available");
  return value;
};
const careersInfo = await status("careers", labCareersUrl);
const atsInfo = await status("ats", labAtsUrl);
assert.ok(careersInfo.SERVICE_ROLE_KEY !== atsInfo.SERVICE_ROLE_KEY, "Local stacks must use distinct service credentials");
const password = randomBytes(24).toString("hex");
const client = (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const careers = client(labCareersUrl, careersInfo.SERVICE_ROLE_KEY);
const ats = client(labAtsUrl, atsInfo.SERVICE_ROLE_KEY);
const applicant = client(labCareersUrl, careersInfo.ANON_KEY);
const careersAdmin = client(labCareersUrl, careersInfo.ANON_KEY);
const recruiter = client(labAtsUrl, atsInfo.ANON_KEY);
const inactive = client(labAtsUrl, atsInfo.ANON_KEY);
const atsAnon = client(labAtsUrl, atsInfo.ANON_KEY);
const viewer = client(labAtsUrl, atsInfo.ANON_KEY);

function take(result, label) {
  if (result.error) throw new Error(label + ": " + result.error.message);
  return result.data;
}
const identity = await Promise.all([careers.rpc("screening_lab_identity"), ats.rpc("screening_lab_identity")]);
assert.deepEqual(take(identity[0], "Careers fixture identity"), { realm: "careers", run });
assert.deepEqual(take(identity[1], "ATS fixture identity"), { realm: "ats", run });
assert.ok((await client(labAtsUrl, careersInfo.SERVICE_ROLE_KEY).rpc("screening_lab_identity")).error,
  "Careers service credentials must fail at ATS");
assert.ok((await client(labCareersUrl, atsInfo.SERVICE_ROLE_KEY).rpc("screening_lab_identity")).error,
  "ATS service credentials must fail at Careers");
const wrongBearer = await fetch(labAtsUrl + "/rest/v1/rpc/screening_lab_identity", {
  method: "POST", headers: { apikey: atsInfo.ANON_KEY, authorization: "Bearer " + careersInfo.SERVICE_ROLE_KEY,
    "Content-Type": "application/json" }, redirect: "error", body: "{}"
});
assert.ok([401, 403].includes(wrongBearer.status), "A valid ATS API key cannot make a foreign service JWT authoritative");

Object.assign(process.env, {
  VITE_SUPABASE_URL: labCareersUrl,
  VITE_SUPABASE_ANON_KEY: careersInfo.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: careersInfo.SERVICE_ROLE_KEY,
  VITE_MARKETING_DEV_SUPABASE_URL: labAtsUrl,
  VITE_MARKETING_DEV_SUPABASE_PUBLISHABLE_KEY: atsInfo.ANON_KEY,
  ATS_SCREENING_SERVICE_ROLE_KEY: atsInfo.SERVICE_ROLE_KEY,
  ATS_SCREENING_LOCAL_MODE: "true",
  VITE_ATS_SCREENING_LAB: "true",
  ATS_SCREENING_LAB_RUN: run,
  ATS_SCREENING_CRON_ENABLED: "false",
  OPENAI_API_KEY: labInferenceKey,
  OPENAI_BASE_URL: labInferenceUrl
});

const build = overrides => spawnSync(process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", join(root, "frontend"), "--emptyOutDir"],
  { env: { ...process.env, ...overrides }, encoding: "utf8", timeout: 60000 });
const mismatchedBuild = build({ ATS_SCREENING_LAB_RUN: "0".repeat(32) });
assert.notEqual(mismatchedBuild.status, 0);
assert.match(mismatchedBuild.stderr, /not the expected synthetic screening lab/);
assert.equal(build({}).status, 0, "Vite build must verify both live local lab markers");

async function setupUser(service, login, email) {
  const { user } = take(await service.auth.admin.createUser({ email, password, email_confirm: true }), "Create synthetic account");
  const { session } = take(await login.auth.signInWithPassword({ email, password }), "Sign in to lab");
  return { user, token: session.access_token, email };
}
const recruiterUser = await setupUser(ats, recruiter, "recruiter@example.test");
const viewerUser = await setupUser(ats, viewer, "viewer@example.test");
const inactiveUser = await setupUser(ats, inactive, "inactive@example.test");
const adminUser = await setupUser(careers, careersAdmin, "careers-admin@example.test");
take(await ats.rpc("screening_lab_setup", { p_recruiter: recruiterUser.user.id, p_inactive: inactiveUser.user.id, p_requisitions: requisitions }), "Seed seven ATS requisitions");
take(await careers.from("admin_users").insert({ email: adminUser.email, role: "admin", active: true }), "Seed Careers admin");
const referralCode = "ORION-SYNTHETICLAB";
take(await careersAdmin.rpc("save_sales_referral_employee", {
  p_id: null, p_revision: null, p_name: "Synthetic Employee", p_email: "employee@example.test",
  p_started_on: "2020-01-01", p_last_employed_on: null, p_sales_eligible: true, p_sharing_enabled: true, p_code: referralCode
}), "Create referral employee");

async function invoke(body, { token = recruiterUser.token, expected = 200, method = "POST" } = {}) {
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } };
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  assert.equal(res.code, expected, body.action + ": " + (res.value?.error ?? "unexpected status"));
  return res.value;
}

await invoke({ action: "postings" }, { token: "", expected: 401 });
await invoke({ action: "postings" }, { token: viewerUser.token, expected: 403 });
await invoke({ action: "postings" }, { token: adminUser.token, expected: 403 });
await invoke({ action: "postings" }, { token: inactiveUser.token, expected: 403 });
await invoke({ action: "worker" }, { token: "", method: "GET", expected: 404 });
await invoke({ action: "worker" }, { token: recruiterUser.token, method: "GET", expected: 404 });
assert.ok((await ats.auth.getUser(adminUser.token)).error, "Careers JWT must fail at ATS Auth");
assert.ok((await applicant.rpc("screening_lab_identity")).error, "Fixture marker must be private");
assert.ok((await applicant.from("candidate_applications").select("id")).error, "Applicant PII must be private");
assert.ok((await viewer.from("ats_screening_cases").select("application_id")).error, "ATS case data must be private");
process.env.ATS_SCREENING_LAB_RUN = "0".repeat(32);
await invoke({ action: "postings" }, { expected: 503 });
process.env.ATS_SCREENING_LAB_RUN = run;
assert.equal((await invoke({ action: "postings" })).postings.length, 6);
assert.equal(take(await recruiter.rpc("ats_admin_requisitions"), "Read ATS requisitions").requisitions.length, 7);
console.log("Verified separate Auth realms and database role restrictions");

const combined = postings.find(item => item.alternate);
const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const resume = new Blob([await readFile(new URL("../../tests/fixtures/synthetic-resume.docx", import.meta.url))], { type: docxMime });
const sourcePath = combined.application + "/synthetic.docx";
take(await applicant.storage.from("resumes").upload(sourcePath, new Uint8Array(await resume.arrayBuffer()), {
  contentType: docxMime
}), "Upload a synthetic private resume");
assert.ok((await applicant.storage.from("resumes").download(sourcePath)).error, "Careers upload must not grant read");
const careersBucket = take(await careers.storage.getBucket("resumes"), "Check Careers bucket");
assert.equal(careersBucket.public, false);
assert.equal(careersBucket.file_size_limit, 10485760);
take(await careersAdmin.storage.from("resumes").download(sourcePath), "Active Careers admin can read private upload");

const first = postings[0];
const publish = { action: "questionnaire", jobId: first.id, requisitionId: first.requisition, questions: first.questions, publish: true };
const draftPosition = (await invoke({ ...publish, publish: false })).position;
assert.equal(draftPosition.published_id, null);
for (const [token, expected] of [["", 401], [viewerUser.token, 403], [inactiveUser.token, 403], [adminUser.token, 403]]) {
  await invoke(publish, { token, expected });
}
assert.equal(take(await applicant.rpc("read_screening_questionnaire", { p_job: first.id }), "Read unpublished questionnaire"), null);

const imported = new Map();
for (const posting of postings) {
  const { position } = await invoke({ action: "questionnaire", jobId: posting.id, requisitionId: posting.requisition,
    alternateRequisitionId: posting.alternate, questions: posting.questions, publish: true });
  const version = take(await applicant.rpc("read_screening_questionnaire", { p_job: posting.id }), "Read published questionnaire");
  assert.equal(version.id, position.published_id);
  if (posting.id === first.id) {
    assert.equal(take(await applicant.rpc("read_screening_questionnaire", { p_job: null }), "Read Returns alias").id, version.id);
  }
  const sales = posting.title === "Sales Executive";
  if (sales) assert.equal(take(await applicant.rpc("validate_sales_referral", { p_code: referralCode, p_job: posting.id }), "Validate referral"), true);
  const newApplication = {
    id: posting.application, first_name: "Synthetic", last_name: "Applicant " + posting.application.slice(-2),
    email: posting.email, phone: posting.phone, position_id: posting.id, position_title: posting.title,
    screening_version_id: version.id, screening_answers: Object.fromEntries(posting.questions.map(({ id }) => [id, "Synthetic response"])),
    ...(posting.alternate ? { resume_path: sourcePath } : {}),
    ...(sales ? { employee_referral_code: referralCode } : {})
  };
  take(await applicant.from("candidate_applications").insert(newApplication), "Submit synthetic application");
  assert.equal((await applicant.from("candidate_applications").insert(newApplication)).error?.code, "23505");
  if (posting.id === first.id) {
    assert.equal(position.sync_owner, "legacy_returns");
    await invoke({ action: "sync", applicationId: posting.application, requisitionId: posting.requisition }, { expected: 409 });
    await invoke({ action: "applicants", requisitionId: posting.requisition }, { expected: 409 });
    assert.ok((await ats.rpc("ats_screening_import", { p_actor: null, p_requisition: posting.requisition,
      p_application: newApplication, p_questionnaire: null })).error, "ATS must deny direct Returns imports");
    continue;
  }
  assert.equal(position.sync_owner, "universal");
  let destination = posting.requisition;
  if (posting.alternate) {
    const waiting = await invoke({ action: "applicants", requisitionId: posting.requisition });
    assert.equal(waiting.applicants[0].needsRoute, true);
    await invoke({ action: "sync", applicationId: posting.application, requisitionId: posting.requisition }, { expected: 409 });
    await invoke({ action: "route", applicationId: posting.application, requisitionId: posting.requisition, destinationId: posting.alternate });
    await invoke({ action: "route", applicationId: posting.application, requisitionId: posting.requisition, destinationId: posting.requisition }, { expected: 409 });
    assert.equal((await invoke({ action: "applicants", requisitionId: posting.requisition })).summary.total, 0);
    destination = posting.alternate;
  }
  const payload = { action: "sync", applicationId: posting.application, requisitionId: destination };
  if (posting.alternate) {
    const seeded = take(await ats.rpc("ats_screening_import", {
      p_actor: recruiterUser.user.id, p_requisition: destination, p_application: newApplication, p_questionnaire: version
    }), "Create case before registering its attachment");
    const bytes = new Uint8Array(await resume.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    const path = `${seeded.candidate_id}/${digest}.docx`;
    take(await ats.storage.from("ats-screening-resumes").upload(path, bytes, { contentType: docxMime }),
      "Seed an upload that completed before attachment registration");
    assert.ok((await ats.rpc("ats_screening_record_resume", {
      p_application: posting.application, p_candidate: posting.application, p_actor: recruiterUser.user.id,
      p_path: path, p_digest: digest, p_name: "synthetic.docx"
    })).error, "Reject attachment registration with a mismatched candidate");
    const [retry, duplicate] = await Promise.all([invoke(payload), invoke(payload)]);
    assert.equal(retry.case.resume_path, path);
    assert.equal(duplicate.case.resume_path, path);
    imported.set(posting.application, retry.case);
  } else {
    const [initial, repeated] = await Promise.all([invoke(payload), invoke(payload)]);
    assert.equal(initial.case.candidate_id, repeated.case.candidate_id);
    imported.set(posting.application, initial.case);
  }
}
// A second applicant deliberately chooses Picker while the first remains in Packer.
const pickerApplication = "4ab00000-0000-4000-8000-000000000048";
const pickerVersion = take(await applicant.rpc("read_screening_questionnaire", { p_job: combined.id }), "Read shared questionnaire");
take(await applicant.from("candidate_applications").insert({
  id: pickerApplication, first_name: "Synthetic", last_name: "Picker Applicant",
  email: "applicant-picker@example.test", phone: "812-555-0180",
  position_id: combined.id, position_title: combined.title, screening_version_id: pickerVersion.id,
  screening_answers: Object.fromEntries(combined.questions.map(({ id }) => [id, "Synthetic picker response"]))
}), "Submit second combined-posting applicant");
await invoke({ action: "route", applicationId: pickerApplication, requisitionId: combined.requisition, destinationId: combined.requisition });
const picker = await invoke({ action: "sync", applicationId: pickerApplication, requisitionId: combined.requisition });
await invoke({ action: "sync", applicationId: pickerApplication, requisitionId: combined.alternate }, { expected: 409 });
const referrals = take(await careersAdmin.rpc("read_sales_referral_admin"), "Read referral ledger");
assert.equal(referrals.claims.length, 1);
assert.equal(referrals.claims[0].captured_code, referralCode);
assert.equal(take(await careers.rpc("claim_screening_sync", { p_limit: 8 }), "Check disabled mappings").length, 0);
console.log("Published six local versions, excluded Returns from universal sync, and verified six eligible requisitions and referrals");

const selected = imported.get(combined.application);
const scope = { applicationId: combined.application, requisitionId: combined.alternate };
assert.ok(selected.resume_path);
assert.ok((await viewer.storage.from("ats-screening-resumes").download(selected.resume_path)).error);
await invoke({ action: "resume", ...scope }, { token: viewerUser.token, expected: 403 });
for (const [actor, login] of [[viewerUser, viewer], [inactiveUser, inactive]]) {
  await invoke({ action: "applicants", requisitionId: scope.requisitionId }, { token: actor.token, expected: 403 });
  await invoke({ action: "resume", ...scope }, { token: actor.token, expected: 403 });
  assert.ok((await login.storage.from("ats-screening-resumes").download(selected.resume_path)).error);
}
await invoke({ action: "resume", ...scope }, { token: "", expected: 401 });
assert.ok((await atsAnon.storage.from("ats-screening-resumes").download(selected.resume_path)).error);
const signed = await invoke({ action: "resume", ...scope });
assert.equal(new URL(signed.url).origin, labAtsUrl);
const download = await fetch(signed.url, { redirect: "error" });
assert.equal(download.status, 200);
assert.deepEqual(new Uint8Array(await download.arrayBuffer()), new Uint8Array(await resume.arrayBuffer()));

let inferenceRequests = 0;
const inference = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const request = JSON.parse(body);
  assert.equal(request.store, false);
  if (!request.messages[1].content.includes("Synthetic inventory experience")) {
    res.writeHead(422).end();
    return;
  }
  inferenceRequests++;
  const output = { experience: [{ observation: "Inventory experience", quote: "Synthetic inventory experience" }],
    missing_information: [], interview_questions: ["Describe an inventory check."] };
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output), role: "assistant" } }] }));
});
await new Promise((resolve, reject) => inference.listen(5588, "127.0.0.1", resolve).once("error", reject));
try {
  const generated = await invoke({ action: "draft", ...scope, generate: true });
  assert.equal(generated.draft.experience[0].quote, "Synthetic inventory experience");
  assert.deepEqual(await invoke({ action: "draft", ...scope, generate: true }), generated);
  assert.equal(inferenceRequests, 1);
} finally {
  await new Promise(resolve => inference.close(resolve));
}

const review = { notes: "Synthetic recruiter review", decision: "interview", interview_at: "2027-01-01T10:00:00.000Z",
  meeting_url: null, approved_evidence: "Verified from the synthetic resume", completed: true };
const reviewAction = { action: "review", ...scope, revision: selected.revision, review, advancePipeline: true };
for (const [token, expected] of [["", 401], [viewerUser.token, 403], [inactiveUser.token, 403], [adminUser.token, 403]]) {
  await invoke(reviewAction, { token, expected });
}
const interviewArgs = {
  p_candidate_id: selected.candidate_id, p_position_title: "Warehouse Packer", p_interview_date: "2027-01-01",
  p_start_time: "10:00", p_end_time: "10:30", p_interview_format: "Video", p_interview_stage: "Video Interview"
};
for (const actor of [atsAnon, viewer, inactive]) {
  assert.ok((await actor.rpc("ats_admin_create_interview", interviewArgs)).error, "Unauthorized native interview creation");
  assert.ok((await actor.rpc("ats_screening_save_interview_review", {
    p_actor: recruiterUser.user.id, p_application: scope.applicationId,
    p_revision: selected.revision, p_review: review, p_advance: true
  })).error, "Direct stage advancement must be denied");
}
assert.equal((take(await ats.rpc("screening_lab_pipeline"), "Check denied interview mutations").interviews ?? []).length, 0);
for (const invalid of [
  { p_candidate_id: combined.application }, { p_start_time: "9:00" }, { p_end_time: "09:59" }
]) {
  assert.ok((await recruiter.rpc("ats_admin_create_interview", { ...interviewArgs, ...invalid })).error,
    "Native interview validation must reject an unknown candidate, invalid time or reversed range");
}
take(await recruiter.rpc("ats_admin_create_interview", interviewArgs), "Create native calendar interview");
const native = take(await ats.rpc("screening_lab_pipeline"), "Inspect native interview");
assert.equal(native.interviews[0].attendance_status, "unverified");
assert.equal(native.assignments.find(row => row.candidate_id === selected.candidate_id).stage, "new");
await invoke(reviewAction);

const legacyBucket = "ats-dev-resumes";
const legacyPath = selected.candidate_id + "/legacy.docx";
const legacyBucketInfo = take(await ats.storage.getBucket(legacyBucket), "Read legacy bucket metadata");
assert.equal(legacyBucketInfo.public, false);
assert.equal(legacyBucketInfo.file_size_limit, 10485760);
take(await recruiter.storage.from(legacyBucket).upload(legacyPath, new Uint8Array(await resume.arrayBuffer()), {
  contentType: docxMime
}), "Seed separately owned legacy attachment");
assert.ok((await viewer.storage.from(legacyBucket).download(legacyPath)).error);
assert.ok((await inactive.storage.from(legacyBucket).download(legacyPath)).error);
assert.ok((await atsAnon.storage.from(legacyBucket).download(legacyPath)).error);
take(await recruiter.storage.from(legacyBucket).download(legacyPath), "Recruiter can read legacy attachment");
take(await recruiter.auth.signOut(), "End recruiter session");
const fresh = take(await recruiter.auth.signInWithPassword({ email: recruiterUser.email, password }), "Start new recruiter session");
const reviewPage = await invoke({ action: "applicants", requisitionId: scope.requisitionId }, { token: fresh.session.access_token });
assert.deepEqual(reviewPage.applicants[0].case.review, review);
assert.equal((await invoke({ action: "draft", ...scope }, { token: fresh.session.access_token })).draft.experience[0].quote,
  "Synthetic inventory experience");
const repeated = await invoke({ action: "sync", ...scope }, { token: fresh.session.access_token });
assert.equal(repeated.case.resume_path, selected.resume_path);
const legacyFile = take(await ats.storage.from(legacyBucket).download(legacyPath), "Read unchanged legacy attachment");
assert.deepEqual(new Uint8Array(await legacyFile.arrayBuffer()), new Uint8Array(await resume.arrayBuffer()));
const pipeline = take(await ats.rpc("screening_lab_pipeline"), "Read fixture pipeline");
assert.equal(pipeline.assignments.length, 6);
assert.equal(pipeline.interviews[0].attendance_status, native.interviews[0].attendance_status);
assert.equal(pipeline.assignments.find(row => row.candidate_id === picker.case.candidate_id).requisition_id, combined.requisition);
assert.equal(pipeline.interviews.length, 1);
assert.equal(pipeline.assignments.find(row => row.candidate_id === selected.candidate_id).stage, "interview");
assert.equal(pipeline.assignments.find(row => row.candidate_id === selected.candidate_id).requisition_id, combined.alternate);
console.log("Verified private signed resumes, local model evidence and cache, repeat sync, recruiter re-login, and fixture interview persistence");

if (acceptance) {
  const { startAcceptancePreview } = await import("./preview.mjs");
  await new Promise((resolve, reject) => inference.listen(5588, "127.0.0.1", resolve).once("error", reject));
  try {
    const server = await startAcceptancePreview(join(root, "frontend"));
    console.log("Synthetic ATS: http://127.0.0.1:5587/ats");
    console.log("Synthetic Careers: http://127.0.0.1:5587/careers");
    console.log("Legacy Returns intake: http://127.0.0.1:5587/returns-assessment");
    console.log("Disposable recruiter login: " + recruiterUser.email + " / " + password);
    await new Promise(resolve => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
    await new Promise(resolve => server.httpServer.close(resolve));
  } finally {
    await new Promise(resolve => inference.close(resolve));
  }
}
