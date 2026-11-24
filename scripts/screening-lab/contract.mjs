import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const columns = {
  requisitions: ["id", "title", "status"],
  candidates: ["id", "full_name", "email", "phone", "application_source"],
  interviews: ["id", "candidate_id", "position_title", "interview_date", "start_time", "end_time",
    "interview_format", "interview_stage", "attendance_status", "source_event"],
  candidate_resumes: ["candidate_id", "storage_path", "original_name", "uploaded_at"],
  memberships: ["user_id", "role", "is_active", "created_at"],
  requisition_candidates: ["requisition_id", "candidate_id", "stage", "candidate_outcome",
    "interview_disposition", "counts_toward_openings"]
};
const recruiterRpcs = {
  ats_admin_directory: [],
  ats_admin_requisitions: [],
  ats_admin_create_interview: ["p_candidate_id", "p_position_title", "p_interview_date", "p_start_time",
    "p_end_time", "p_interview_format", "p_interview_stage"],
  ats_admin_update_attendance: ["p_interview_id", "p_attendance"],
  ats_admin_hiring_managers: [],
  ats_admin_save_manager_feedback: ["p_interview_id", "p_manager_id", "p_notes", "p_manager_feedback", "p_rating"],
  ats_admin_manager_feedback_labels: ["p_candidate_id"],
  ats_admin_resumes: ["p_candidate_id"],
  ats_admin_record_resume: ["p_candidate_id", "p_path", "p_name"]
};
export const interviewArguments = "p_candidate_id uuid, p_position_title text, p_interview_date date, p_start_time text, p_end_time text, p_interview_format text, p_interview_stage text";

export function compareContract(snapshot) {
  if (!snapshot?.tables || !Array.isArray(snapshot.rpcs)) throw new Error("Expected the ATS catalog metadata JSON object.");
  const blockers = [];
  const review = [];
  for (const [name, expected] of Object.entries(columns)) {
    const table = snapshot.tables[name];
    if (!table) {
      blockers.push(`Missing ats_dev.${name}`);
      continue;
    }
    const missing = expected.filter(column => !Object.hasOwn(table.columns ?? {}, column));
    if (missing.length) blockers.push(`Missing ats_dev.${name} columns: ${missing.join(", ")}`);
  }
  for (const [table, inserted] of [
    ["candidates", ["full_name", "email", "phone", "application_source"]],
    ["requisition_candidates", ["requisition_id", "candidate_id", "stage"]]
  ]) {
    const implicit = Object.entries(snapshot.tables[table]?.columns ?? {}).filter(([name, column]) =>
      !inserted.includes(name) && column.notNull && !column.hasDefault && !column.identity && !column.generated);
    if (implicit.length) review.push(`Verify BEFORE INSERT population of ats_dev.${table}: ${implicit.map(([name]) => name).join(", ")}.`);
  }
  const assignment = snapshot.tables.requisition_candidates;
  if (!assignment?.conflictKeys?.some(key => key?.join(",") === "candidate_id,requisition_id")) {
    blockers.push("No usable unique key for ON CONFLICT (requisition_id,candidate_id).");
  }
  for (const [name, args] of Object.entries(recruiterRpcs)) {
    const matches = snapshot.rpcs.filter(rpc => rpc.name === name && Array.isArray(rpc.inputs)
      && args.every(arg => rpc.inputs.includes(arg))
      && rpc.inputs.slice(0, rpc.inputs.length - (rpc.optionalInputs ?? 0)).every(arg => args.includes(arg)));
    if (matches.length !== 1 || !matches[0].authenticatedExecute) {
      blockers.push(`Missing, ambiguous, or unavailable authenticated RPC: ${name}`);
      continue;
    }
    const [rpc] = matches;
    if (name === "ats_admin_create_interview" &&
        (rpc.arguments !== interviewArguments || rpc.result !== "uuid")) {
      blockers.push("Interview RPC signature differs from the reported text-time UUID contract.");
    }
    if (rpc.anonExecute) review.push(`Review the in-function anonymous access guard for ${name}.`);
  }
  return { blockers, review };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snapshot = JSON.parse(await readFile(process.argv[2], "utf8"));
  const report = compareContract(snapshot);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.blockers.length ? 1 : 0;
}
