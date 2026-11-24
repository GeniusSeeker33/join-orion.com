import { demoReturnsRequisition, legacyDraft, legacyResume, seedReturns } from "./returns-fixtures.js";
import { assessmentResponse } from "./assessment-fixtures.js";
import { postings as fixturePostings, requisitions as fixtureRequisitions } from "../../scripts/screening-lab/dataset.mjs";

import { defaultRubric, validCategories } from "../../src/components/screening/rubrics.js";

const storageKey = "orion-screening-demonstration-v1";
const postings = fixturePostings.slice(1).map(posting => ({
  ...posting, description: "Synthetic posting for recruiter demonstration.", is_active: true
}));
const requisitions = fixtureRequisitions.slice(1).map(item => ({
  ...item, department: "Operations", status: "open", openings: 3
}));
const recruiter = { access_token: "demo-only", user: { email: "recruiter@example.test" } };
const candidateName = item => item.first_name + " " + item.last_name;
const applicationDate = index => new Date(Date.UTC(2027, 0, 3 + index, 15)).toISOString();

function seed() {
  const positions = {};
  const versions = {};
  const applications = [];
  const routes = {};
  const cases = {};
  const candidates = [];
  const assignments = [];
  for (const posting of postings) {
    const questionnaire = { id: posting.id + "-v1", job_id: posting.id, title: posting.title,
      version: 1, questions: posting.questions };
    versions[questionnaire.id] = questionnaire;
    positions[posting.id] = {
      job_id: posting.id, requisition_id: posting.requisition, alternate_requisition_id: posting.alternate ?? null,
      requires_routing: Boolean(posting.alternate), draft: posting.questions, published_id: questionnaire.id
    };
    for (const destination of [posting.requisition, posting.alternate].filter(Boolean)) {
      const title = requisitions.find(req => req.id === destination).title;
      for (const suffix of ["A", "B", ...(posting.alternate && destination === posting.requisition ? ["Routing"] : [])]) {
        const id = destination + "-" + suffix;
        const application = {
          id, first_name: "Synthetic", last_name: title + " " + suffix,
          position_id: posting.id, position_title: title, screening_version_id: questionnaire.id,
          email: "applicant-" + (applications.length + 1) + "@example.test", phone: "202-555-0100",
          created_at: applicationDate(applications.length),
          screening_answers: Object.fromEntries(posting.questions.map(({ id }) => [id,
            assessmentResponse(title, id, destination + "-" + suffix)]))
        };
        applications.push(application);
        if (suffix === "Routing") continue;
        if (posting.alternate) routes[id] = destination;
        if (suffix === "A") {
          const candidate = registerCandidate({ candidates, assignments }, application, destination);
          cases[id] = newCase(application, candidate, destination, questionnaire);
        }
      }
    }
  }
  return { positions, versions, applications, routes, cases, candidates, assignments, interviews: [], drafts: {} };
}

function registerCandidate(state, application, destination) {
  const id = application.id + "-candidate";
  let candidate = state.candidates.find(item => item.id === id);
  if (!candidate) {
    candidate = { id, full_name: candidateName(application), email: application.email, phone: application.phone };
    state.candidates.push(candidate);
    state.assignments.push({ candidate_id: id, requisition_id: destination, stage: "new" });
  }
  return candidate;
}

function newCase(application, candidate, destination, questionnaire) {
  return { application_id: application.id, requisition_id: destination, candidate_id: candidate.id,
    application, questionnaire, resume_path: "demo/sample-resume.txt", resume_name: "synthetic-resume.txt",
    identity_state: "linked", revision: 0, review: {} };
}

function read() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return seedReturns(seed());
  const state = JSON.parse(saved);
  state.applications.forEach((application, index) => {
    application.created_at ??= applicationDate(index);
    const snapshot = state.cases[application.id]?.application;
    if (snapshot) snapshot.created_at ??= application.created_at;
    for (const [id, value] of Object.entries(application.screening_answers ?? {})) {
      const priorFixture = value === "Sample response for " + id + "." ||
        value === "I documented the checklist, flagged discrepancies and verified the handoff before release." ||
        value === "I assisted a lead on the task and asked them to verify the result before release.";
      const replacement = assessmentResponse(application.position_title, id, application.id);
      if (!priorFixture || !replacement) continue;
      application.screening_answers[id] = replacement;
      if (snapshot?.screening_answers) snapshot.screening_answers[id] = application.screening_answers[id];
    }
  });
  return seedReturns(state);
}

function save(state) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function readQuestionnaire(jobId) {
  const state = read();
  return state.versions[state.positions[jobId]?.published_id];
}

