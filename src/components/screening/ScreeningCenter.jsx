import InterviewManager from "../../InterviewManager";
import { useEffect, useState } from "react";
import { marketingDevClient } from "../../lib/marketingDevClient";
import { screeningRequest } from "./client";
import AssessmentAnswers from "./AssessmentAnswers";

const field = "w-full rounded border border-slate-600 bg-slate-800 p-2";
const button = "rounded bg-slate-700 px-3 py-2 disabled:opacity-50";
const primary = "rounded bg-amber-300 px-3 py-2 font-semibold text-slate-950 disabled:opacity-50";
const assessmentState = row => row.application.screening_answers ? "Assessment submitted" : "Assessment pending";

function syncStatus(row) {
  if (row.case && !row.case.candidate_id) return "Identity review required";
  if (row.case?.candidate_id && (!row.hasResume || row.case.resume_path)) return "Synchronized";
  if (row.sync?.error_code === "manual_resume") return "Resume needs manual review";
  if (row.sync?.state === "failed") return "Sync needs attention · retry manually";
  if (row.sync?.error_code === "retry") return "Automatic retry pending";
  if (row.sync?.state === "pending") return "Queued for sync";
  return "Awaiting sync";
}

function localDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ApplicantReview({ row, requisitionId, candidates, interviews, feedback, onChanged, onRefresh, onSelectCandidate }) {
  const record = row.case;
  const application = record?.application ?? row.application;
  const [review, setReview] = useState(() => ({
    notes: record?.review?.notes ?? "", approved_evidence: record?.review?.approved_evidence ?? "",
    decision: record?.review?.decision ?? "pending", completed: record?.review?.completed ?? false,
    interview_at: localDate(record?.review?.interview_at), meeting_url: record?.review?.meeting_url ?? ""
  }));
  const [advancePipeline, setAdvancePipeline] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const payload = { requisitionId, applicationId: application.id };

  useEffect(() => {
    if (!record?.resume_path) return;
    let live = true;
    screeningRequest("draft", { requisitionId, applicationId: application.id })
      .then(result => { if (live) setDraft(result.draft); })
      .catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [requisitionId, application.id, record?.resume_path]);

  async function run(action, args, success) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await screeningRequest(action, { ...payload, ...args });
      if (result.case) await onChanged(result.case, action === "sync" || args.advancePipeline);
      if (result.draft) setDraft(result.draft);
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
      if (success) setMessage(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function save(event) {
    event.preventDefault();
    run("review", {
      revision: record.revision, advancePipeline: advancePipeline && Boolean(review.interview_at),
      review: {
        ...review, meeting_url: review.meeting_url.trim() || null,
        interview_at: review.interview_at ? new Date(review.interview_at).toISOString() : null
      }
    }, "Recruiter review saved.");
  }

  const questionnaire = record?.questionnaire ?? row.questionnaire;
  const set = (key, value) => setReview(current => ({ ...current, [key]: value }));
  const linkedCandidate = candidates.find(candidate => candidate.id === record?.candidate_id);
  const linkedInterviews = interviews.filter(item => item.candidate_id === linkedCandidate?.id);
  const candidateMatches = candidates.filter(candidate =>
    candidateQuery.trim() && `${candidate.full_name} ${candidate.email ?? ""}`.toLowerCase().includes(candidateQuery.trim().toLowerCase())
  ).slice(0, 30);

  return <article className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
    <header><h3 className="text-xl font-semibold">{application.first_name} {application.last_name}</h3>
      <p className="break-words text-sm text-slate-300">{application.email} · {application.phone}</p>
      <p className="text-sm text-slate-400">{syncStatus(row)}</p>
    </header>
    {!record ? <button className={primary} disabled={busy} onClick={() => run("sync", {}, "Application synchronized.")}>Sync application</button> :
      record.candidate_id ? <button className="text-amber-300 underline" onClick={() => onSelectCandidate(record.candidate_id)}>Open candidate profile and interview calendar</button> :
        <section className="space-y-2 rounded border border-amber-500 p-3">
          <p>Identity needs review. Verify the original application against the directory before linking.</p>
          <label>Find verified profile<input className={field} value={candidateQuery} onChange={event => { setCandidateQuery(event.target.value); setCandidateId(""); }} /></label>
          <label>Verified candidate<select className={field} value={candidateId} onChange={event => setCandidateId(event.target.value)}>
            <option value="">Choose a profile</option>
            {candidateMatches.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.full_name} · {candidate.email}</option>)}
          </select></label>
          <button className={button} disabled={busy || !candidateId} onClick={() => run("sync", { candidateId }, "Verified identity linked.")}>Confirm identity link</button>
        </section>}

    {application.cover_letter && <details>
      <summary className="cursor-pointer font-semibold">Application statement</summary>
      <p className="mt-2 whitespace-pre-wrap break-words">{application.cover_letter}</p>
    </details>}
    <AssessmentAnswers application={application} questionnaire={questionnaire} open />
    {application.interview_status && <div className="space-y-1 text-sm text-slate-300">
      <p>Imported interview status: {application.interview_status.replaceAll("_", " ")}
        {localDate(application.interview_at) && ` · ${new Date(application.interview_at).toLocaleString()}`}</p>
      {application.interview_teams_url?.startsWith("https://teams.microsoft.com/") && (
        <a href={application.interview_teams_url} target="_blank" rel="noreferrer" className="text-amber-300 underline">Open imported Teams meeting</a>
      )}
    </div>}
    <section className="space-y-3 border-t border-slate-700 pt-3">
      <h4 className="font-semibold">Resume evidence</h4>
      {record?.resume_path ? <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => run("resume")}>Download private resume</button>
        <button className={button} disabled={busy} onClick={() => run("draft", { generate: true }, "Evidence draft ready for verification.")}>Generate evidence draft</button>
      </div> : <p>{row.hasResume ? "A source resume is available to synchronize." : "No resume attached."}</p>}
      {record?.candidate_id && row.hasResume && !record.resume_path &&
        <button className={button} disabled={busy} onClick={() => run("sync", {}, "Resume synchronized.")}>Retry resume sync</button>}
      {draft && <div className="space-y-3 rounded border border-slate-600 p-3">
        <p className="font-semibold text-amber-200">AI draft for recruiter verification</p>
        <ul className="list-disc space-y-2 pl-5">{draft.experience.map((item, n) => <li key={n}>{item.observation} <q>{item.quote}</q></li>)}</ul>
        <p>Missing information</p><ul className="list-disc pl-5">{draft.missing_information.map((item, n) => <li key={n}>{item}</li>)}</ul>
        <p>Suggested interview questions</p><ul className="list-disc pl-5">{draft.interview_questions.map((item, n) => <li key={n}>{item}</li>)}</ul>
      </div>}
    </section>
    {linkedCandidate && <details>
      <summary className="cursor-pointer font-semibold">ATS interview calendar</summary>
      <InterviewManager candidate={linkedCandidate} initialPosition={application.position_title}
        interviews={linkedInterviews} feedback={feedback.filter(item => linkedInterviews.some(interview => interview.id === item.interview_id))}
        onRefresh={onRefresh} />
    </details>}
    {record && <form className="grid gap-3 border-t border-slate-700 pt-3" onSubmit={save}>
      <label>Verified resume evidence<textarea className={field} rows={4} maxLength={10000} value={review.approved_evidence} onChange={event => set("approved_evidence", event.target.value)} /></label>
      <label>Recruiter notes<textarea className={field} maxLength={5000} rows={3} value={review.notes} onChange={event => set("notes", event.target.value)} /></label>
      <label>Follow-up decision<select className={field} value={review.decision} onChange={event => set("decision", event.target.value)}>
        <option value="pending">Review further</option><option value="contact">Contact</option><option value="interview">Interview</option>
        <option value="hold">Hold</option><option value="closed">Close screening review</option>
      </select></label>
      <label>Screening follow-up time (local)<input className={field} type="datetime-local" value={review.interview_at} onChange={event => set("interview_at", event.target.value)} /></label>
      <label>Screening meeting URL (optional)<input className={field} maxLength={1000} type="url" value={review.meeting_url} onChange={event => set("meeting_url", event.target.value)} /></label>
      {linkedCandidate && <label className="flex gap-2"><input type="checkbox" checked={advancePipeline && Boolean(review.interview_at)}
        disabled={!review.interview_at} onChange={event => setAdvancePipeline(event.target.checked)} />
        Move this candidate’s New or Screening assignment to Interview when saving this time
      </label>}
      <label className="flex gap-2"><input type="checkbox" checked={review.completed} onChange={event => set("completed", event.target.checked)} /> Mark screening review complete</label>
      <button className={primary} disabled={busy}>Save recruiter review</button>
    </form>}
    {message && <p role="status" className="text-emerald-300">{message}</p>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
  </article>;
}

