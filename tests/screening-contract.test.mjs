import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { compareContract, interviewArguments } from "../scripts/screening-lab/contract.mjs";
import { readReviewedBaseline } from "../scripts/screening-lab/reviewed-baseline.mjs";

test("lab startup diagnostics retain fixed signals without raw database or key material", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "orion-startup-diagnostic-"));
  try {
    await writeFile(join(scratch, "careers.start.log"), [
      "ReadyForQuery",
      "Initialising schema...",
      "Elixir.Realtime.Repo DBConnection.ConnectionError secret=synthetic-secret-marker",
      "failed to prune volumes: a prune operation is already running",
      "SQLSTATE 28P01 arbitrary SQL marker"
    ].join("\n"));
    await writeFile(join(scratch, "careers.events"), [
      "start docker.io/supabase/storage-api:v1.54.1 ",
      "die docker.io/supabase/storage-api:v1.54.1 0",
      "start supabase/gotrue:v2.188.1 ",
      "die supabase/gotrue:v2.188.1 1",
      "start unrelated-image synthetic-secret-marker"
    ].join("\n"));
    const result = execFileSync(process.execPath,
      ["scripts/screening-lab/startup-checks.mjs", "report", scratch, "careers Supabase initialization"],
      { encoding: "utf8" });
    assert.match(result, /PostgreSQL ReadyForQuery/);
    assert.match(result, /Realtime\/PostgreSQL connection failure/);
    assert.match(result, /another active prune/);
    assert.match(result, /SQLSTATE 28P01/);
    assert.match(result, /Storage container die \(exit 0\)/);
    assert.match(result, /Auth container die \(exit 1\)/);
    assert.doesNotMatch(result, /unrelated-image/);
    assert.doesNotMatch(result, /synthetic-secret-marker|arbitrary SQL marker/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("ATS catalog gate detects time signature drift, absent browser RPCs and unusable conflict keys", () => {
  const rpc = { name: "ats_admin_create_interview", arguments: interviewArguments.replaceAll("_time text", "_time time"),
    inputs: interviewArguments.split(", ").map(argument => argument.split(" ")[0]), result: "uuid",
    authenticatedExecute: true, anonExecute: false };
  const snapshot = { tables: { requisition_candidates: { columns: { stage: {} }, conflictKeys: [["candidate_id"]] } }, rpcs: [rpc] };
  assert.ok(compareContract(snapshot).blockers.some(issue => issue.includes("text-time")));
  assert.ok(compareContract(snapshot).blockers.some(issue => issue.includes("ON CONFLICT")));
  assert.ok(compareContract(snapshot).blockers.some(issue => issue.includes("ats_admin_record_resume")));
  rpc.arguments = interviewArguments;
  snapshot.tables.requisition_candidates.conflictKeys = [["candidate_id", "requisition_id"]];
  assert.ok(compareContract(snapshot).blockers.every(issue => !issue.includes("text-time") && !issue.includes("ON CONFLICT")));
  snapshot.rpcs.push({ ...rpc, inputs: [...rpc.inputs, "p_optional"], optionalInputs: 1 });
  assert.ok(compareContract(snapshot).blockers.some(issue => issue.includes("ambiguous") && issue.includes(rpc.name)));
});

test("reviewed SQL replay requires private files outside the checkout and exactly the reviewed bytes", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "orion-reviewed-fixture-"));
  try {
    const path = join(scratch, "baseline.sql");
    const ddl = "create schema synthetic_ats;\n";
    const env = sql => ({ ORION_ATS_REVIEWED_SQL: path, ORION_ATS_REVIEWED_SHA256: createHash("sha256").update(sql).digest("hex") });
    await writeFile(path, ddl, { mode: 0o600 });
    assert.equal(await readReviewedBaseline({}), null);
    assert.equal(await readReviewedBaseline(env(ddl)), ddl);
    await assert.rejects(readReviewedBaseline(env(ddl), scratch), /outside the repository/);
    await assert.rejects(readReviewedBaseline(env("changed")), /approved schema-only SHA-256/);
    const command = "\\connect other_database\n";
    await writeFile(path, command);
    await assert.rejects(readReviewedBaseline(env(command)), /without psql commands/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("catalog SQL reports the live-style interview shape while omitting candidate values and function bodies", async () => {
  const db = await PGlite.create();
  const file = path => readFile(new URL(path, import.meta.url), "utf8");
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit int,allowed_mime_types text[]);
      create table storage.objects(bucket_id text);
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
    await db.exec(await file("../scripts/screening-lab/ats-fixture.sql"));
    await db.exec(`insert into ats_dev.candidates(full_name) values('synthetic-row-marker');
      create function public.ats_admin_inventory_test(p_optional text default 'synthetic-default-marker')
        returns text language sql as $$select 'synthetic-body-marker'::text$$;`);
    const results = await db.exec(await file("../docs/ats/ats-contract-metadata.sql"));
    const snapshot = results.flatMap(result => result.rows).map(row => row.jsonb_build_object).find(Boolean);
    assert.ok(snapshot);
    const interview = snapshot.rpcs.find(rpc => rpc.name === "ats_admin_create_interview");
    assert.equal(interview.arguments, interviewArguments);
    assert.equal(interview.authenticatedExecute, true);
    assert.equal(snapshot.rpcs.find(rpc => rpc.name === "ats_admin_inventory_test").optionalInputs, 1);
    assert.ok(snapshot.tables.requisition_candidates.conflictKeys.some(key => key.join(",") === "candidate_id,requisition_id"));
    assert.doesNotMatch(JSON.stringify(snapshot), /synthetic-(row|default|body)-marker/);
  } finally {
    await db.close();
  }
});

test("catalog security gate rejects dangerous grants and unexpected overloads", async () => {
  const { compareSecurity } = await import("../scripts/screening-lab/contract.mjs");
  const deny = { SELECT: false, INSERT: false, UPDATE: false, DELETE: false };
  const snapshot = {
    anonSchemaUsage: true,
    tables: { candidate_resumes: { rls: false, crud: { anon: deny, authenticated: { ...deny, SELECT: true } } } },
    rpcs: [
      { name: "ats_admin_create_interview", arguments: "unsafe overload", securityDefiner: true, anonExecute: true, authenticatedExecute: true },
      { name: "ats_service_sync_returns", arguments: "jsonb", anonExecute: false, authenticatedExecute: true, serviceExecute: true },
      { name: "ats_service_returns_resume_imported", arguments: "uuid", anonExecute: false, authenticatedExecute: false, serviceExecute: true }
    ]
  };
  const blockers = compareSecurity(snapshot);
  assert.ok(blockers.some(issue => issue.includes("USAGE")));
  assert.ok(blockers.some(issue => issue.includes("authenticated SELECT on ats_dev.candidate_resumes")));
  assert.ok(blockers.some(issue => issue.includes("unsafe overload")));
  assert.ok(blockers.some(issue => issue.includes("ats_service_sync_returns")));
  assert.ok(!blockers.some(issue => issue.includes("ats_service_returns_resume_imported")));
});

test("operational mapping inventory contains distinct UUIDs and keeps fixture and Picker/Packer identities separate", async () => {
  const { postings, requisitions } = await import("../scripts/screening-lab/dataset.mjs");
  const manifest = JSON.parse(await readFile(new URL("../docs/ats/screening-position-mapping.json", import.meta.url), "utf8"));
  const jobs = manifest.positions.map(position => position.existingEnvironment.careersPostingId);
  const targets = manifest.positions.flatMap(position => position.existingEnvironment.atsRequisitionIds);
  assert.equal(jobs.length, 6);
  assert.equal(targets.length, 7);
  assert.equal(new Set([...jobs, ...targets]).size, 13);
  for (const value of [...jobs, ...targets]) assert.match(value, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const fixtureIds = new Set([...postings.map(posting => posting.id), ...requisitions.map(req => req.id)]);
  assert.ok([...jobs, ...targets].every(value => !fixtureIds.has(value)));
  for (const position of manifest.positions) {
    const split = position.position === "Warehouse Picker/Packer";
    assert.equal(position.routing, split ? "recruiter_selects_one" : "direct");
    assert.equal(position.existingEnvironment.atsRequisitionIds.length, split ? 2 : 1);
    assert.equal(position.staging.careersPostingId, null);
    assert.deepEqual(position.staging.atsRequisitionIds, split ? [null, null] : [null]);
    if (split) {
      assert.deepEqual(position.requisitionTitleOrder, ["Warehouse Picker", "Warehouse Packer"]);
      assert.deepEqual(position.existingEnvironment.atsRequisitionIds,
        ["26e586a6-e810-48b9-b396-c3c2a1edaf34", "8b0b82d8-b6b5-451f-866c-e1b81ad15384"]);
    }
  }
});