const scopedPosition = (state, id) => Object.values(state.positions)
  .find(row => row.requisition_id === id || row.alternate_requisition_id === id);

function updateQuestionnaire(state, position, body) {
  if (!position || position.job_id !== body.jobId || position.requisition_id !== body.requisitionId) {
    throw new Error("Select the configured Careers posting and primary requisition.");
  }
  const questions = body.questions;
  if (!Array.isArray(questions) || !questions.length ||
      questions.some(question => !question.prompt?.trim()) || new Set(questions.map(question => question.id)).size !== questions.length) {
    throw new Error("Provide distinct questions with non-empty prompts.");
  }
  position.draft = questions;
  const current = state.versions[position.published_id];
  if (body.publish && JSON.stringify(questions) !== JSON.stringify(current.questions)) {
    const version = { ...current, version: current.version + 1, id: crypto.randomUUID(), questions };
    state.versions[version.id] = version;
    position.published_id = version.id;
  }
  save(state);
  return { position };
}

function rubricHistory(state, requisitionId) {
  const initial = defaultRubric(requisitions.find(item => item.id === requisitionId)?.title);
  return initial ? [...(state.rubrics?.[requisitionId] ?? []), initial] : [];
}

function listApplicants(state, position, requisitionId) {
  const rubric = rubricHistory(state, requisitionId)[0];
  const rows = state.applications.filter(application => application.position_id === position.job_id &&
    (state.routes[application.id] ?? position.requisition_id) === requisitionId);
  return {
    rubric,
    applicants: rows.map(application => ({
      application, weightedDraft: state.drafts[application.id]?.rubric?.version === rubric?.version ? state.drafts[application.id] : null, case: state.cases[application.id] ?? null, hasResume: true,
      needsRoute: position.requires_routing && !state.routes[application.id],
      questionnaire: state.versions[application.screening_version_id]
    })),
    summary: { total: rows.length, assessed: rows.length, resumes: rows.length,
      waiting: rows.filter(application => !state.cases[application.id]?.review.completed).length },
    routing: position.requires_routing ? { primary: position.requisition_id, alternate: position.alternate_requisition_id } : null,
    nextOffset: null
  };
}

const resumeExcerpts = {
  equipment: "Operated a carton tape machine and replaced worn rollers during weekly maintenance.",
  maintenance: "Inspected feed guides at shift start and logged recurring jams for maintenance.",
  accuracy: "Checked inventory counts and reported discrepancies before release.",
  picking: "Picked orders from numbered bins and verified each SKU against the pick ticket.",
  systems: "Recorded inventory discrepancies in the scanner and updated the shift log.",
  safety: "Followed the work-area safety checklist and reported a damaged guard to the lead.",
  packing: "Selected carton sizes and inserted protective padding for fragile shipments.",
  shipping: "Matched carrier labels with order records and verified destinations before handoff.",
  work_orders: "Assembled components from current work orders and confirmed quantities at handoff.",
  quality: "Recorded failed inspections and held affected items pending a second check.",
  records: "Logged quantities and work-order changes in the production handoff sheet.",
  preparation: "Degreased parts and masked contact surfaces before coating.",
  application: "Applied coatings to test panels and recorded cure times for each batch.",
  discovery: "Asked customers about use cases and confirmed order requirements before quoting.",
  sales: "Tracked quotes through follow-up and documented product questions for the sales lead.",
  communication: "Explained product specifications and confirmed delivery expectations with buyers."
};

function resumeEvidence(application) {
  const experienced = application.id.endsWith("-A");
  const initial = defaultRubric(application.position_title);
  return Object.fromEntries(initial.categories.map((category, index) => {
    let quote = category.id === "systems" && application.position_title === "Sales Executive"
      ? "Maintained contact notes and scheduled follow-ups in the CRM." : resumeExcerpts[category.id];
    if (!experienced) quote = category.id === "accuracy" || index === 0
      ? "Assisted a team lead with " + category.label.toLowerCase() + " during supervised training." : null;
    return [category.id, quote ?? null];
  }));
}

