import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readReviewedBaseline } from "./reviewed-baseline.mjs";
import { postings } from "./dataset.mjs";

const [root, run] = process.argv.slice(2);
assert.match(run, /^[a-f0-9]{32}$/);
const reviewed = await readReviewedBaseline();
console.log(reviewed ? "Preparing approved schema-only ATS replay" : "Preparing synthetic ATS fixture replay");
const file = path => readFile(new URL(path, import.meta.url), "utf8");
const migration = filename => file(`../../supabase/migrations/${filename}.sql`);
const sqlString = value => "'" + value.replaceAll("'", "''") + "'";
const fixturePostings = "insert into public.job_postings(id,title,department,location,hours,pay,description) values\n" +
  postings.map(posting => [posting.id, posting.title, posting.title === "Sales Executive" ? "Sales" : "Synthetic",
    "Fixture only", "Fixture schedule", "Fixture pay", "Synthetic screening fixture."].map(sqlString))
    .map(fields => "(" + fields.join(",") + ")").join(",\n") + ";";

for (const [realm, port] of [["careers", 56321], ["ats", 57321]]) {
  const project = join(root, realm, "supabase");
  const dir = join(project, "migrations");
  await mkdir(dir, { recursive: true });
  await writeFile(join(project, "config.toml"), `project_id = "orion_lab_${realm}_${run.slice(0, 12)}"

[api]
port = ${port}
schemas = ["public"]

[db]
port = ${port + 1}
shadow_port = ${port - 1}
major_version = 17

[db.seed]
enabled = false

[studio]
enabled = false

[inbucket]
enabled = false

[analytics]
enabled = false

[edge_runtime]
enabled = false

[auth]
site_url = "http://127.0.0.1:5587"
enable_signup = false
signing_keys_path = "./signing_keys.json"
`);
  await writeFile(join(project, "signing_keys.json"), "[]\n");
  const sources = realm === "careers" ? [
    await migration("20260522000000_careers_setup"), await file("./careers-fixture.sql"), fixturePostings,
    await migration("20261028080000_add_candidate_campaign_attribution"),
    await migration("20261116135929_sales_employee_referrals"),
    await migration("20261124000000_screening_questionnaires"),
    await migration("20261124010000_screening_sync_queue"),
    await migration("20261124020000_screening_routing")
  ] : [
    reviewed ?? await file("./ats-fixture.sql"), await file("../../docs/ats/ats-screening-overlay.sql"),
    await file("../../docs/ats/ats-screening-phase2.sql"), await file("./ats-lab-adapters.sql")
  ];
  sources.push(`create function public.screening_lab_identity() returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('realm','${realm}','run','${run}')
$$;
revoke all on function public.screening_lab_identity() from public,anon,authenticated;
grant execute on function public.screening_lab_identity() to service_role;
`);
  for (const [index, source] of sources.entries()) {
    await writeFile(join(dir, `200001010000${String(index).padStart(2, "0")}_lab.sql`), source);
  }
}
