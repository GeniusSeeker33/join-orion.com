import { useEffect, useState } from "react";
import AssessmentAnswers from "./AssessmentAnswers";
import { screeningRequest } from "./client";

export default function ScreeningResumes({ candidateId }) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    screeningRequest("candidateScreening", { candidateId })
      .then(result => { if (live) setRecords(result.records); })
      .catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [candidateId]);

  async function open(record) {
    setError("");
    try {
      const result = await screeningRequest("resume", { applicationId: record.application_id, requisitionId: record.requisition_id });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message);
    }
  }

  const firstResumeByDigest = new Map();
  for (const record of records) {
    if (record.resume_name) {
      const key = record.resume_sha256 ?? record.application_id;
      if (!firstResumeByDigest.has(key)) firstResumeByDigest.set(key, record.application_id);
    }
  }

  return <details className="mt-3">
    <summary className="cursor-pointer">Screening applications ({records.length})</summary>
    {records.map(record => <article key={record.application_id} className="space-y-2 border-b border-slate-700 py-3">
      <h4 className="font-semibold">{record.application.position_title}</h4>
      <AssessmentAnswers application={record.application} questionnaire={record.questionnaire} />
      {firstResumeByDigest.get(record.resume_sha256 ?? record.application_id) === record.application_id && <button className="text-amber-300 underline" onClick={() => open(record)}>
        Download private resume <span className="break-all">({record.resume_name})</span>
      </button>}
    </article>)}
    {error && <p role="alert" className="text-amber-300">{error}</p>}
  </details>;
}
