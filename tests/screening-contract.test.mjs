import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { compareContract, interviewArguments } from "../scripts/screening-lab/contract.mjs";
import { readReviewedBaseline } from "../scripts/screening-lab/reviewed-baseline.mjs";

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
