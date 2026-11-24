import { useEffect, useState } from "react";
import { screeningRequest } from "./client";

export default function ScreeningResumes({ candidateId }) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    screeningRequest("candidateResumes", { candidateId })
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

  return <details className="mt-3">
    <summary className="cursor-pointer">Screening resumes ({records.length})</summary>
    {records.map(record => <div key={record.application_id} className="flex flex-wrap justify-between gap-2 py-2">
      <span className="break-all">{record.resume_name}</span>
      <button className="text-amber-300 underline" onClick={() => open(record)}>Download private resume</button>
    </div>)}
    {error && <p role="alert" className="text-amber-300">{error}</p>}
  </details>;
}
