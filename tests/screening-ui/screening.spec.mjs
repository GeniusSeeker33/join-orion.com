import { expect, test } from "@playwright/test";
import { screeningTemplates } from "../../src/components/screening/templates.js";
import { id } from "../fixtures/referralDb.mjs";

const job = {
  id: id(10), title: "Customer Service & Returns Specialist — Compliance Support",
  department: "Operations", is_active: true, hours: "40 hours/week", pay: "$21/hour",
  description: "Handle return requests, create carrier labels and coordinate receiving."
};
const req = { id: id(20), title: "Synthetic universal requisition", department: "Operations", status: "open", openings: 1 };
const questionnaire = {
  id: id(40), job_id: job.id, title: job.title, version: 1,
  questions: [{ id: "returns", prompt: "Describe a return you resolved." }]
};
const application = {
  id: id(30), first_name: "Synthetic", last_name: "Applicant", email: "synthetic@example.test",
  phone: "812-555-0100", position_title: job.title, screening_version_id: questionnaire.id,
  screening_answers: { returns: "Coordinated receiving and documented the refund." }
};
const candidate = { id: id(25), full_name: "Synthetic Applicant", email: application.email, phone: application.phone };

test("public Careers and the legacy Returns URL submit versioned answers with a resume", async ({ page }) => {
  const submissions = [];
  const uploads = [];
  await page.route("**/__screening_fixture", async route => {
    const body = route.request().postDataJSON();
    let data = null;
    if (body.kind === "table") data = [job];
    if (body.name === "read_screening_questionnaire") data = body.params.p_job === job.id || body.params.p_job === null ? questionnaire : null;
    if (body.kind === "insert") submissions.push(body.rows[0]);
    if (body.kind === "upload") uploads.push(body.path);
    await route.fulfill({ json: { data } });
  });

  await page.goto("/careers?job=" + job.id);
  await expect(page.getByLabel(questionnaire.questions[0].prompt)).toBeVisible();
  await page.goto("/assessment/" + id(11));
  await expect(page.getByText("This assessment is unavailable.")).toBeVisible();
  await page.goto("/returns-assessment?utm_source=indeed");
  await expect(page.getByRole("heading", { name: job.title })).toBeVisible();
  await page.getByLabel("First Name *", { exact: true }).fill("Synthetic");
  await page.getByLabel("Last Name *", { exact: true }).fill("Applicant");
  await page.getByLabel("Email *", { exact: true }).fill(application.email);
  await page.getByLabel("Phone Number *", { exact: true }).fill(application.phone);
  await page.getByLabel(questionnaire.questions[0].prompt).fill(application.screening_answers.returns);
  await page.getByLabel("Resume", { exact: true }).setInputFiles({
    name: "synthetic.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-synthetic")
  });
  await page.getByRole("button", { name: "Apply for " + job.title }).click();
  await expect(page.getByRole("heading", { name: "Application Received" })).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    position_id: job.id, source: "indeed", screening_version_id: questionnaire.id,
    screening_answers: application.screening_answers, resume_path: uploads[0]
  });
  expect(uploads[0]).toContain(submissions[0].id + "/");
});

