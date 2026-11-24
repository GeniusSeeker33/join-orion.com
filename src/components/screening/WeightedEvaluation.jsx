import { scoreLabel } from "./rubrics";

export default function WeightedEvaluation({ rubric, draft, saved, completed, editRubric, scores, onScore, onLatest }) {
  const draftScores = Object.fromEntries((draft?.categories ?? []).map(item => [item.id, item.score]));
  const editing = editRubric;
  return <section className="space-y-3 rounded border border-slate-600 p-3">
    <h4 className="font-semibold">Weighted resume evaluation</h4>
    <p>AI draft evidence · Version {rubric.version} · {scoreLabel(rubric, draftScores)}</p>
    <p className="text-sm text-slate-300">Unverified categories leave the total incomplete. Missing evidence does not establish ability.</p>
    <ul className="space-y-2">
      {rubric.categories.map(category => {
        const item = draft?.categories?.find(entry => entry.id === category.id);
        return <li key={category.id}>
          <strong>{category.label}</strong> · {item?.score == null ? "Unverified" : `${item.score} / ${category.weight}`}
          {item?.quote && <blockquote className="mt-1 border-l-2 border-slate-500 pl-3 text-sm text-slate-300">{item.quote}</blockquote>}
        </li>;
      })}
    </ul>
    {draft?.missing_information?.length > 0 && <div><strong>Missing or unverified information</strong>
      <ul className="list-disc pl-5">{draft.missing_information.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    {draft?.interview_questions?.length > 0 && <div><strong>Suggested interview questions</strong>
      <ul className="list-disc pl-5">{draft.interview_questions.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    <fieldset className="space-y-2 border-t border-slate-700 pt-3">
      <legend>Recruiter points · Version {editing.version}</legend>
      {saved && <p>{completed ? "Recruiter-verified evaluation" : "Saved recruiter points"} · {scoreLabel(saved.rubric, saved.scores)}</p>}
      {editing.version !== rubric.version && <button type="button" className="underline" onClick={onLatest}>Start a review on the latest rubric</button>}
      <div className="grid gap-2 sm:grid-cols-2">{editing.categories.map(category => <label key={category.id}>
        {category.label} (max {category.weight})
        <input type="number" min="0" max={category.weight} step="1" className="block w-full rounded bg-slate-800 p-2"
          placeholder="Unverified" value={scores[category.id] ?? ""} onChange={event =>
            onScore(category.id, event.target.value === "" ? null : Number(event.target.value))} />
      </label>)}</div>
      <p>Current recruiter points · {scoreLabel(editing, scores)}</p>
    </fieldset>
  </section>;
}
