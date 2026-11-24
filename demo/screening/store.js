import { postings as fixturePostings, requisitions as fixtureRequisitions } from "../../scripts/screening-lab/dataset.mjs";

const storageKey = "orion-screening-demonstration-v1";
const postings = fixturePostings.slice(1).map(posting => ({
  ...posting, description: "Synthetic posting for recruiter demonstration.", is_active: true
}));
const requisitions = fixtureRequisitions.slice(1).map(item => ({
  ...item, department: "Operations", status: "open", openings: 3
}));
const recruiter = { user: { email: "recruiter@example.test" } };
const candidateName = item => item.first_name + " " + item.last_name;

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
          screening_answers: Object.fromEntries(posting.questions.map(({ id }) => [id, "Sample response for " + id + "."]))
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
  return saved ? JSON.parse(saved) : seed();
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

function listApplicants(state, position, requisitionId) {
  const rows = state.applications.filter(application => application.position_id === position.job_id &&
    (state.routes[application.id] ?? position.requisition_id) === requisitionId);
  return {
    applicants: rows.map(application => ({
      application, case: state.cases[application.id] ?? null, hasResume: true,
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
  "Warehouse Middle (Hybrid Maintenance)": "Cleaned and inspected a carton sealer before the morning shift.",
  "Production Assistant": "Checked assembled parts against the work order before passing them to inspection.",
  "Cerakote Applicator": "Recorded coating batch numbers and inspected finished samples for uneven coverage.",
  "Sales Executive": "Confirmed order requirements with customers and documented follow-up in the sales queue."
};

export async function screeningRequest(action, body = {}) {
  const state = read();
  const position = scopedPosition(state, body.requisitionId);
  if (action === "postings") return { postings };
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
  const evidenceQuote = resumeExcerpts[application.position_title] ??
    "Checked inventory counts and reported discrepancies before release.";
  if (action === "resume") {
    const sample = ["DEMONSTRATION — SYNTHETIC DATA ONLY", candidateName(application),
      "Role: " + application.position_title, "", "Sample resume excerpt", evidenceQuote].join("\n");
    const url = URL.createObjectURL(new Blob([sample], { type: "text/plain" }));
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { url };
  }
  if (action === "draft") {
    if (body.generate) {
      state.drafts[application.id] = {
        experience: [{ observation: "Preset excerpt from the synthetic resume.", quote: evidenceQuote }],
        missing_information: ["The sample does not give an example of correcting a mistake."],
        interview_questions: ["How did you handle a discrepancy during that work?"]
      };
      save(state);
    }
    return { draft: state.drafts[application.id] ?? null };
  }
  if (action === "review") {
    if (record.revision !== body.revision) throw new Error("Review changed. Refresh before saving again.");
    if (body.review.meeting_url) throw new Error("Leave the meeting URL blank in the demonstration. The interview calendar is local.");
    record.review = body.review;
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

const emptyLists = new Set(["ats_admin_resumes", "ats_admin_hiring_managers", "ats_admin_manager_feedback_labels"]);
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
  async rpc(name, params) {
    const state = read();
    if (name === "ats_admin_directory") return { data: { candidates: state.candidates, interviews: state.interviews } };
    if (name === "ats_admin_requisitions") return { data: { requisitions, assignments: state.assignments } };
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
