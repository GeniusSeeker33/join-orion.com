import { defaultRubric, scoreSummary, validCategories } from "../src/components/screening/rubrics.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { extractResumeText, evidenceFingerprint, generateEvidence } from "../api/_lib/screening-evidence.js";
import { screeningIsolationError, labAtsUrl, labCareersUrl, labInferenceKey, labInferenceUrl } from "../api/_lib/screening-environment.js";
import handler from "../api/ats-screening.js";
import { screeningTemplates } from "../src/components/screening/templates.js";
import { asUser, createReferralDb, id, seedEmployee } from "./fixtures/referralDb.mjs";

const migration = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const first = [{ id: "experience", prompt: "Describe your order management experience." }];
const revised = [...first, { id: "schedule", prompt: "Can you work the posted schedule?" }];

test("Careers publishes immutable versions and preserves referral attribution", async () => {
  const db = await createReferralDb();
  try {
    await seedEmployee(db);
    await db.exec(`reset role; create role service_role bypassrls;
      alter table public.job_postings add column created_at timestamptz default now(), add column hours text,
        add column pay text, add column location text, add column description text;
      alter table public.candidate_applications add column resume_path text, add column phone text, add column created_at timestamptz default now();`);
    await db.exec(await migration("supabase/migrations/20261124000000_screening_questionnaires.sql"));
    const queueMigration = await migration("supabase/migrations/20261124010000_screening_sync_queue.sql");
    await db.exec(queueMigration);
    await db.exec(queueMigration);
    const referralCode = (await db.query("select code from referrals.employees")).rows[0].code;
    const write = async (items, publish, job = id(10), req = id(20)) => (await db.query(
      "select write_screening_questionnaire($1,$2,$3,$4,$5) as position",
      [job, req, JSON.stringify(items), id(1), publish]
    )).rows[0].position;
    const read = async job => (await db.query("select read_screening_questionnaire($1) as q", [job])).rows[0].q;
    const insert = (application, job, version, answers, ref = null) => db.query(`
      insert into candidate_applications(id,email,first_name,last_name,position_id,position_title,status,
        employee_referral_code,screening_version_id,screening_answers,resume_path)
      values($1,$2,'Synthetic','Applicant',$3,'Wrong title','new',$4,$5,$6,$7)
    `, [application, `synthetic${application.at(-1)}@example.test`, job, ref, version,
      JSON.stringify(answers), `${application}/resume.pdf`]);
    await db.exec("set role service_role");
    const draft = await write(first, false);
    await db.exec("reset role");
    await db.query("insert into job_postings(id,title,is_active) values($1,$2,true)",
      [id(12), screeningTemplates[0].title]);
    await asUser(db, null);
    await insert(id(37), id(12), null, { returns: "Handled returns before versioning." });
    await db.exec("reset role; set role service_role");
    const returns = await write(first, true, id(12), id(22));
    assert.equal(draft.published_id, null);
    await asUser(db, null);
    assert.equal(await read(id(10)), null);
    assert.equal((await read(null)).id, returns.published_id);
    await assert.rejects(write(first, true), /permission denied/);
    await assert.rejects(db.query("select * from screening_versions"), /permission denied/);
    await db.exec("reset role; set role service_role");
    const version = (await write(first, true)).published_id;
    assert.equal((await write(first, true)).published_id, version);
    await assert.rejects(write(first, true, id(10), id(21)), /already linked/);
    await asUser(db, null);
    assert.deepEqual(await read(id(10)), { id: version, job_id: id(10), title: "Sales Executive", version: 1, questions: first, hours: null, pay: null, location: null, description: null });
    assert.equal(await read(id(11)), null);
    await assert.rejects(insert(id(35), id(11), version, { experience: "Wrong posting" }), /questionnaire changed/);
    await assert.rejects(insert(id(35), id(10), version, { experience: " ", invented: "no" }), /Complete each/);
    await insert(id(30), id(10), version, { experience: "Entered orders" }, referralCode);
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int n from referrals.claims")).rows[0].n, 1);
    await assert.rejects(db.query("update candidate_applications set email='spoof@example.test' where id=$1", [id(30)]), /immutable/);
    await db.exec("set role service_role");
    const second = (await write(revised, true)).published_id;
    await asUser(db, null);
    assert.notEqual(second, version);
    assert.equal((await read(id(10))).version, 2);
    await assert.rejects(insert(id(36), id(10), version, { experience: "Stale" }), /questionnaire changed/);
    await db.exec("reset role");
    assert.deepEqual((await db.query("select screening_answers from candidate_applications where id=$1", [id(37)])).rows[0].screening_answers,
      { returns: "Handled returns before versioning." });
    await db.exec("set role service_role");
    const claim = async () => (await db.query("select * from claim_screening_sync(10)")).rows;
    const leased = await claim();
    assert.deepEqual(leased.map(item => item.application_id).sort(), [id(30), id(37)]);
    assert.equal((await claim()).length, 0);
    const item = leased.find(entry => entry.application_id === id(30));
    await db.query("select finish_screening_sync($1,$2,'synced')", [item.application_id, id(90)]);
    assert.equal((await db.query("select state from screening_sync_queue where application_id=$1", [id(30)])).rows[0].state, "pending");
    await db.query("select finish_screening_sync($1,$2,'synced')", [item.application_id, item.lease_id]);
    assert.equal((await db.query("select state from screening_sync_queue where application_id=$1", [id(30)])).rows[0].state, "synced");
    const legacy = leased.find(entry => entry.application_id === id(37));
    await db.query("select finish_screening_sync($1,$2,'retry')", [legacy.application_id, legacy.lease_id]);
    assert.equal((await claim()).length, 0);
    await db.exec("reset role");
    await db.query("update candidate_applications set resume_path=$2 where id=$1", [id(37), id(37) + "/late.pdf"]);
    await db.exec("set role service_role");
    const revived = await claim();
    assert.equal(revived.length, 1);
    assert.equal(revived[0].application_id, id(37));
    await asUser(db, null);
    await assert.rejects(claim(), /permission denied/);
    await db.exec("reset role");
    await db.query("update screening_sync_queue set attempts=5,available_at=now()-interval '1 second' where application_id=$1", [id(37)]);
    await db.exec("set role service_role");
    assert.equal((await claim()).length, 0);
    assert.equal((await db.query("select state from screening_sync_queue where application_id=$1", [id(37)])).rows[0].state, "failed");
    await db.exec("reset role");
    const old = (await db.query(`select a.position_title,a.screening_answers,v.questions
      from candidate_applications a join screening_versions v on v.id=a.screening_version_id where a.id=$1`, [id(30)])).rows[0];
    assert.deepEqual(old, { position_title: "Sales Executive", screening_answers: { experience: "Entered orders" }, questions: first });
    await db.exec(queueMigration);
    assert.equal((await db.query("select state from screening_sync_queue where application_id=$1", [id(30)])).rows[0].state, "synced");
  } finally {
    await db.close();
  }
});