export async function screeningRequest(action, body = {}) {
  const state = read();
  const position = scopedPosition(state, body.requisitionId);
  if (action === "postings") return { postings };
  if (action === "rubric" || action === "publishRubric") {
    const history = rubricHistory(state, body.requisitionId);
    if (action === "rubric") return { history };
    if (history[0]?.version !== body.version || !validCategories(body.categories)) {
      throw new Error("Check the active rubric version and 100-point total.");
    }
    state.rubrics ??= {};
    state.rubrics[body.requisitionId] = [{ version: body.version + 1, categories: body.categories }, ...history.slice(0, -1)];
    save(state);
    return { history: rubricHistory(state, body.requisitionId) };
  }
  if (action === "configuration") return { position: position ?? null };
  if (action === "questionnaire") return updateQuestionnaire(state, position, body);
  if (action === "candidateScreening") return { records: Object.values(state.cases).filter(row => row.candidate_id === body.candidateId) };
  if (action === "applicants" && position) return listApplicants(state, position, body.requisitionId);

  const application = state.applications.find(item => item.id === body.applicationId && item.position_id === position?.job_id);
  if (!application) throw new Error("Select an application in this requisition.");
  const routed = state.routes[application.id];
  if (action === "route") {
    if (!position.requires_routing || position.requisition_id !== body.requisitionId || routed ||
        ![position.requisition_id, position.alternate_requisition_id].includes(body.destinationId)) {
      throw new Error("Choose one destination for an unrouted application from Warehouse Picker.");
    }
    state.routes[application.id] = body.destinationId;
    application.position_title = requisitions.find(req => req.id === body.destinationId).title;
    save(state);
    return { destination: body.destinationId };
  }
  if ((position.requires_routing && !routed) || (routed ?? position.requisition_id) !== body.requisitionId) {
    throw new Error("Confirm the destination before reviewing this application.");
  }
  const record = state.cases[application.id];
  if (action === "sync") {
    if (record) return { case: record };
    const candidate = registerCandidate(state, application, body.requisitionId);
    const item = newCase(application, candidate, body.requisitionId, state.versions[application.screening_version_id]);
    state.cases[application.id] = item;
    save(state);
    return { case: item };
  }
  if (!record) throw new Error("Sync this application first.");
  const rubric = rubricHistory(state, body.requisitionId)[0];
  const source = resumeEvidence(application);
  const categories = rubric.categories.map(category => {
    const quote = Object.hasOwn(source, category.id) ? source[category.id] : null;
    return { id: category.id, quote, score: quote ? Math.floor(category.weight * (application.id.endsWith("-A") ? 0.85 : 0.45)) : null };
  });
  if (action === "resume") {
    const sample = ["DEMONSTRATION — SYNTHETIC DATA ONLY", candidateName(application),
      "Role: " + application.position_title, "", ...Object.values(source).filter(Boolean)].join("\n");
    const url = URL.createObjectURL(new Blob([sample], { type: "text/plain" }));
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { url };
  }
  if (action === "draft") {
    if (body.rubricVersion && body.rubricVersion !== rubric.version) {
      throw new Error("A new rubric was published. Refresh applications before generating a draft.");
    }
    if (body.generate) {
      state.drafts[application.id] = { rubric, categories,
        missing_information: categories.filter(item => item.score === null).map(item =>
          rubric.categories.find(category => category.id === item.id).label + " remains unverified."),
        interview_questions: ["Describe a time you caught and corrected a discrepancy during this work."]
      };
      save(state);
    }
    const draft = state.drafts[application.id];
    return { draft: draft?.rubric?.version === rubric.version ? draft : null };
  }
  if (action === "review") {
    if (record.revision !== body.revision) throw new Error("Review changed. Refresh before saving again.");
    if (body.review.meeting_url) throw new Error("Leave the meeting URL blank in the demonstration. The interview calendar is local.");
    const submitted = body.review.evaluation;
    let verified = record.review.evaluation;
    if (submitted) {
      const scored = rubricHistory(state, body.requisitionId).find(item => item.version === submitted.version);
      if (!scored || Object.entries(submitted.scores).some(([id, points]) => {
        const criterion = scored.categories.find(item => item.id === id);
        return !criterion || (points !== null && (!Number.isInteger(points) || points < 0 || points > criterion.weight));
      })) throw new Error("Check the rubric version and category point limits.");
      verified = { rubric: scored, scores: submitted.scores };
    }
    record.review = { ...body.review, ...(verified && { evaluation: verified }) };
    record.revision++;
    const assignment = state.assignments.find(item => item.candidate_id === record.candidate_id && item.requisition_id === body.requisitionId);
    if (body.advancePipeline && body.review.interview_at && ["new", "screening"].includes(assignment?.stage)) {
      assignment.stage = "interview";
    }
    save(state);
    return { case: record };
  }
  throw new Error("This action is outside the demonstration.");
}

const failure = message => ({ data: null, error: { message } });

