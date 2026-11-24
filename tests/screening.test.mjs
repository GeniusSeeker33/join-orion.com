import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { extractResumeText, evidenceFingerprint } from "../api/_lib/screening-evidence.js";
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
      alter table public.candidate_applications add column resume_path text, add column phone text;`);
    await db.exec(await migration("supabase/migrations/20261124000000_screening_questionnaires.sql"));
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
    const old = (await db.query(`select a.position_title,a.screening_answers,v.questions
      from candidate_applications a join screening_versions v on v.id=a.screening_version_id where a.id=$1`, [id(30)])).rows[0];
    assert.deepEqual(old, { position_title: "Sales Executive", screening_answers: { experience: "Entered orders" }, questions: first });
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
      create table ats_dev.requisitions(id uuid primary key);
      create table ats_dev.candidates(id uuid primary key default gen_random_uuid(), full_name text not null,email text,phone text,application_source text);
      create table ats_dev.requisition_candidates(requisition_id uuid references ats_dev.requisitions,
        candidate_id uuid references ats_dev.candidates,stage text,primary key(requisition_id,candidate_id));
      create table ats_dev.employment(candidate_id uuid primary key references ats_dev.candidates, employment_status text);
      insert into ats_dev.memberships values('${id(1)}','recruiter_admin',true),('${id(2)}','viewer',true);
      insert into ats_dev.requisitions values('${id(20)}'),('${id(21)}');
      insert into ats_dev.candidates values('${id(25)}','Synthetic Applicant','synthetic@example.test','(812) 555-0100','Manual');
      insert into ats_dev.requisition_candidates values('${id(20)}','${id(25)}','hired');
      insert into ats_dev.employment values('${id(25)}','active');`);
    await db.exec(await migration("docs/ats/ats-screening-overlay.sql"));
    const source = (app, extra = {}) => ({ id: app, first_name: "Synthetic", last_name: "Applicant",
      email: "synthetic@example.test", phone: "+1 812-555-0100", position_id: id(10), screening_answers: { experience: "Order management" }, ...extra });
    const sync = async (data, manual = null, actor = id(1)) => (await db.query(
      "select ats_screening_import($1,$2,$3,$4,$5) as item",
      [actor, id(20), JSON.stringify(data), JSON.stringify({ version: 1, questions: first }), manual]
    )).rows[0].item;
    await asUser(db, 2);
    assert.equal((await db.query("select ats_screening_authorize() as actor")).rows[0].actor, null);
    await assert.rejects(sync(source(id(30))), /permission denied/);
    await assert.rejects(db.query("select * from ats_screening_cases"), /permission denied/);
    await asUser(db, 1);
    assert.equal((await db.query("select ats_screening_authorize() as actor")).rows[0].actor, id(1));
    await db.exec("reset role; set role service_role");
    await assert.rejects(sync(source(id(30)), null, id(2)), /insufficient_privilege/);
    assert.equal((await sync(source(id(30)))).candidate_id, id(25));
    assert.equal((await sync(source(id(30)))).candidate_id, id(25));
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
    assert.deepEqual((await sync(source(id(30)))).review, review);
    const lease = () => db.query("select ats_screening_claim_evidence($1,$2) as item", [id(30), "digest"]);
    assert.ok((await lease()).rows[0].item.lease);
    assert.equal((await lease()).rows[0].item.draft, null);
    await db.query("update ats_screening_evidence set draft='{\"experience\":[]}' where application_id=$1", [id(30)]);
    assert.deepEqual((await lease()).rows[0].item.draft, { experience: [] });
    await db.exec("reset role");
    assert.equal((await db.query("select stage from ats_dev.requisition_candidates where candidate_id=$1", [id(25)])).rows[0].stage, "hired");
    assert.equal((await db.query("select employment_status from ats_dev.employment where candidate_id=$1", [id(25)])).rows[0].employment_status, "active");
    assert.equal((await db.query("select count(*)::int n from ats_dev.candidates")).rows[0].n, 2);
    assert.equal((await db.query("select application_source from ats_dev.candidates where id=$1", [newId])).rows[0].application_source, "Indeed");
    assert.equal((await db.query("select count(*)::int n from ats_screening_audit where action='resume_synchronized'")).rows[0].n, 1);
    assert.equal((await db.query("select public from storage.buckets")).rows[0].public, false);
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

test("resume evidence extracts text from a synthetic PDF", async () => {
  const stream = "BT /F1 12 Tf 36 250 Td (Synthetic order fulfillment) Tj ET";
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
  assert.match(await extractResumeText(new Blob([content]), "synthetic.pdf"), /Synthetic order fulfillment/);
});

test("legacy DOC is available for manual review and only PDF or DOCX is automatically parsed", async () => {
  await assert.rejects(extractResumeText(new Blob(["synthetic"]), "resume.doc"), /manual review/);
});

test("API rejects unauthenticated and malformed requests before accessing private services", async () => {
  const reply = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler({ method: "GET", headers: {} }, reply);
  assert.equal(reply.code, 405);
  await handler({ method: "POST", headers: {}, body: { action: "postings" } }, reply);
  assert.equal(reply.code, 401);
  await handler({ method: "POST", headers: { authorization: "Bearer synthetic" }, body: { action: "resume", path: "other_resume.pdf" } }, reply);
  assert.equal(reply.code, 400);
});