test("ATS sync is service-only, idempotent, identity-aware and stage-preserving", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage; create schema ats_dev;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit int,allowed_mime_types text[]);
      create table ats_dev.memberships(user_id uuid,role text,is_active boolean);
      create table ats_dev.requisitions(id uuid primary key,title text);
      create table ats_dev.candidates(id uuid primary key default gen_random_uuid(), full_name text not null,email text,phone text,application_source text);
      create table ats_dev.requisition_candidates(requisition_id uuid references ats_dev.requisitions,
        candidate_id uuid references ats_dev.candidates,stage text,candidate_outcome text,interview_disposition text,primary key(requisition_id,candidate_id));
      create table ats_dev.employment(candidate_id uuid primary key references ats_dev.candidates, employment_status text);
      insert into ats_dev.memberships values('${id(1)}','recruiter_admin',true),('${id(2)}','viewer',true);
      insert into ats_dev.requisitions values('${id(20)}','Sales'),('${id(21)}','Customer Service & Returns Specialist'),('${id(22)}','Production');
      insert into ats_dev.candidates values('${id(25)}','Synthetic Applicant','synthetic@example.test','(812) 555-0100','Manual');
      insert into ats_dev.requisition_candidates(requisition_id,candidate_id,stage) values('${id(20)}','${id(25)}','hired');
      insert into ats_dev.employment values('${id(25)}','active');`);
    await db.exec(await migration("docs/ats/ats-screening-overlay.sql"));
    const atsUpgrade = await migration("docs/ats/ats-screening-phase2.sql");
    await db.exec(atsUpgrade);
    await db.exec(atsUpgrade);
    await db.exec(await migration("docs/ats/ats-screening-rubrics.sql"));
    const rubric = defaultRubric("Sales Executive");
    const publish = (actor, requisition, version, categories) => db.query(
      "select ats_screening_publish_rubric($1,$2,$3,$4)", [requisition, actor, version, JSON.stringify(categories)]);
    await db.exec("set role authenticated");
    await assert.rejects(publish(id(1), id(20), 1, rubric.categories), /permission denied/);
    await db.exec("reset role; set role service_role");
    await assert.rejects(publish(id(2), id(20), 1, rubric.categories), error => error.code === "42501");
    await assert.rejects(publish(id(1), id(21), 1, rubric.categories), error => error.code === "42501");
    await assert.rejects(publish(id(1), id(20), 1, rubric.categories.slice(1)), error => error.code === "22023");
    await publish(id(1), id(20), 1, rubric.categories);
    await assert.rejects(publish(id(1), id(20), 1, rubric.categories), error => error.code === "40001");
    await publish(id(1), id(20), 2, rubric.categories);
    assert.deepEqual((await db.query("select version from ats_screening_rubrics order by version")).rows, [{version:2},{version:3}]);
    await db.exec("reset role");
    const source = (app, extra = {}) => ({ id: app, first_name: "Synthetic", last_name: "Applicant",
      email: "synthetic@example.test", phone: "+1 812-555-0100", position_id: id(10), screening_answers: { experience: "Order management" }, ...extra });
    const sync = async (data, manual = null, actor = id(1)) => (await db.query(
      "select ats_screening_import($1,$2,$3,$4,$5) as item",
      [actor, id(20), JSON.stringify(data), JSON.stringify({ version: 1, questions: first }), manual]
    )).rows[0].item;
    await asUser(db, 2);
    assert.equal((await db.query("select ats_screening_authorize() as actor")).rows[0].actor, null);
    await assert.rejects(sync(source(id(30)), null, null), /permission denied/);
    await assert.rejects(db.query("select * from ats_screening_cases"), /permission denied/);
    await asUser(db, 1);
    assert.equal((await db.query("select ats_screening_authorize() as actor")).rows[0].actor, id(1));
    await db.exec("reset role; set role service_role");
    await assert.rejects(sync(source(id(30)), null, id(2)), /insufficient_privilege/);
    assert.equal((await sync(source(id(30)))).candidate_id, id(25));
    assert.equal((await sync(source(id(30)))).candidate_id, id(25));
    await assert.rejects(db.query("select ats_screening_import($1,$2,$3,null,null)",
      [id(1), id(22), JSON.stringify(source(id(30)))]), /already belongs to another requisition/);
    await assert.rejects(db.query("select ats_screening_import($1,$2,$3,null,null)",
      [id(1), id(21), JSON.stringify(source(id(37)))]), /owned by the legacy engine/);
    await assert.rejects(sync(source(id(38), { position_id: "db38820b-3d0b-4018-a7b1-8012b53ba996" })), /owned by the legacy engine/);
    assert.equal((await sync(source(id(33)), null, null)).candidate_id, id(25));
    assert.equal((await sync(source(id(34), { email: "changed@example.test" }))).identity_state, "needs_review");
    await db.exec("reset role");
    await db.query("insert into ats_dev.candidates(full_name,email,phone) values('Synthetic Applicant','other@example.test','8125550100')");
    await db.exec("set role service_role");
    assert.equal((await sync(source(id(35)))).identity_state, "needs_review");
    await db.exec("reset role");
    await db.query("delete from ats_dev.candidates where email='other@example.test'");
    await db.exec("set role service_role");
    const ambiguous = source(id(31), { first_name: "Different" });
    assert.equal((await sync(ambiguous)).identity_state, "needs_review");
    assert.equal((await sync(ambiguous, id(25))).candidate_id, id(25));
    const newCandidate = source(id(32), { first_name: "Second", email: "second@example.test", phone: "8125550101", source: "indeed_followup" });
    const newId = (await sync(newCandidate)).candidate_id;
    assert.equal((await sync(newCandidate)).candidate_id, newId);
    assert.notEqual(newId, id(25));
    await db.query("insert into ats_screening_audit(application_id,actor,action) values($1,$2,'resume_access_granted')", [id(30), id(1)]);
    const args = [id(30), id(25), id(1), "private/synthetic.pdf", "digest", "synthetic.pdf"];
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await db.query("select ats_screening_record_resume($1,$2,$3,$4,$5,$6) item", args)).rows[0].item.resume_name, "synthetic.pdf");
    }
    const review = { completed: true, notes: "Checked by recruiter", interview_at: "2026-12-01T15:30:00Z", decision: "interview" };
    const save = revision => db.query("select ats_screening_save_review($1,$2,$3,$4) item", [id(1), id(30), revision, JSON.stringify(review)]);
    assert.equal((await save(0)).rows[0].item.revision, 1);
    await assert.rejects(save(0), /Review changed/);
    const legacyStatus = { interview_status: "scheduled", interview_at: "2026-12-02T15:00:00Z" };
    const refreshed = await sync(source(id(30), legacyStatus), null, null);
    assert.deepEqual(refreshed.review, review);
    assert.equal(refreshed.application.interview_status, "scheduled");
    await sync(source(id(30), legacyStatus), null, null);
    assert.equal((await db.query("select count(*)::int n from ats_screening_audit where action='source_details_refreshed' and actor is null")).rows[0].n, 1);
    const saveInterview = (application, revision) => db.query(
      "select ats_screening_save_interview_review($1,$2,$3,$4,true) item",
      [id(1), application, revision, JSON.stringify(review)]
    );
    await db.exec("reset role");
    for (const [outcome, disposition] of [["not_culture_fit", null], [null, "no_show_closed"]]) {
      await db.query("update ats_dev.requisition_candidates set candidate_outcome=$2,interview_disposition=$3 where candidate_id=$1", [newId, outcome, disposition]);
      await db.exec("set role service_role");
      await saveInterview(id(32), outcome ? 0 : 1);
      await db.exec("reset role");
      assert.equal((await db.query("select stage from ats_dev.requisition_candidates where candidate_id=$1", [newId])).rows[0].stage, "new");
    }
    await db.query("update ats_dev.requisition_candidates set candidate_outcome=null,interview_disposition=null where candidate_id=$1", [newId]);
    await db.exec("set role service_role");
    await saveInterview(id(32), 2);
    await saveInterview(id(30), 1);
    const lease = () => db.query("select ats_screening_claim_evidence($1,$2) as item", [id(30), "digest"]);
    assert.ok((await lease()).rows[0].item.lease);
    assert.equal((await lease()).rows[0].item.draft, null);
    await db.query("update ats_screening_evidence set draft='{\"experience\":[]}' where application_id=$1", [id(30)]);
    assert.deepEqual((await lease()).rows[0].item.draft, { experience: [] });
    await db.query("update ats_screening_evidence set leased_at='-infinity' where application_id=$1", [id(30)]);
    const refresh = () => db.query("select ats_screening_refresh_evidence($1,$2) as lease", [id(30), "digest"]);
    assert.ok((await refresh()).rows[0].lease);
    assert.equal((await refresh()).rows[0].lease, null);
    assert.deepEqual((await lease()).rows[0].item.draft, { experience: [] });
    await db.exec("reset role");
    assert.equal((await db.query("select stage from ats_dev.requisition_candidates where candidate_id=$1", [id(25)])).rows[0].stage, "hired");
    assert.equal((await db.query("select stage from ats_dev.requisition_candidates where candidate_id=$1", [newId])).rows[0].stage, "interview");
    assert.equal((await db.query("select employment_status from ats_dev.employment where candidate_id=$1", [id(25)])).rows[0].employment_status, "active");
    assert.equal((await db.query("select count(*)::int n from ats_dev.candidates")).rows[0].n, 2);
    assert.equal((await db.query("select count(*)::int n from ats_dev.requisition_candidates")).rows[0].n, 2);
    assert.equal((await db.query("select application_source from ats_dev.candidates where id=$1", [newId])).rows[0].application_source, "Indeed");
    assert.equal((await db.query("select count(*)::int n from ats_screening_audit where action='resume_synchronized'")).rows[0].n, 1);
    assert.equal((await db.query("select public from storage.buckets")).rows[0].public, false);
    await db.exec(atsUpgrade);
    assert.deepEqual((await db.query("select review from ats_screening_cases where application_id=$1", [id(30)])).rows[0].review, review);
  } finally {
    await db.close();
  }
});

test("all six templates use job-related prompts and exact inputs determine the evidence cache", () => {
  assert.equal(screeningTemplates.length, 6);
  for (const item of screeningTemplates) {
    assert.ok(item.questions.some(q => q.id === "essential_functions" && q.prompt.includes("reasonable accommodation")));
    for (const key of ["availability", "compensation", "transportation"]) assert.ok(item.questions.some(q => q.id === key));
  }
  assert.equal(evidenceFingerprint("bytes", first), evidenceFingerprint("bytes", first));
  assert.notEqual(evidenceFingerprint("bytes", first), evidenceFingerprint("new bytes", first));
  assert.notEqual(evidenceFingerprint("bytes", first), evidenceFingerprint("bytes", revised));
});

function syntheticPdf(stream) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let content = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const at = content.length;
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return String(at).padStart(10, "0");
  });
  const xref = content.length;
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${offset} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([content]);
}

test("resume evidence extracts PDF and DOCX text and detects image-only PDFs", async () => {
  const textPdf = syntheticPdf("BT /F1 12 Tf 36 250 Td (Synthetic order fulfillment) Tj ET");
  assert.match(await extractResumeText(textPdf, "synthetic.pdf"), /Synthetic order fulfillment/);
  assert.equal((await extractResumeText(syntheticPdf("0 0 50 50 re f"), "scanned.pdf")).trim(), "");
  const bytes = await readFile(new URL("./fixtures/synthetic-resume.docx", import.meta.url));
  assert.match(await extractResumeText(new Blob([bytes]), "synthetic.docx"), /Synthetic inventory experience/);
});

test("legacy DOC is available for manual review and only PDF or DOCX is automatically parsed", async () => {
  await assert.rejects(extractResumeText(new Blob(["synthetic"]), "resume.doc"), /manual review/);
});

test("API rejects unauthenticated and malformed requests before accessing private services", async () => {
  const reply = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler({ method: "DELETE", headers: {} }, reply);
  assert.equal(reply.code, 405);
  await handler({ method: "POST", headers: {}, body: { action: "postings" } }, reply);
  assert.equal(reply.code, 401);
  await handler({ method: "POST", headers: { authorization: "Bearer synthetic" }, body: { action: "resume", path: "other_resume.pdf" } }, reply);
  assert.equal(reply.code, 400);
});

test("recruiter bridge verifies ATS membership before copying an application resume into private storage", async t => {
  const settings = {
    VITE_SUPABASE_URL: "https://testcareersstagingaa.supabase.co",
    VITE_MARKETING_DEV_SUPABASE_URL: "https://testatstagingaaaaaaa.supabase.co",
    VITE_MARKETING_DEV_SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-careers-server",
    ATS_SCREENING_SERVICE_ROLE_KEY: "synthetic-ats-server",
    ATS_SCREENING_CRON_ENABLED: "true",
    ATS_SCREENING_STAGING_CAREERS_REF: "testcareersstagingaa",
    ATS_SCREENING_STAGING_ATS_REF: "testatstagingaaaaaaa",
    CRON_SECRET: "synthetic-screening-cron-test-secret",
    VERCEL_ENV: "preview"
  };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const router = { authorized: false, copiedPath: null, linked: null, scheduler: false, finished: [] };
  let source = { id: id(30), position_id: id(10), first_name: "Synthetic", last_name: "Applicant",
    email: "synthetic@example.test", resume_path: id(30) + "/test.pdf", screening_version_id: id(40) };
  const calls = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    const authorization = new Headers(init.headers).get("authorization");
    calls.push(url.pathname);
    if (url.pathname === "/rest/v1/rpc/ats_screening_authorize") {
      assert.equal(authorization, "Bearer synthetic-ats-session");
      return Response.json(router.authorized ? id(1) : null);
    }
    if (url.pathname !== "/rest/v1/rpc/ats_admin_requisitions") assert.equal(authorization, url.hostname === "testcareersstagingaa.supabase.co" ? "Bearer synthetic-careers-server" : "Bearer synthetic-ats-server");
    if (url.pathname === "/rest/v1/rpc/claim_screening_sync") return Response.json(router.finished.length ? [] : [
      { application_id: source.id, job_id: source.position_id, requisition_id: id(20), lease_id: id(90) }
    ]);
    if (url.pathname === "/rest/v1/rpc/finish_screening_sync") {
      router.finished.push(JSON.parse(init.body));
      return Response.json(null);
    }
    if (url.pathname === "/rest/v1/screening_positions") return Response.json([{
      sync_owner: router.owner ?? "universal", job_id: id(10), published_id: id(40), requisition_id: id(20), automation_enabled: true,
      requires_routing: Boolean(router.split), alternate_requisition_id: router.split ? id(21) : null
    }]);
    if (url.pathname === "/rest/v1/screening_application_routes") {
      return Response.json(router.destination ? [{ requisition_id: router.destination }] : []);
    }
    if (url.pathname === "/rest/v1/job_postings") return Response.json([]);
    if (url.pathname === "/rest/v1/rpc/ats_admin_requisitions") {
      assert.equal(authorization, "Bearer synthetic-ats-session");
      return Response.json({ requisitions: [] });
    }
    if (url.pathname === "/rest/v1/candidate_applications") {
      assert.equal(url.searchParams.get("id"), "eq." + source.id);
      assert.equal(url.searchParams.get("position_id"), "eq." + source.position_id);
      return Response.json([source]);
    }
    if (url.pathname === "/rest/v1/screening_versions") return Response.json([{ id: id(40), version: 1, questions: first }]);
    if (url.pathname === "/rest/v1/rpc/ats_screening_import") {
      assert.equal(JSON.parse(init.body).p_actor, router.scheduler ? null : id(1));
      return Response.json({ application_id: source.id, candidate_id: id(25), resume_path: router.duplicate ? null : router.copiedPath });
    }
    if (url.pathname === "/storage/v1/object/info/resumes/" + source.resume_path) return Response.json({ size: 10 });
    if (url.pathname === "/storage/v1/object/authenticated/resumes/" + source.resume_path ||
        url.pathname === "/storage/v1/object/resumes/" + source.resume_path) {
      return new Response("%PDF-test", { headers: { "content-type": "application/pdf" } });
    }
    if (url.pathname === "/rest/v1/ats_screening_cases") return Response.json(router.duplicate ? [{ resume_path: router.copiedPath }] : []);
    if (url.pathname.startsWith("/storage/v1/object/ats-screening-resumes/")) {
      if (init.method === "HEAD") {
        assert.equal(url.pathname.split("/ats-screening-resumes/")[1], router.copiedPath);
        return new Response(null);
      }
      assert.equal(router.duplicate, undefined);
      router.copiedPath = url.pathname.split("/ats-screening-resumes/")[1];
      assert.match(router.copiedPath, new RegExp(`^${id(25)}/[a-f0-9]{64}[.]pdf$`));
      assert.equal(new Headers(init.headers).get("x-upsert"), "false");
      assert.equal(new Headers(init.headers).get("content-type"), "application/pdf");
      assert.equal(Buffer.from(init.body).toString(), "%PDF-test");
      return Response.json({ Key: "ats-screening-resumes/" + router.copiedPath });
    }
    if (url.pathname === "/rest/v1/rpc/ats_screening_record_resume") {
      const data = JSON.parse(init.body);
      assert.equal(data.p_path, router.copiedPath);
      router.linked = { candidate_id: data.p_candidate, resume_path: data.p_path };
      return Response.json(router.linked);
    }
    throw new Error(`Unexpected synthetic request ${url.pathname}`);
  });
  const response = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  const req = { method: "POST", headers: { authorization: "Bearer synthetic-ats-session" },
    body: { action: "sync", requisitionId: id(20), applicationId: source.id } };
  await handler(req, response);
  assert.equal(response.code, 403);
  assert.deepEqual(calls, ["/rest/v1/rpc/ats_screening_authorize"]);
  router.authorized = true;
  await handler(req, response);
  assert.equal(response.code, 200);
  assert.equal(response.body.case.resume_path, router.copiedPath);
  assert.equal(router.linked.candidate_id, id(25));
  calls.length = 0;
  await handler(req, response);
  assert.equal(response.code, 200);
  assert.ok(calls.every(path => !path.startsWith("/storage/")));
  calls.length = 0;
  const worker = authorization => handler({ method: "GET", headers: { authorization } }, response);
  await worker("Bearer wrong");
  assert.equal(response.code, 401);
  assert.deepEqual(calls, []);
  const publication = { ...req, body: { action: "questionnaire", jobId: id(10),
    requisitionId: id(20), questions: first, publish: true } };
  process.env.VERCEL_ENV = "production";
  await handler(req, response);
  assert.equal(response.code, 403);
  assert.deepEqual(calls, []);
  await handler(publication, response);
  assert.equal(response.code, 403);
  assert.deepEqual(calls, []);
  await worker("Bearer " + settings.CRON_SECRET);
  assert.equal(response.code, 404);
  assert.deepEqual(calls, []);
  process.env.VERCEL_ENV = "preview";
  process.env.VITE_SUPABASE_URL = "https://ykftchggpdkmkpkbdbgs.supabase.co";
  process.env.ATS_SCREENING_STAGING_CAREERS_REF = "ykftchggpdkmkpkbdbgs";
  await handler(publication, response);
  assert.equal(response.code, 403);
  assert.deepEqual(calls, []);
  await worker("Bearer " + settings.CRON_SECRET);
  assert.equal(response.code, 503);
  assert.deepEqual(calls, []);
  process.env.VITE_SUPABASE_URL = settings.VITE_SUPABASE_URL;
  process.env.ATS_SCREENING_STAGING_CAREERS_REF = settings.ATS_SCREENING_STAGING_CAREERS_REF;
  router.scheduler = true;
  await worker("Bearer " + settings.CRON_SECRET);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body, { processed: 1, totals: { synced: 1 } });
  assert.deepEqual(router.finished, [{ p_application: source.id, p_lease: id(90), p_result: "synced" }]);
  await worker("Bearer " + settings.CRON_SECRET);
  assert.deepEqual(response.body, { processed: 0, totals: {} });
  router.finished.length = 0;
  router.owner = "legacy_returns";
  calls.length = 0;
  await worker("Bearer " + settings.CRON_SECRET);
  assert.deepEqual(response.body, { processed: 1, totals: { mapping_changed: 1 } });
  assert.ok(!calls.includes("/rest/v1/candidate_applications"));
  router.scheduler = false;
  await handler(req, response);
  assert.equal(response.code, 409);
  assert.ok(!calls.includes("/rest/v1/rpc/ats_screening_import"));
  router.owner = "universal";
  router.duplicate = true;
  source = { ...source, id: id(31), resume_path: id(31) + "/resubmission.pdf" };
  await handler({ ...req, body: { ...req.body, applicationId: source.id } }, response);
  assert.equal(response.code, 200);
  assert.equal(response.body.case.resume_path, router.copiedPath);
  router.split = true;
  calls.length = 0;
  const combined = { ...req, body: { ...req.body, applicationId: source.id } };
  await handler(combined, response);
  assert.equal(response.code, 409);
  assert.ok(!calls.includes("/rest/v1/rpc/ats_screening_import"));
  router.destination = id(21);
  await handler(combined, response);
  assert.equal(response.code, 409);
  assert.ok(!calls.includes("/rest/v1/rpc/ats_screening_import"));
  await handler({ ...req, body: { action: "questionnaire", jobId: "6702d7a6-3c34-4b13-9fba-d86b67b419ec",
    requisitionId: id(20), questions: first, publish: true } }, response);
  assert.equal(response.code, 404);
  assert.ok(!calls.includes("/rest/v1/rpc/write_screening_routing"));
});

test("evidence calls use job criteria and retain only source-backed experience quotes", async t => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldBase = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_API_KEY = "synthetic-inference-key";
  process.env.OPENAI_BASE_URL = "https://inference.example.test/v1";
  t.after(() => {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
    if (oldBase === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = oldBase;
  });
  const rubric = defaultRubric("Sales Executive");
  let called = 0;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    called++;
    assert.equal(new URL(input).hostname, "inference.example.test");
    const request = JSON.parse(init.body);
    assert.equal(request.store, false);
    const user = JSON.parse(request.messages.find(message => message.role === "user").content);
    assert.deepEqual(user.role_criteria, called === 1 ? [first[0].prompt] : rubric.categories);
    assert.equal(user.resume.includes("contact@example.test"), false);
    assert.equal(user.resume.includes("812-555-0100"), false);
    const content = {
      experience: [{ observation: "Handled orders", quote: "Entered orders" },
        { observation: "Invented experience", quote: "Managed 100 reports" }],
      missing_information: ["Experience verifying discrepancies"],
      interview_questions: ["How did you verify order accuracy?"]
    };
    if (called === 2) content.categories = [
      { id: "discovery", score: 20, quote: "Entered orders" },
      { id: "sales", score: 29, quote: "Invented quote" },
      { id: "systems", score: 99, quote: "Entered orders" },
      { id: "communication", score: 15, quote: "[email removed]" }
    ];
    return Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) } }] });
  });
  const draft = await generateEvidence("Entered orders. contact@example.test 812-555-0100", { questions: revised });
  assert.deepEqual(draft.experience, [{ observation: "Handled orders", quote: "Entered orders" }]);
  assert.equal(draft.interview_questions.length, 1);
  const weighted = await generateEvidence("Entered orders. contact@example.test", null, rubric);
  assert.equal(validCategories(rubric.categories), true);
  const points = Object.fromEntries(weighted.categories.map(item => [item.id, item.score]));
  assert.deepEqual(points, { discovery: 20, sales: null, systems: null, communication: null });
  assert.deepEqual(scoreSummary(rubric, points), { points: 20, covered: 30, total: null });
  assert.equal(called, 2);
});

test("combined postings wait for one immutable route and the worker skips unapproved mappings", async () => {
  const db = await createReferralDb();
  try {
    await db.exec(`reset role; create role service_role bypassrls;
      alter table job_postings add column created_at timestamptz default now(), add column hours text,
        add column pay text, add column location text, add column description text;
      alter table candidate_applications add column resume_path text, add column phone text, add column created_at timestamptz default now();
      update job_postings set title='Warehouse Picker/Packer' where id='${id(10)}';
      update job_postings set title='Customer Service & Returns Specialist — Compliance Support' where id='${id(11)}';`);
    for (const filename of [
      "20261124000000_screening_questionnaires.sql", "20261124010000_screening_sync_queue.sql",
      "20261124020000_screening_routing.sql", "20261124030000_screening_sync_ownership.sql"
    ]) await db.exec(await migration("supabase/migrations/" + filename));
    const write = (job, req, alternate) => db.query("select write_screening_routing($1,$2,$3,$4,true,$5)",
      [job, req, JSON.stringify(first), id(1), alternate]);
    const choose = (app, job, req) => db.query("select select_screening_application_route($1,$2,$3,$4)",
      [app, job, req, id(1)]);
    const list = async req => (await db.query("select list_routed_screening_applicants($1,$2,0) result", [id(10), req])).rows[0].result;
    const claim = async () => (await db.query("select * from claim_screening_sync(8)")).rows;
    await db.exec("set role service_role");
    await assert.rejects(write(id(99), id(20), id(21)), /Invalid posting/);
    await assert.rejects(write(id(10), id(20), null), /distinct destinations/);
    await assert.rejects(write(id(10), id(20), id(20)), /Invalid posting/);
    await write(id(10), id(20), id(21));
    await assert.rejects(write(id(11), id(21), null), /only one posting/);
    await write(id(11), id(22), null);
    await db.exec("reset role");
    for (const [app, job] of [[30, 10], [31, 11]]) {
      await db.query(`insert into candidate_applications(id,first_name,last_name,email,position_id,position_title,status)
        values($1,'Synthetic','Applicant',$2,$3,'Test','new')`, [id(app), `app${app}@example.test`, id(job)]);
    }
    await asUser(db, null);
    await assert.rejects(choose(id(30), id(10), id(21)), /permission denied/);
    await db.exec("reset role; set role service_role");
    assert.equal((await list(id(20))).total, 1);
    assert.equal((await list(id(21))).total, 0);
    assert.deepEqual(await claim(), []);
    await db.exec("reset role");
    await db.query("update screening_positions set automation_enabled=true");
    assert.equal((await db.query("select automation_enabled,sync_owner from screening_positions where job_id=$1", [id(11)])).rows[0].automation_enabled, false);
    assert.equal((await db.query("select count(*)::int n from screening_sync_queue where application_id=$1", [id(31)])).rows[0].n, 0);
    await db.exec("set role service_role");
    assert.deepEqual(await claim(), []);
    await assert.rejects(choose(id(30), id(11), id(22)), /Unverified/);
    await assert.rejects(choose(id(30), id(10), id(22)), /Unverified/);
    await choose(id(30), id(10), id(21));
    await choose(id(30), id(10), id(21));
    await assert.rejects(choose(id(30), id(10), id(20)), /already has a destination/);
    assert.equal((await list(id(20))).total, 0);
    assert.equal((await list(id(21))).applications[0].routed_requisition_id, id(21));
    const [leased] = await claim();
    assert.equal(leased.requisition_id, id(21));
    assert.deepEqual(await claim(), []);
    await db.query("select finish_screening_sync($1,$2,'synced')", [leased.application_id, leased.lease_id]);
    assert.deepEqual(await claim(), []);
    const manifest = JSON.parse(await migration("docs/ats/screening-position-mapping.json"));
    const warehouse = manifest.positions.find(item => item.position.startsWith("Warehouse Middle"));
    assert.equal(warehouse.existingEnvironment.careersPostingId, "6702d7a6-3c34-4b93-9fba-d86b67b419ec");
    assert.ok(manifest.positions.every(item => item.staging.careersPostingId === null));
  } finally {
    await db.close();
  }
});

test("ownership upgrade quarantines existing Returns rows and fences outstanding leases", async () => {
  const db = await createReferralDb();
  try {
    await db.exec(`reset role; create role service_role bypassrls;
      alter table job_postings add column created_at timestamptz default now(), add column hours text,
        add column pay text, add column location text, add column description text;
      alter table candidate_applications add column resume_path text, add column phone text, add column created_at timestamptz default now();
      update job_postings set title='Customer Service & Returns Specialist — Compliance Support' where id='${id(11)}';`);
    for (const filename of [
      "20261124000000_screening_questionnaires.sql", "20261124010000_screening_sync_queue.sql",
      "20261124020000_screening_routing.sql"
    ]) await db.exec(await migration("supabase/migrations/" + filename));
    for (const [job, req] of [[10, 20], [11, 21]]) {
      await db.query("select write_screening_routing($1,$2,$3,$4,true,null)", [id(job), id(req), JSON.stringify(first), id(1)]);
    }
    const submit = (app, job) => db.query(`
      insert into candidate_applications(id,first_name,last_name,email,position_id,position_title,status)
      values($1,'Synthetic','Applicant',$2,$3,'Fixture','new')`, [id(app), `app${app}@example.test`, id(job)]);
    await submit(30, 11);
    await submit(31, 11);
    await submit(32, 10);
    await db.query("update screening_sync_queue set attempts=3,lease_id=$2,available_at=now()-interval '1 hour',error_code='retry' where application_id=$1", [id(30), id(90)]);
    await db.query("update screening_sync_queue set state='synced' where application_id=$1", [id(31)]);
    await db.exec("update screening_positions set automation_enabled=true");
    const originals = (await db.query("select * from screening_sync_queue order by application_id")).rows;
    await db.exec(await migration("supabase/migrations/20261124030000_screening_sync_ownership.sql"));
    const snapshot = async () => (await db.query("select * from screening_sync_queue order by application_id")).rows;
    const upgraded = await snapshot();
    assert.deepEqual(upgraded.map(({ legacy_quarantined_at, ...row }) => row), originals);
    assert.ok(upgraded[0].legacy_quarantined_at && upgraded[1].legacy_quarantined_at);
    assert.equal(upgraded[2].legacy_quarantined_at, null);
    await db.exec("set role service_role");
    await db.query("select finish_screening_sync($1,$2,'synced')", [id(30), id(90)]);
    const leased = (await db.query("select * from claim_screening_sync(8)")).rows;
    assert.deepEqual(leased.map(row => row.application_id), [id(32)]);
    await db.exec("reset role");
    await submit(33, 11);
    await db.query("update candidate_applications set resume_path='synthetic/changed.pdf' where id=$1", [id(30)]);
    assert.deepEqual((await snapshot()).slice(0, 2), upgraded.slice(0, 2));
    assert.equal((await snapshot()).length, 3);
  } finally {
    await db.close();
  }
});

test("isolated screening configuration rejects live refs, swapped lab ports and nonfixture inference", () => {
  const careersRef = "testcareersstagingaa";
  const atsRef = "testatstagingaaaaaaa";
  const preview = { VERCEL_ENV: "preview", ATS_SCREENING_STAGING_CAREERS_REF: careersRef,
    ATS_SCREENING_STAGING_ATS_REF: atsRef, VITE_SUPABASE_URL: `https://${careersRef}.supabase.co`,
    VITE_MARKETING_DEV_SUPABASE_URL: `https://${atsRef}.supabase.co` };
  assert.equal(screeningIsolationError(preview), null);
  for (const ref of ["ykftchggpdkmkpkbdbgs", "ofmqhrcmdrdrnvtnykyq"]) {
    assert.ok(screeningIsolationError({ ...preview, ATS_SCREENING_STAGING_CAREERS_REF: ref,
      VITE_SUPABASE_URL: `https://${ref}.supabase.co` }));
  }
  assert.ok(screeningIsolationError({ VERCEL: "1" }));
  const lab = { ATS_SCREENING_LOCAL_MODE: "true", ATS_SCREENING_LAB_RUN: "a".repeat(32),
    VITE_SUPABASE_URL: labCareersUrl, VITE_MARKETING_DEV_SUPABASE_URL: labAtsUrl,
    OPENAI_API_KEY: labInferenceKey, OPENAI_BASE_URL: labInferenceUrl };
  assert.equal(screeningIsolationError(lab), null);
  assert.ok(screeningIsolationError({ ...lab, VITE_SUPABASE_URL: labAtsUrl }));
  assert.ok(screeningIsolationError({ ...lab, OPENAI_BASE_URL: "https://api.openai.com/v1" }));
  assert.ok(screeningIsolationError({ ...lab, OPENAI_API_KEY: "nonfixture" }));
  assert.ok(screeningIsolationError({ ...lab, VERCEL_ENV: "preview" }));
  assert.ok(screeningIsolationError({ ...lab, ATS_SCREENING_LOCAL_MODE: "false" }));
  assert.ok(screeningIsolationError({ ...lab, ATS_SCREENING_CRON_ENABLED: "true" }));
  assert.ok(screeningIsolationError(lab, true));
});