function PositionReview({ requisitionId, candidates, interviews, feedback, onRefresh, onSelectCandidate }) {
  const [list, setList] = useState(null);
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [batch, setBatch] = useState(null);
  useEffect(() => {
    let live = true;
    screeningRequest("applicants", { requisitionId, offset })
      .then(result => { if (live) { setList(result); setError(""); } })
      .catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [requisitionId, offset, reload]);

  const visible = (list?.applicants ?? []).filter(row => filter === "all" ||
    Boolean(row.case?.review?.completed) === (filter === "complete"));
  const row = visible.find(item => item.application.id === selected);

  async function update(record, sync) {
    setList(previous => {
      const prior = previous.applicants.find(item => item.application.id === record.application_id);
      const delta = Number(Boolean(prior?.case?.review?.completed)) - Number(Boolean(record.review?.completed));
      return {
        ...previous,
        summary: previous.summary && { ...previous.summary, waiting: Math.max(0, previous.summary.waiting + delta) },
        applicants: previous.applicants.map(item => item.application.id === record.application_id
          ? { ...item, case: record, application: record.application ?? item.application } : item)
      };
    });
    if (sync) await onRefresh();
  }

  async function runBatch(action) {
    const targets = visible.filter(item => action === "sync"
      ? !item.case || (item.hasResume && item.case.candidate_id && !item.case.resume_path)
      : item.case?.resume_path && item.case?.questionnaire);
    const results = [];
    setBatch({ running: true, results, total: targets.length });
    for (const item of targets) {
      let message;
      try {
        const result = await screeningRequest(action, { requisitionId, applicationId: item.application.id,
          ...(action === "draft" ? { generate: true } : {}) });
        if (result.case) await update(result.case, false);
        message = action === "draft" ? "Draft ready" : result.case?.candidate_id ? "Synchronized" : "Identity review required";
      } catch (err) {
        message = err.message;
      }
      results.push({ id: item.application.id, name: `${item.application.first_name} ${item.application.last_name}`, message });
      setBatch({ running: true, results: [...results], total: targets.length });
    }
    if (action === "sync") await onRefresh();
    setSelected("");
    setBatch({ running: false, results, total: targets.length });
  }

  return <>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {!list && !error && <p role="status">Loading applications…</p>}
    {list && <>
      {list.summary && <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Total applicants", list.summary.total],
          ["Assessments submitted", list.summary.assessed],
          ["Assessments pending", list.summary.total - list.summary.assessed],
          ["Awaiting review", list.summary.waiting],
          ["Resumes attached", list.summary.resumes]
        ].map(([label, count]) => <div key={label} className="rounded border border-slate-700 p-3">
          <dt className="text-sm text-slate-300">{label}</dt><dd className="text-xl font-semibold">{count}</dd>
        </div>)}
      </dl>}
      <div className="flex flex-wrap items-end gap-3">
        <label>Review status<select className={field} value={filter} disabled={batch?.running} onChange={event => setFilter(event.target.value)}>
          <option value="all">All reviews</option><option value="pending">Pending</option><option value="complete">Completed</option>
        </select></label>
        <p className="text-xs text-slate-400">Review filter and batch actions apply to this page.</p>
        <button className={button} disabled={batch?.running} onClick={() => setReload(value => value + 1)}>Refresh applications</button>
        <button className={button} disabled={batch?.running || !visible.length} onClick={() => runBatch("sync")}>Sync visible applications</button>
        <button className={button} disabled={batch?.running || !visible.some(item => item.case?.resume_path && item.case?.questionnaire)}
          onClick={() => runBatch("draft")}>Generate visible evidence drafts</button>
      </div>
      {batch && <section><p role="status">Processed {batch.results.length} of {batch.total}</p>
        <ul className="text-sm">{batch.results.map(item => <li key={item.id}>{item.name} · {item.message}</li>)}</ul>
      </section>}
      <div className="grid gap-4 lg:grid-cols-[minmax(230px,1fr)_2fr]">
        <ul className="space-y-2">{visible.map(item => <li key={item.application.id}>
          <button className={`w-full rounded border p-3 text-left ${selected === item.application.id ? "border-amber-300" : "border-slate-700"}`}
            disabled={batch?.running} onClick={() => setSelected(item.application.id)}>
            <strong>{item.application.first_name} {item.application.last_name}</strong>
            <span className="block text-xs text-slate-300">{assessmentState(item)} · {item.hasResume ? "Resume available" : "No resume"}</span>
            <span className="block text-xs text-slate-400">{item.case?.review?.completed ? "Review complete" : "Review pending"} · {syncStatus(item)}</span>
          </button>
        </li>)}
        {!visible.length && <li>No applications match this page and filter.</li>}
        </ul>
        {row && !batch?.running && <ApplicantReview key={`${row.application.id}:${row.case?.revision ?? "unsynced"}:${row.case?.candidate_id ?? ""}`}
          row={row} requisitionId={requisitionId} candidates={candidates} interviews={interviews} feedback={feedback} onChanged={update} onRefresh={onRefresh} onSelectCandidate={onSelectCandidate} />}
      </div>
      <div className="flex gap-3">
        {offset > 0 && <button className={button} disabled={batch?.running} onClick={() => { setList(null); setSelected(""); setOffset(value => Math.max(0, value - 30)); }}>Previous page</button>}
        {list.nextOffset !== null && <button className={button} disabled={batch?.running} onClick={() => { setList(null); setSelected(""); setOffset(list.nextOffset); }}>Next page</button>}
      </div>
    </>}
  </>;
}

export default function ScreeningCenter({ candidates, interviews, feedback, onRefresh, onSelectCandidate }) {
  const [positions, setPositions] = useState([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    marketingDevClient.rpc("ats_admin_requisitions").then(({ data, error }) => {
      if (!live) return;
      if (error) setError(error.message);
      else setPositions(data?.requisitions ?? []);
    });
    return () => { live = false; };
  }, []);
  return <section className="space-y-4">
    <h2 className="text-2xl font-bold">Applicant Screening Center</h2>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    <label className="block max-w-lg">Position<select className={field} value={selected} onChange={event => setSelected(event.target.value)}>
      <option value="">Select a requisition</option>
      {positions.map(position => <option key={position.id} value={position.id}>{position.title} · {position.status}</option>)}
    </select></label>
    {selected && <PositionReview key={selected} requisitionId={selected} candidates={candidates} interviews={interviews} feedback={feedback} onRefresh={onRefresh} onSelectCandidate={onSelectCandidate} />}
  </section>;
}