test("recruiter publishes via Open Positions and saves evidence and follow-up across reload", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("synthetic-recruiter", "true"));
  let config = null;
  let record = null;
  let draft = null;
  const interviews = [];
  await page.route("**/__screening_fixture", async route => {
    const { name, params } = route.request().postDataJSON();
    if (name === "ats_admin_create_interview") {
      expect(params).toMatchObject({ p_candidate_id: candidate.id, p_position_title: job.title, p_interview_date: "2026-12-01" });
      interviews.push({ id: id(35), candidate_id: candidate.id, position_title: job.title, interview_date: "2026-12-01" });
    }
    const data = name === "ats_admin_directory" ? { candidates: [candidate], interviews } :
      name === "ats_admin_requisitions" ? { requisitions: [req], assignments: [] } : [];
    await route.fulfill({ json: { data } });
  });
  await page.route("**/api/ats-screening", async route => {
    expect(route.request().headers().authorization).toBe("Bearer synthetic-ats-token");
    const body = route.request().postDataJSON();
    let result;
    switch (body.action) {
      case "postings": result = { postings: [job] }; break;
      case "configuration": result = { position: config }; break;
      case "questionnaire":
        config = { job_id: body.jobId, draft: body.questions, published_id: body.publish ? questionnaire.id : null };
        result = { position: config }; break;
      case "applicants": result = { applicants: [{ application, case: record, hasResume: true, questionnaire }], nextOffset: null,
          summary: { total: 1, assessed: 1, resumes: 1, waiting: record?.review?.completed ? 0 : 1 } }; break;
      case "sync":
        record = { application_id: application.id, application, candidate_id: candidate.id, resume_path: "private/path",
          questionnaire, interview: null, identity_state: "linked", revision: 0, review: {} };
        result = { case: record }; break;
      case "candidateScreening": result = { records: [{ application_id: application.id, application, questionnaire }] }; break;
      case "draft":
        if (body.generate) draft = { experience: [{ observation: "Handled returns", quote: "Processed refunds" }],
          missing_information: [], interview_questions: ["How do you verify a discrepancy?"] };
        result = { draft }; break;
      case "review":
        expect(body.revision).toBe(record.revision);
        expect(body.advancePipeline).toBe(true);
        expect(body.review.meeting_url).toBe("https://teams.microsoft.com/l/meetup-join/synthetic");
        record = { ...record, revision: record.revision + 1, review: body.review };
        result = { case: record }; break;
      default: throw new Error("Unexpected action " + body.action);
    }
    await route.fulfill({ json: result });
  });
  await page.goto("/ats");
  await page.getByRole("button", { name: "Open Positions", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(req.title) }).click();
  await page.getByLabel("Careers posting").selectOption(job.id);
  await page.getByLabel("Start from a role template").selectOption("0");
  await page.getByRole("button", { name: "Preview questionnaire" }).click();
  await expect(page.getByRole("heading", { name: "Applicant preview" })).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("button", { name: "Publish questionnaire" }).click();
  await expect(page.getByLabel("Shareable assessment link")).toHaveValue(new RegExp("/assessment/" + job.id));
  async function openApplicant() {
    await page.getByRole("button", { name: "Applicant Screening", exact: true }).click();
    await page.getByRole("combobox", { name: "Position", exact: true }).selectOption(req.id);
    await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  }
  await openApplicant();
  await page.getByText(/Assessment answers · Version 1/).click();
  await expect(page.getByText(questionnaire.questions[0].prompt)).toBeVisible();
  await expect(page.getByText("Total applicants", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sync application", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open candidate profile and interview calendar" })).toBeVisible();
  await page.getByText(/Assessment answers · Version 1/).click();
  await expect(page.getByText("Coordinated receiving and documented the refund.")).toBeVisible();
  await page.getByText("ATS interview calendar", { exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-12-01");
  await page.getByRole("button", { name: "Schedule interview", exact: true }).click();
  await expect(page.getByText("History and attendance (1)")).toBeVisible();
  await page.getByRole("button", { name: "Batch Resume Evaluation" }).click();
  await expect(page.getByText("Synthetic Applicant · Draft ready")).toBeVisible();
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  await expect(page.getByText("AI draft for recruiter verification")).toBeVisible();
  await page.getByLabel("Verified resume evidence").fill("Recruiter confirmed order-resolution experience.");
  await page.getByLabel("Recruiter notes").fill("Review complete.");
  await page.getByLabel("Follow-up decision").selectOption("interview");
  await page.getByLabel("Screening follow-up time (local)").fill("2026-12-01T10:00");
  await page.getByLabel("Screening meeting URL (optional)").fill("https://teams.microsoft.com/l/meetup-join/synthetic");
  await page.getByLabel(/Move this candidate’s New or Screening/).check();
  await page.getByLabel("Mark screening review complete").check();
  await page.getByRole("button", { name: "Save recruiter review" }).click();
  await expect(page.getByRole("button", { name: /Synthetic Applicant.*Review complete/ })).toBeVisible();
  await page.reload();
  await openApplicant();
  await expect(page.getByLabel("Verified resume evidence")).toHaveValue("Recruiter confirmed order-resolution experience.");
  await expect(page.getByLabel("Follow-up decision")).toHaveValue("interview");
  await page.getByLabel("Review status").selectOption("pending");
  await expect(page.getByText("No applications match this page and filter.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recruiter administrator sign-in" })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("synthetic-ats-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await openApplicant();
  await expect(page.getByLabel("Verified resume evidence")).toHaveValue("Recruiter confirmed order-resolution experience.");
  await page.getByRole("button", { name: "Open candidate profile and interview calendar" }).click();
  await page.getByText("Screening applications (1)", { exact: true }).click();
  await page.getByText(/Assessment answers · Version 1/).click();
  await expect(page.getByText("Coordinated receiving and documented the refund.")).toBeVisible();
});

test("signed-out visitors see the existing ATS sign-in boundary", async ({ page }) => {
  await page.goto("/ats");
  await expect(page.getByRole("heading", { name: "Recruiter administrator sign-in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Applicant Screening" })).toHaveCount(0);
});

test("candidate pipeline, employment screens and leadership reporting remain reachable", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("synthetic-recruiter", "true"));
  await page.route("**/api/ats-screening", route => route.fulfill({ json: { records: [] } }));
  await page.route("**/__screening_fixture", async route => {
    const { name } = route.request().postDataJSON();
    const responses = {
      ats_admin_directory: { candidates: [candidate] },
      ats_admin_requisitions: { requisitions: [req], assignments: [{ requisition_id: req.id, candidate_id: candidate.id, stage: "hired" }] },
      ats_admin_employment: { employment_status: "active", start_date: "2026-11-01" }
    };
    await route.fulfill({ json: { data: responses[name] ?? [] } });
  });
  await page.goto("/ats");
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  await expect(page.getByRole("heading", { name: "Position pipeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Employment lifecycle" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Interview management" })).toBeVisible();
  await page.getByRole("button", { name: "Leadership Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Hiring progress by position" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current recruiting funnel" })).toBeVisible();
});

for (const [index, template] of screeningTemplates.entries()) {
  test(`applicant submits the questionnaire for ${template.title}`, async ({ page }) => {
    const posting = { id: id(100 + index), title: template.title };
    const version = { ...questionnaire, ...posting, id: id(110 + index), job_id: posting.id, questions: template.questions };
    const submissions = [];
    await page.route("**/__screening_fixture", async route => {
      const body = route.request().postDataJSON();
      if (body.kind === "insert") submissions.push(body.rows[0]);
      if (body.name === "read_screening_questionnaire") expect(body.params.p_job).toBe(posting.id);
      await route.fulfill({ json: { data: body.name === "read_screening_questionnaire" ? version : null } });
    });
    await page.goto("/assessment/" + posting.id);
    await expect(page.getByRole("heading", { name: template.title, exact: true })).toBeVisible();
    await page.getByLabel("First Name *", { exact: true }).fill("Synthetic");
    await page.getByLabel("Last Name *", { exact: true }).fill("Applicant");
    await page.getByLabel("Email *", { exact: true }).fill("synthetic@example.test");
    await page.getByLabel("Phone Number *", { exact: true }).fill("812-555-0100");
    for (const question of template.questions) await page.getByLabel(question.prompt, { exact: true }).fill("Synthetic response for " + question.id);
    await page.getByRole("button", { name: "Apply for " + template.title, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Application Received" })).toBeVisible();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({ position_id: posting.id, screening_version_id: version.id });
    expect(Object.keys(submissions[0].screening_answers)).toEqual(template.questions.map(question => question.id));
  });
}

test("combined Warehouse applications appear in one destination only after recruiter routing", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("synthetic-recruiter", "true"));
  const picker = { ...req, title: "Warehouse Picker" };
  const packer = { ...req, id: id(21), title: "Warehouse Packer" };
  const combined = { ...job, title: "Warehouse Picker/Packer" };
  let destination;
  let published;
  let syncCount = 0;
  await page.route("**/__screening_fixture", async route => {
    const { name } = route.request().postDataJSON();
    await route.fulfill({ json: { data: name === "ats_admin_requisitions" ? { requisitions: [picker, packer], assignments: [] }
      : { candidates: [candidate] } } });
  });
  await page.route("**/api/ats-screening", async route => {
    const body = route.request().postDataJSON();
    const config = { job_id: combined.id, requisition_id: picker.id, alternate_requisition_id: packer.id,
      requires_routing: true, published_id: questionnaire.id };
    let result;
    if (body.action === "postings") result = { postings: [combined] };
    if (body.action === "configuration") result = { position: published ? config : null };
    if (body.action === "rubric") result = { history: [] };
    if (body.action === "questionnaire") {
      expect(body.alternateRequisitionId).toBe(packer.id);
      published = true;
      result = { position: config };
    }
    if (body.action === "applicants") {
      result = { routing: { primary: picker.id, alternate: packer.id }, nextOffset: null,
        applicants: body.requisitionId === (destination ?? picker.id)
          ? [{ application: { ...application, position_title: combined.title }, questionnaire, needsRoute: !destination }] : [] };
    }
    if (body.action === "route") {
      expect(body.requisitionId).toBe(picker.id);
      expect(body.destinationId).toBe(packer.id);
      destination = body.destinationId;
      result = { destination };
    }
    if (body.action === "sync") {
      expect(body.requisitionId).toBe(packer.id);
      syncCount++;
      result = { case: { application_id: application.id, candidate_id: candidate.id, application, revision: 0 } };
    }
    if (!result) throw new Error("Unexpected action " + body.action);
    await route.fulfill({ json: result });
  });
  await page.goto("/ats");
  await page.getByRole("button", { name: "Open Positions", exact: true }).click();
  await page.getByRole("button", { name: /Warehouse Picker/ }).click();
  await page.getByLabel("Careers posting").selectOption(combined.id);
  await page.getByLabel("Start from a role template").selectOption("2");
  await expect(page.getByRole("button", { name: "Publish questionnaire" })).toBeDisabled();
  await page.getByLabel("Other warehouse destination").selectOption(packer.id);
  await page.getByRole("button", { name: "Publish questionnaire" }).click();
  await expect(page.getByText("Questionnaire published.")).toBeVisible();

  await page.getByRole("button", { name: "Applicant Screening", exact: true }).click();
  const selector = page.getByRole("combobox", { name: "Position", exact: true });
  await selector.selectOption(picker.id);
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  await expect(page.getByRole("button", { name: "Sync application", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sync visible applications" })).toBeDisabled();
  await page.getByLabel("Application destination").selectOption(packer.id);
  await page.getByRole("button", { name: "Confirm destination" }).click();
  await expect(page.getByText("Destination saved · Warehouse Packer")).toBeVisible();
  await expect(page.getByText("No applications match this page and filter.")).toBeVisible();
  await selector.selectOption(packer.id);
  await page.getByRole("button", { name: /Synthetic Applicant/ }).click();
  await page.getByRole("button", { name: "Sync application", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open candidate profile and interview calendar" })).toBeVisible();
  expect(syncCount).toBe(1);
});

test("weighted batch review retries only failed evaluations and keeps unknown totals unverified", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("synthetic-recruiter", "true"));
  const requisition = { ...req, title: "Warehouse Picker" };
  const rubric = { version: 1, categories: [{ id: "picking", label: "Picking accuracy", weight: 60 },
    { id: "safety", label: "Warehouse safety", weight: 40 }] };
  const second = { ...application, id: id(31), last_name: "Second" };
  const attempts = [];
  await page.route("**/__screening_fixture", async route => {
    const { name } = route.request().postDataJSON();
    await route.fulfill({ json: { data: name === "ats_admin_requisitions" ? { requisitions: [requisition] } : { candidates: [] } } });
  });
  await page.route("**/api/ats-screening", async route => {
    const body = route.request().postDataJSON();
    if (body.action === "applicants") {
      await route.fulfill({ json: { rubric, nextOffset: null, applicants: [application, second].map(item => ({
        application: item, case: { application_id: item.id, resume_path: "private/synthetic.pdf" }, hasResume: true
      })) } });
      return;
    }
    expect(body.action).toBe("draft");
    expect(body.rubricVersion).toBe(1);
    attempts.push(body.applicationId);
    if (body.applicationId === second.id && attempts.length === 2) {
      await route.fulfill({ status: 503, json: { error: "Synthetic temporary failure" } });
    } else {
      await route.fulfill({ json: { draft: { rubric, categories: [{ id: "picking", score: 35, quote: "Checked SKUs" },
        { id: "safety", score: null, quote: null }] } } });
    }
  });
  await page.goto("/ats");
  await page.getByRole("button", { name: "Applicant Screening", exact: true }).click();
  await page.getByRole("combobox", { name: "Position", exact: true }).selectOption(requisition.id);
  await page.getByRole("button", { name: "Batch Resume Evaluation" }).click();
  await page.getByRole("button", { name: "Retry failed evaluations" }).click();
  await expect(page.getByText("Processed 1 of 1")).toBeVisible();
  expect(attempts).toEqual([application.id, second.id, second.id]);
  await expect(page.getByRole("cell", { name: "35 / 60 assessed · incomplete" })).toHaveCount(2);
});

test("Returns is available before mapping and bypasses the universal screening API", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("synthetic-recruiter", "true"));
  const calls = [];
  await page.route("**/__screening_fixture", async route => {
    const { kind, name } = route.request().postDataJSON();
    if (kind === "function") calls.push(name);
    const data = name === "ats_admin_requisitions" ? { requisitions: [req], assignments: [] } :
      name === "ats-returns-access" ? { records: [application] } : { candidates: [] };
    await route.fulfill({ json: { data } });
  });
  await page.route("**/api/ats-screening", async route => {
    calls.push(route.request().postDataJSON().action);
    await route.fulfill({ json: { applicants: [], nextOffset: null } });
  });
  await page.goto("/ats");
  await page.getByRole("button", { name: "Applicant Screening", exact: true }).click();
  const position = page.getByRole("combobox", { name: "Position", exact: true });
  await position.selectOption({ label: job.title });
  await expect(page.getByRole("heading", { name: "Customer Service & Returns Screening", exact: true })).toBeVisible();
  await expect(page.getByText(application.screening_answers.returns)).toBeVisible();
  expect([...new Set(calls.splice(0))]).toEqual(["ats-returns-access"]);
  await position.selectOption(req.id);
  await expect(page.getByText("No applications match this page and filter.")).toBeVisible();
  expect([...new Set(calls.splice(0))]).toEqual(["applicants"]);
  await page.getByRole("button", { name: "Returns Screening", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Customer Service & Returns Screening", exact: true })).toBeVisible();
  expect([...new Set(calls)]).toEqual(["ats-returns-access"]);
});
