import { useState } from "react";
import { decisionLabels, scoreLabel, scoreSummary } from "./rubrics";

export default function BatchReview({ rows, rubric, interviews, onOpen, busy }) {
  const [sort, setSort] = useState("date");
  const name = row => row.application.first_name + " " + row.application.last_name;
  const draftScores = row => Object.fromEntries((row.weightedDraft?.categories ?? []).map(item => [item.id, item.score]));
  const sorted = [...rows].sort((a, b) => {
    if (sort === "name") return name(a).localeCompare(name(b));
    if (sort === "draft") return (scoreSummary(rubric, draftScores(b)).total ?? -1) - (scoreSummary(rubric, draftScores(a)).total ?? -1);
    if (sort === "verified") return (verifiedTotal(b) ?? -1) - (verifiedTotal(a) ?? -1);
    return (b.application.created_at ?? "").localeCompare(a.application.created_at ?? "");
  });
  function verifiedTotal(row) {
    const review = row.case?.review;
    return review?.completed ? scoreSummary(review.evaluation?.rubric, review.evaluation?.scores).total : null;
  }
  const headers = ["Candidate", "Applied", "Assessment", "Resume", "Draft evidence score", "Verified score",
    "Review", "Decision", "Interview", "Open"];
  return <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
    <h3 className="text-lg font-semibold">Batch Review</h3>
    <label>Sort applicants <select className="rounded bg-slate-800 p-2" value={sort} onChange={event => setSort(event.target.value)}>
      <option value="date">Newest application</option><option value="name">Candidate name</option>
      <option value="draft">Draft evidence score</option><option value="verified">Recruiter-verified score</option>
    </select></label>
    <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Candidate comparison">
      <table className="w-full min-w-[70rem] text-left text-sm">
        <thead><tr>{headers.map(label => <th className="px-2 py-2" scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{sorted.map(row => {
          const review = row.case?.review;
          const linked = interviews.filter(item => item.candidate_id === row.case?.candidate_id)
            .sort((a, b) => String(b.interview_date).localeCompare(String(a.interview_date)))[0];
          const cells = [row.application.created_at ? new Date(row.application.created_at).toLocaleDateString() : "—",
            row.application.screening_answers ? "Submitted" : "Pending", row.hasResume ? "Available" : "Missing",
            row.weightedDraft ? scoreLabel(rubric, draftScores(row)) : "—",
            review?.completed && review.evaluation ? `${scoreLabel(review.evaluation.rubric, review.evaluation.scores)} · v${review.evaluation.rubric.version}` : "—",
            row.needsRoute ? "Needs routing" : review?.completed ? "Complete" : "Pending",
            decisionLabels[review?.decision] ?? decisionLabels.pending,
            linked?.attendance_status?.replaceAll("_", " ") || (linked || review?.interview_at ? "Scheduled" : row.application.interview_status ?? "—")];
          return <tr className="border-t border-slate-700" key={row.application.id}>
            <th className="px-2 py-2" scope="row">{name(row)}</th>
            {cells.map((value, index) => <td className="px-2 py-2" key={headers[index + 1]}>
              {index === 4 && verifiedTotal(row) !== null
                ? <strong className="inline-block rounded bg-emerald-950 px-2 py-1 text-base text-emerald-200">{value}</strong>
                : value}
            </td>)}
            <td className="px-2 py-2"><button className="text-amber-300 underline" disabled={busy}
              onClick={() => onOpen(row.application.id)}>Open candidate</button></td>
          </tr>;
        })}</tbody>
      </table>
      {!sorted.length && <p className="py-3 text-slate-300">No applicants match this filter.</p>}
    </div>
  </section>;
}
