import { useEffect, useState } from "react";
import { screeningRequest } from "./client";
import { screeningTemplates } from "./templates";

const field = "w-full rounded border border-slate-600 bg-slate-800 p-2";

export default function QuestionnaireEditor({ requisitionId }) {
  const [config, setConfig] = useState(null);
  const [postings, setPostings] = useState([]);
  const [jobId, setJobId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const posting = postings.find(job => job.id === jobId);
  useEffect(() => {
    let live = true;
    Promise.all([screeningRequest("postings"), screeningRequest("configuration", { requisitionId })])
      .then(([jobs, { position }]) => {
        if (!live) return;
        setPostings(jobs.postings);
        setConfig(position);
        setJobId(position?.job_id ?? "");
        setQuestions(position?.draft ?? []);
      })
      .catch(err => { if (live) setError(err.message); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [requisitionId]);

  async function save(event) {
    event.preventDefault();
    const publish = event.nativeEvent.submitter?.value === "publish";
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { position } = await screeningRequest("questionnaire", { requisitionId, jobId, questions, publish });
      setConfig(position);
      setNotice(publish ? "Questionnaire published." : "Draft saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function addQuestion() {
    const taken = new Set(questions.map(question => question.id));
    let number = questions.length + 1;
    while (taken.has(`question_${number}`)) number++;
    setQuestions([...questions, { id: `question_${number}`, prompt: "" }]);
  }

  return <section className="mt-7 space-y-4 border-t border-slate-700 pt-5">
    <h3 className="text-lg font-semibold">Screening questionnaire</h3>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {notice && <p role="status" className="text-emerald-300">{notice}</p>}
    {busy && <p role="status">Working…</p>}
    <form onSubmit={save} className="grid gap-4">
      <label>Careers posting
        <select className={field} disabled={busy || Boolean(config)} required value={jobId} onChange={event => setJobId(event.target.value)}>
          <option value="">Select a posting</option>
          {postings.map(job => <option key={job.id} value={job.id}>{job.title}{job.is_active ? "" : " (inactive)"}</option>)}
        </select>
      </label>
      {posting && <details>
        <summary className="cursor-pointer text-amber-300">Review the job description, schedule and pay</summary>
        <p className="my-2">{[posting.location, posting.hours, posting.pay].filter(Boolean).join(" · ")}</p>
        <p className="max-h-72 overflow-auto whitespace-pre-wrap">{posting.description}</p>
      </details>}
      {jobId && !questions.length && <label>Start from a role template
        <select className={field} value="" onChange={event => {
          if (event.target.value !== "") setQuestions(screeningTemplates[Number(event.target.value)].questions);
        }}>
          <option value="">Choose a template</option>
          {screeningTemplates.map(({ title }, index) => <option key={title} value={index}>{title}</option>)}
        </select>
      </label>}
      {questions.map(({ id, prompt }, index) => <div key={id} className="flex items-end gap-2">
        <label className="flex-1">Question {index + 1}
          <textarea className={field} required minLength={5} maxLength={600} value={prompt}
            onChange={event => setQuestions(questions.map(item => item.id === id ? { ...item, prompt: event.target.value } : item))} />
        </label>
        <button type="button" className="text-amber-300 underline" aria-label={`Remove question ${index + 1}`}
          onClick={() => setQuestions(questions.filter(item => item.id !== id))}>Remove</button>
      </div>)}
      {jobId && <div className="flex flex-wrap gap-3">
        <button type="button" className="text-amber-300 underline" disabled={questions.length >= 30} onClick={addQuestion}>Add question</button>
        <button type="button" className="text-amber-300 underline" disabled={!questions.length} onClick={() => setPreview(!preview)}>{preview ? "Hide preview" : "Preview questionnaire"}</button>
        <button type="submit" value="draft" className="rounded bg-slate-700 px-3 py-2 disabled:opacity-50" disabled={busy || !questions.length}>Save draft</button>
        <button type="submit" value="publish" className="rounded bg-amber-300 px-3 py-2 font-semibold text-slate-950 disabled:opacity-50" disabled={busy || !questions.length || !posting?.is_active}>Publish questionnaire</button>
      </div>}
    </form>
    {preview && <section className="rounded border border-slate-600 p-4"><h4 className="font-semibold">Applicant preview</h4>
      <ol className="mt-2 list-decimal space-y-2 pl-5">{questions.map(item => <li key={item.id}>{item.prompt}</li>)}</ol>
    </section>}
    {config?.published_id && <label className="block">Shareable assessment link
      <input className={field} readOnly value={`${window.location.origin}/assessment/${config.job_id}`} onFocus={event => event.target.select()} />
    </label>}
  </section>;
}