function createInterview(state, params) {
  const { p_candidate_id, p_position_title, p_interview_date, p_start_time, p_end_time, p_interview_format, p_interview_stage } = params;
  if (!state.candidates.some(item => item.id === p_candidate_id) || !p_interview_date || !p_position_title?.trim()) {
    return failure("Select a synthetic candidate, position and interview date.");
  }
  if (p_start_time && p_end_time && p_end_time <= p_start_time) return failure("End time must follow start time.");
  const id = crypto.randomUUID();
  state.interviews.push({ id, candidate_id: p_candidate_id, position_title: p_position_title,
    interview_date: p_interview_date, start_time: p_start_time, end_time: p_end_time,
    interview_format: p_interview_format, interview_stage: p_interview_stage, attendance_status: "unverified" });
  save(state);
  return { data: id };
}

const emptyLists = new Set(["ats_admin_hiring_managers", "ats_admin_manager_feedback_labels"]);
const listeners = new Set();
function setSession(value) {
  if (value) sessionStorage.removeItem(storageKey);
  else sessionStorage.setItem(storageKey, "signed-out");
  for (const callback of listeners) callback(value ? "SIGNED_IN" : "SIGNED_OUT", value);
}

export const marketingDevClient = {
  auth: {
    getSession: async () => ({ data: { session: sessionStorage.getItem(storageKey) ? null : recruiter } }),
    onAuthStateChange: callback => {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    signOut: async () => setSession(null),
    signInWithPassword: async ({ password }) => {
      if (password !== "demo-only") return failure("Use the demonstration password demo-only.");
      setSession(recruiter);
      return {};
    },
    resetPasswordForEmail: async () => failure("Email is disabled in the demonstration."),
    updateUser: async () => failure("Account changes are disabled in the demonstration.")
  },
  functions: {
    async invoke(name, { body }) {
      const state = read();
      if (name === "analyze-candidate-resume") {
        const draft = legacyDraft(state, body.candidateId, body.resumeId);
        return draft ? { data: { draft } } : failure("Synthetic Returns resume unavailable.");
      }
      if (name !== "ats-returns-access") return failure("This action is outside the demonstration.");
      const { records } = state.legacyReturns;
      if (body.action === "list") return { data: { records } };
      if (body.action === "update") {
        const record = records.find(item => item.id === body.id);
        if (!record) return failure("Synthetic Returns application unavailable.");
        if (body.update.interview_teams_url) return failure("Leave the Teams URL blank in this demonstration.");
        for (const key of ["interview_status", "interview_at", "interview_teams_url", "interview_notes"]) {
          record[key] = body.update[key];
        }
        save(state);
        return { data: { record } };
      }
      if (body.action === "resume") {
        const record = records.find(item => item.resume_path === body.path);
        if (!record) return failure("Synthetic Returns resume unavailable.");
        const draft = legacyDraft(state, record.id + "-candidate", record.id + "-resume");
        const url = URL.createObjectURL(new Blob([candidateName(record) + "\n" + draft.evidence], { type: "text/plain" }));
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return { data: { url } };
      }
      return failure("This action is outside the demonstration.");
    }
  },
  async rpc(name, params) {
    const state = read();
    if (name === "ats_admin_directory") return { data: { candidates: state.candidates, interviews: state.interviews } };
    if (name === "ats_admin_requisitions") return { data: { requisitions: [...requisitions, demoReturnsRequisition], assignments: state.assignments } };
    if (name === "ats_admin_resumes") return { data: legacyResume(state, params.p_candidate_id) };
    if (name === "ats_admin_resume_evaluation") {
      const id = params.p_candidate_id;
      if (params.p_requisition_id !== demoReturnsRequisition.id || !legacyResume(state, id).length) {
        return failure("Returns evaluation unavailable.");
      }
      const evaluations = state.legacyReturns.evaluations;
      if (params.p_save) {
        evaluations[id] = Object.fromEntries(["scores", "evidence", "gaps", "questions", "recruiter_score", "recruiter_notes", "decision"]
          .map(key => [key, params["p_" + key]]));
        save(state);
      }
      return { data: evaluations[id] ?? null };
    }
    if (name === "ats_admin_create_interview") return createInterview(state, params);
    if (name === "ats_admin_update_attendance") {
      const interview = state.interviews.find(item => item.id === params.p_interview_id);
      if (!interview) return failure("Interview unavailable.");
      interview.attendance_status = params.p_attendance;
      save(state);
      return { data: null };
    }
    if (name === "ats_admin_employment") return { data: null };
    if (emptyLists.has(name)) return { data: [] };
    return failure("This action is outside the demonstration.");
  },
  storage: {
    from: () => ({
      upload: async () => failure("Use the supplied synthetic resumes in the demonstration."),
      createSignedUrl: async () => failure("Use the resume in Applicant Screening.")
    })
  }
};
export const supabase = marketingDevClient;
